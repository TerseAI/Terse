"""Runtime helpers for registering and executing Terse Python jobs."""

from __future__ import annotations

import json
import logging
import os
import sys
from collections.abc import Callable, Generator, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, TypeVar, cast

import httpx
from httpx_sse import connect_sse
from pydantic import BaseModel, RootModel, ValidationError

from ._http_utils import (
    _buffer_response_content,
    _debug_log_request,
    _debug_log_response_metadata,
    _debug_log_response_payload,
    _read_response_detail,
)
from ._logging_utils import LOGGER, _configure_debug_logging
from .errors import MissingApiKeyError, TerseApiError, TerseRuntimeError
from .types._generated import ConfigData, SerializedEvent
from .types._generated import ManualSampleTrigger as _RawManualSampleTrigger
from .types.config import TerseSettings
from .types.events import AnyTrigger, SDKTrigger
from .types.jobs import SkillConfig, TriggerConfig
from .types.sdk_types import (
    SdkAgentRunRequestBody,
    SdkAgentRunResponseBody,
)
from .types.stream_events import (
    Done,
    Error,
    FinalOutput,
    SdkAgentStreamEvent,
    ToolCallCompleted,
)

# Type alias for readability.
JobEvent = AnyTrigger
JobFilter = Callable[[JobEvent], bool]

# Type variables used for generics
ResultT = TypeVar("ResultT")
ToolApprovalT = TypeVar("ToolApprovalT", bound=str)
JobEventT = TypeVar("JobEventT", bound=AnyTrigger)

_JOB_REGISTRY: dict[str, RegisteredJob] = {}


@dataclass(frozen=True)
class RegisteredJob:
    """A runtime job registration captured from ``@app.job``."""

    name: str
    handler: Callable[..., object] = field(repr=False, compare=False)
    triggers: list[TriggerConfig[AnyTrigger]] = field(default_factory=list)
    skills: list[SkillConfig[Any]] = field(default_factory=list)
    filter: JobFilter | None = field(default=None, repr=False, compare=False)
    webhook_url: str | None = None
    tool_approvals: list[str] | None = None


class Terse:
    """Python entry point for registering jobs."""

    def job(
        self,
        name: str,
        triggers: Sequence[TriggerConfig[JobEventT]] | None = None,
        skills: Sequence[SkillConfig[ToolApprovalT]] | None = None,
        filter: Callable[[JobEventT], bool] | None = None,
        webhook_url: str | None = None,
        tool_approvals: Sequence[ToolApprovalT] | None = None,
    ) -> Callable[
        [Callable[[JobEventT, TerseAgent], None]],
        Callable[[JobEventT, TerseAgent], None],
    ]:
        """Register a job and return the original handler."""

        def decorator(
            handler: Callable[[JobEventT, TerseAgent], None],
        ) -> Callable[[JobEventT, TerseAgent], None]:
            _JOB_REGISTRY[name] = RegisteredJob(
                name=name,
                handler=handler,
                triggers=list(triggers or []),
                skills=list(skills or []),
                filter=filter,
                webhook_url=webhook_url,
                tool_approvals=list(tool_approvals or []),
            )
            return handler

        return decorator


class TerseAgent:
    """Small Python runtime client for agent runs and deterministic tool calls."""

    def __init__(
        self,
        skills: Sequence[SkillConfig[Any]] | None = None,
        backend_url: str | None = None,
        session_id: str | None = None,
        manual_tool_configs: Sequence[TriggerConfig | SkillConfig[Any]] | None = None,
        tool_approvals: list[str] | None = None,
    ) -> None:
        settings = TerseSettings()
        self.skills = list(skills or [])
        self.manual_tool_configs = list(manual_tool_configs) if manual_tool_configs is not None else None
        self.backend_url = (backend_url or settings.backend_url).rstrip("/")
        self.session_id = session_id
        self._tools: object | None = None
        self.tool_approvals = tool_approvals

    @property
    def tools(self) -> object:
        """Return generated deterministic tool wrappers for this agent."""

        if self._tools is None:
            self.ensure_generated_tools()
        if self._tools is None:
            raise TerseRuntimeError(
                "No generated tools are attached. Run `terse generate` and import `terse_generated` in your project."
            )
        return self._tools

    def attach_tools(self, tools: object) -> object:
        """Attach generated tool wrappers to the agent and return them."""

        self._tools = tools
        return tools

    def ensure_generated_tools(self) -> object | None:
        """Attach generated tool wrappers if a project-local factory is loaded."""

        if self._tools is not None:
            return self._tools

        factory = _resolve_generated_tools_factory()
        if factory is None:
            return None

        self._tools = factory(self)
        return self._tools

    def run(self, prompt: str, event: AnyTrigger | None = None) -> Generator[SdkAgentStreamEvent, None, None]:
        """Stream parsed agent-run events from the backend."""

        _configure_debug_logging()
        api_key = _require_api_key()
        request_body = _build_agent_run_request_body(
            prompt=prompt,
            event=event or _manual_event(),
            skills=self.skills,
            tool_approvals=self.tool_approvals,
        )
        request_payload = _drop_top_level_none_values(
            request_body.model_dump(
                exclude_none=False,
                by_alias=True,
                mode="json",
            )
        )
        if request_body.event is not None and isinstance(request_payload.get("event"), dict):
            request_payload["event"] = _strip_optional_nones(request_payload["event"], request_body.event)
        headers = _build_auth_headers(api_key, accept="text/event-stream", session_id=self.session_id)
        _debug_log_request(
            LOGGER,
            "POST",
            f"{self.backend_url}/sdk/agent-run",
            headers,
            request_payload,
        )
        failed_tool_calls: list[str] = []

        try:
            with (
                httpx.Client(timeout=None) as client,
                connect_sse(
                    client,
                    "POST",
                    f"{self.backend_url}/sdk/agent-run",
                    headers=headers,
                    json=request_payload,
                ) as event_source,
            ):
                _assert_sse_response(event_source.response, "/sdk/agent-run")

                for sse in event_source.iter_sse():
                    if not sse.data:
                        continue

                    stream_event = SdkAgentStreamEvent.model_validate_json(sse.data).root
                    if isinstance(stream_event, Done):
                        if failed_tool_calls:
                            raise TerseApiError(f"Run completed with failed tool calls: {'; '.join(failed_tool_calls)}")
                        return
                    if isinstance(stream_event, Error):
                        raise TerseApiError(stream_event.message)
                    if isinstance(stream_event, ToolCallCompleted):
                        parsed = _parse_tool_call_completed(stream_event.tool_call_completed)
                        if parsed.get("status") and parsed["status"] != "completed":
                            failed_tool_calls.append(f"{parsed.get('tool', 'unknown_tool')}: {parsed['status']}")
                    yield cast(SdkAgentStreamEvent, stream_event)
        except httpx.RequestError as exc:
            raise TerseApiError(f"Could not connect to {self.backend_url} — is the backend running?\n  {exc}") from exc
        except ValidationError as exc:
            raise TerseApiError(f"Received invalid agent stream payload.\n  {exc}") from exc

    def run_and_wait(self, prompt: str, event: AnyTrigger | None = None) -> str | None:
        """Run the agent to completion and return the final output.

        Returns ``None`` if no final_output event was received.
        """

        final_output: str | None = None
        for chunk in self.run(prompt, event):
            if isinstance(chunk, FinalOutput):
                final_output = chunk.final_output
        return final_output

    def execute_tool(self, tool_name: str, params: Mapping[str, object] | None = None) -> object:
        """Execute a deterministic tool via the backend."""

        api_key = _require_api_key()
        headers = _build_auth_headers(api_key, session_id=self.session_id)
        request_payload = {"toolName": tool_name, "params": dict(params or {})}
        _debug_log_request(
            LOGGER,
            "POST",
            f"{self.backend_url}/sdk/tool-execute",
            headers,
            request_payload,
        )

        try:
            with httpx.Client(timeout=20.0) as client:
                response = client.post(
                    f"{self.backend_url}/sdk/tool-execute",
                    headers=headers,
                    json=request_payload,
                )
        except httpx.RequestError as exc:
            raise TerseApiError(f"Could not connect to {self.backend_url} — is the backend running?\n  {exc}") from exc

        payload = _read_json_response(response, "/sdk/tool-execute")
        _debug_log_response_payload(LOGGER, "/sdk/tool-execute", payload)
        payload_dict = _as_object_dict(payload)
        if response.is_error:
            detail = payload_dict.get("error") if payload_dict is not None else None
            raise TerseApiError(
                f"{response.status_code} {response.reason_phrase} — /sdk/tool-execute"
                + (f"\n  {detail}" if detail else "")
            )

        if payload_dict is None or payload_dict.get("success") is not True:
            detail = payload_dict.get("error") if payload_dict is not None else None
            raise TerseApiError(str(detail or "Tool execution failed"))

        result = payload_dict.get("result")

        # Detect tool-level errors wrapped as successful responses.
        # This happens when the OpenAI SDK errorFunction handles the error
        # and returns a formatted string that gets parsed back into a dict.
        result_dict = _as_object_dict(result)
        if result_dict is not None and result_dict.get("success") is False:
            error_text = result_dict.get("text", "")
            if isinstance(error_text, str) and error_text.startswith("[TERSE ERROR]:"):
                detail = error_text[len("[TERSE ERROR]:") :]
                try:
                    parsed = json.loads(detail)
                    detail = parsed.get("error", detail)
                except (json.JSONDecodeError, AttributeError):
                    pass
                # Pretty-format embedded JSON in the error string.
                if isinstance(detail, str):
                    brace = detail.find("{")
                    if brace != -1:
                        try:
                            embedded = json.loads(detail[brace:])
                            detail = detail[:brace].rstrip() + "\n" + json.dumps(embedded, indent=2)
                        except (json.JSONDecodeError, ValueError):
                            pass
                raise TerseApiError(f"Tool execution failed: {detail}")
            raise TerseApiError("Tool execution failed")

        return result


def clear_job_registry() -> None:
    """Clear the global job registry."""

    _JOB_REGISTRY.clear()


def get_job_registry() -> dict[str, RegisteredJob]:
    """Return a snapshot of the current job registry."""

    return dict(_JOB_REGISTRY)


def create_sdk_trigger(
    serialized: SerializedEvent | Mapping[str, object] | str,
) -> AnyTrigger:
    """Create an ``SDKTrigger`` from a ``SerializedEvent`` envelope."""

    _configure_debug_logging()
    if isinstance(serialized, str):
        serialized = SerializedEvent.model_validate_json(serialized)
    elif isinstance(serialized, Mapping):
        serialized = SerializedEvent.model_validate(serialized)
    trigger = cast(Any, _unwrap_root_models(serialized.data))
    if LOGGER.isEnabledFor(logging.DEBUG):
        trigger_payload = _serialize_run_event(trigger)
        LOGGER.debug(
            "Deserialized input event %s/%s with keys=%s",
            trigger_payload.get("integrationType"),
            trigger_payload.get("eventType"),
            sorted(trigger_payload.keys()),
        )
    return cast(
        AnyTrigger,
        SDKTrigger(trigger, serialized.formatted_content, serialized.debug_log),
    )


def deserialize_input_event(value: Mapping[str, object] | str) -> AnyTrigger:
    """Deserialize a ``SerializedEvent`` JSON envelope into an enriched ``SDKTrigger``.

    This is the entry point used by the CLI runner script.
    """

    return create_sdk_trigger(value)


def _unwrap_root_models(value: object) -> object:
    current = value
    while isinstance(current, RootModel):
        current = current.root
    return current


def execute_registered_job(
    job: RegisteredJob,
    event: AnyTrigger | SDKTrigger[Any],
    agent: TerseAgent | None = None,
) -> bool:
    """Execute a registered job and return ``True`` when it was skipped by the filter."""
    sdk_event: AnyTrigger = event if isinstance(event, SDKTrigger) else SDKTrigger(event, "", "")

    manual_tool_configs = [*job.skills, *job.triggers]
    runtime_agent = agent or TerseAgent(
        job.skills,
        manual_tool_configs=manual_tool_configs,
        tool_approvals=job.tool_approvals,
    )
    if runtime_agent.manual_tool_configs is None:
        runtime_agent.manual_tool_configs = manual_tool_configs
    runtime_agent.ensure_generated_tools()

    if job.filter is not None:
        should_run = job.filter(sdk_event)
        if not should_run:
            return True

    job.handler(sdk_event, runtime_agent)
    return False


def _serialize_skill_config(skill: SkillConfig[Any]) -> ConfigData:
    config = {k: v for k, v in skill.config.items() if v is not None}
    config["integrationId"] = skill.integration_id
    config["integrationType"] = skill.integration_type
    config["configType"] = skill.config_type
    return ConfigData.model_validate(config)


def _resolve_generated_tools_factory() -> Callable[[TerseAgent], object] | None:
    """Discover the ``create_tools`` factory from a project's ``terse_generated`` module.

    When users run ``terse generate``, a ``terse_generated.py`` file is scaffolded
    containing typed wrappers for deterministic tool calls (e.g. ``agent.tools.snowflake``).
    This function scans ``sys.modules`` for that module so the SDK can auto-attach
    the wrappers to a :class:`TerseAgent` without requiring explicit registration.
    """

    module = sys.modules.get("terse_generated")
    factory = getattr(module, "create_tools", None) if module is not None else None
    if callable(factory):
        return cast(Callable[[TerseAgent], object], factory)

    for loaded_module in list(sys.modules.values()):
        module_file = getattr(loaded_module, "__file__", None)
        if not isinstance(module_file, str) or not module_file.endswith("/terse_generated.py"):
            continue
        factory = getattr(loaded_module, "create_tools", None)
        if callable(factory):
            return cast(Callable[[TerseAgent], object], factory)

    return None


def _strip_optional_nones(data: dict[str, object], model: object) -> dict[str, object]:
    """Strip ``None`` values from fields that have defaults (Zod ``.optional()``),
    while preserving ``null`` for required-nullable fields (Zod ``.nullable()``).

    This prevents Zod validation failures when the SDK sends JSON ``null`` for
    fields that the backend schema marks as ``.optional()`` (accepts
    ``undefined`` but not ``null``).
    """
    while isinstance(model, RootModel):
        model = model.root
    if not isinstance(model, BaseModel):
        return data

    model_cls = type(model)
    keys_to_drop: list[str] = []

    for field_name, field_info in model_cls.model_fields.items():
        key = field_info.alias or field_name
        if key not in data:
            continue

        value = data[key]

        if value is None and not field_info.is_required():
            keys_to_drop.append(key)
            continue

        if isinstance(value, dict):
            nested = getattr(model, field_name, None)
            if nested is not None and isinstance(nested, (BaseModel, RootModel)):
                data[key] = _strip_optional_nones(value, nested)
        elif isinstance(value, list):
            nested_list = getattr(model, field_name, None)
            if isinstance(nested_list, list):
                new_items: list[object] = []
                for i, item in enumerate(value):
                    if (
                        isinstance(item, dict)
                        and i < len(nested_list)
                        and isinstance(nested_list[i], (BaseModel, RootModel))
                    ):
                        new_items.append(_strip_optional_nones(item, nested_list[i]))
                    else:
                        new_items.append(item)
                data[key] = new_items

    for key in keys_to_drop:
        del data[key]

    return data


def _serialize_run_event(
    event: AnyTrigger | _RawManualSampleTrigger,
) -> dict[str, object]:
    raw = event.data if isinstance(event, SDKTrigger) else event
    return cast(
        dict[str, object],
        raw.model_dump(
            exclude_none=False,
            by_alias=True,
            mode="json",
        ),
    )


def _manual_event() -> _RawManualSampleTrigger:
    return _RawManualSampleTrigger.model_validate({"integrationType": "terse", "eventType": "manual_sample"})


def _build_auth_headers(
    api_key: str,
    accept: str = "application/json",
    session_id: str | None = None,
) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": accept,
    }

    if session_id:
        headers["X-Terse-Session-Id"] = session_id
    if run_id := os.environ.get("TERSE_RUN_ID"):
        headers["X-Terse-Run-Id"] = run_id

    return headers


def _assert_sse_response(response: httpx.Response, path: str) -> None:
    _debug_log_response_metadata(LOGGER, response, path)
    if response.is_error:
        detail = _read_response_detail(response)
        if detail:
            LOGGER.debug("Response detail from %s:\n%s", path, detail)
        raise TerseApiError(
            f"{response.status_code} {response.reason_phrase} — {path}" + (f"\n  {detail}" if detail else "")
        )

    content_type = response.headers.get("Content-Type", "")
    if "text/event-stream" in content_type:
        return

    payload = _read_json_response(response, path)
    _debug_log_response_payload(LOGGER, path, payload)
    if isinstance(payload, dict):
        response_body = SdkAgentRunResponseBody.model_validate(payload)
        if response_body.error:
            details = f" ({'; '.join(response_body.details)})" if response_body.details else ""
            raise TerseApiError(f"{response_body.error}{details}")

    raise TerseApiError(f"Expected text/event-stream from {path} but got {content_type or 'unknown content-type'}.")


def _read_json_response(response: httpx.Response, path: str) -> object:
    _buffer_response_content(response)
    try:
        return response.json()
    except ValueError as exc:
        raise TerseApiError(f"Received invalid JSON from {path}.") from exc


def _as_object_dict(value: object) -> dict[str, object] | None:
    if isinstance(value, dict):
        return cast(dict[str, object], value)
    return None


def _parse_tool_call_completed(raw: str) -> dict[str, str]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    if isinstance(payload, dict):
        return {str(key): str(value) for key, value in payload.items() if value is not None}
    return {}


def _require_api_key() -> str:
    api_key = TerseSettings().api_key.strip()
    if not api_key:
        raise MissingApiKeyError(
            "TERSE_API_KEY environment variable is not set. "
            "Add it to your .env file or export it before running this command."
        )
    return api_key


def _build_agent_run_request_body(
    *,
    prompt: str,
    event: AnyTrigger | _RawManualSampleTrigger,
    skills: Sequence[SkillConfig[Any]],
    tool_approvals: list[str] | None,
) -> SdkAgentRunRequestBody:
    serialized_event = _serialize_run_event(event)
    skill_payloads = [
        _serialize_skill_config(skill).model_dump(
            exclude_none=True,
            by_alias=True,
            mode="json",
        )
        for skill in skills
    ]
    if LOGGER.isEnabledFor(logging.DEBUG):
        LOGGER.debug(
            "Building /sdk/agent-run request for %s/%s with event keys=%s and %d skill(s)",
            serialized_event.get("integrationType"),
            serialized_event.get("eventType"),
            sorted(serialized_event.keys()),
            len(skill_payloads),
        )
    return SdkAgentRunRequestBody.model_validate(
        {
            "prompt": prompt,
            "event": serialized_event,
            "skills": skill_payloads,
            "toolApprovals": tool_approvals,
        }
    )


def _drop_top_level_none_values(payload: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in payload.items() if value is not None}
