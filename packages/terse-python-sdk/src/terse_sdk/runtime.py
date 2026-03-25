"""Runtime helpers for registering and executing Terse Python jobs."""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
import os
import sys
from collections.abc import Awaitable, Callable, Coroutine, Generator, Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, TypeVar, cast

import httpx
from httpx_sse import connect_sse
from pydantic import ValidationError

from .types.config import TerseSettings
from .types.events import (
    AnyInputEvent,
    AtlassianInputEvent,
    AttioInputEvent,
    CronJobInputEvent,
    DatadogInputEvent,
    FigmaInputEvent,
    GithubInputEvent,
    GmailInputEvent,
    InputEvent,
    LaunchDarklyInputEvent,
    LinearInputEvent,
    NotionInputEvent,
    PosthogInputEvent,
    SerializedEventInputEvent,
    SlackInputEvent,
    SnowflakeInputEvent,
    TerseInputEvent,
    WorkOSInputEvent,
)
from .types.jobs import SkillConfig, TriggerConfig
from .types.sdk_types import (
    SdkAgentRunRequestBody,
    SdkAgentRunResponseBody,
    SdkAgentSkillPayload,
    SerializedEvent,
)
from .types.stream_events import (
    SdkAgentStreamEvent,
    SdkAgentStreamEventAction,
    SdkAgentStreamEventDone,
    SdkAgentStreamEventError,
    SdkAgentStreamEventFinalOutput,
    SdkAgentStreamEventText,
    SdkAgentStreamEventToolCallCompleted,
    SdkAgentStreamEventToolCallParams,
    SdkAgentStreamEventToolCallStarted,
)

JobEvent = AnyInputEvent
JobHandler = Callable[[JobEvent, "TerseAgent"], None | Awaitable[None]]
JobFilter = Callable[[JobEvent], bool | Awaitable[bool]]
AgentStreamEvent = (
    SdkAgentStreamEventText
    | SdkAgentStreamEventFinalOutput
    | SdkAgentStreamEventToolCallParams
    | SdkAgentStreamEventToolCallStarted
    | SdkAgentStreamEventToolCallCompleted
    | SdkAgentStreamEventAction
)

HandlerT = TypeVar("HandlerT", bound=Callable[..., object])
ResultT = TypeVar("ResultT")

_JOB_REGISTRY: dict[str, RegisteredJob] = {}
LOGGER = logging.getLogger("terse.sdk.runtime")
_EVENT_MODEL_BY_INTEGRATION = {
    "github": GithubInputEvent,
    "slack": SlackInputEvent,
    "linear": LinearInputEvent,
    "atlassian": AtlassianInputEvent,
    "gmail": GmailInputEvent,
    "notion": NotionInputEvent,
    "figma": FigmaInputEvent,
    "posthog": PosthogInputEvent,
    "datadog": DatadogInputEvent,
    "terse": TerseInputEvent,
    "cron_job": CronJobInputEvent,
    "launchdarkly": LaunchDarklyInputEvent,
    "workos": WorkOSInputEvent,
    "attio": AttioInputEvent,
    "snowflake": SnowflakeInputEvent,
}


class TerseRuntimeError(RuntimeError):
    """Base runtime error for the Python SDK."""


class MissingApiKeyError(TerseRuntimeError):
    """Raised when a command requires ``TERSE_API_KEY`` and it is missing."""


class TerseApiError(TerseRuntimeError):
    """Raised when a backend request fails."""


class EventType(StrEnum):
    """Stream event type constants for agent runs."""

    TEXT = "text"
    FINAL_OUTPUT = "final_output"
    TOOL_CALL_PARAMS = "tool_call_params"
    TOOL_CALL_STARTED = "tool_call_started"
    TOOL_CALL_COMPLETED = "tool_call_completed"
    ACTION = "action"


@dataclass(frozen=True)
class RegisteredJob:
    """A runtime job registration captured from ``@app.job``."""

    name: str
    handler: Callable[..., object] = field(repr=False, compare=False)
    triggers: list[TriggerConfig] = field(default_factory=list)
    skills: list[SkillConfig] = field(default_factory=list)
    filter: JobFilter | None = field(default=None, repr=False, compare=False)
    webhook_url: str | None = None


class Terse:
    """Python entry point for registering jobs."""

    def job(
        self,
        *,
        name: str,
        triggers: Sequence[TriggerConfig] | None = None,
        skills: Sequence[SkillConfig] | None = None,
        filter: JobFilter | None = None,
        webhook_url: str | None = None,
    ) -> Callable[[HandlerT], HandlerT]:
        """Register a job and return the original handler."""

        def decorator(handler: HandlerT) -> HandlerT:
            _JOB_REGISTRY[name] = RegisteredJob(
                name=name,
                handler=handler,
                triggers=list(triggers or []),
                skills=list(skills or []),
                filter=filter,
                webhook_url=webhook_url,
            )
            return handler

        return decorator


class TerseAgent:
    """Small Python runtime client for agent runs and deterministic tool calls."""

    def __init__(
        self,
        skills: Sequence[SkillConfig] | None = None,
        backend_url: str | None = None,
        session_id: str | None = None,
    ) -> None:
        settings = TerseSettings()
        self.skills = list(skills or [])
        self.backend_url = (backend_url or settings.backend_url).rstrip("/")
        self.session_id = session_id
        self._tools: object | None = None

    @property
    def tools(self) -> object:
        """Return generated deterministic tool wrappers for this agent."""

        if self._tools is None:
            self.ensure_generated_tools()
        if self._tools is None:
            raise AttributeError(
                "No generated tools are attached. Run `terse generate` and import `terse_generated` in your project."
            )
        return self._tools

    @tools.setter
    def tools(self, value: object) -> None:
        self._tools = value

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

    def run(self, prompt: str, event: InputEvent | None = None) -> Generator[AgentStreamEvent, None, None]:
        """Stream parsed agent-run events from the backend."""

        api_key = _require_api_key()
        request_body = SdkAgentRunRequestBody.model_validate(
            {
                "prompt": prompt,
                "event": _serialize_run_event(event or _manual_event()),
                "skills": [_serialize_skill_config(skill).model_dump(exclude_none=True) for skill in self.skills],
            }
        )
        request_payload = request_body.model_dump(exclude_none=True)
        headers = _build_auth_headers(api_key, accept="text/event-stream", session_id=self.session_id)
        _debug_log_request("POST", f"{self.backend_url}/sdk/agent-run", headers, request_payload)
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
                    if isinstance(stream_event, SdkAgentStreamEventDone):
                        if failed_tool_calls:
                            raise TerseApiError(f"Run completed with failed tool calls: {'; '.join(failed_tool_calls)}")
                        return
                    if isinstance(stream_event, SdkAgentStreamEventError):
                        raise TerseApiError(stream_event.message)
                    if isinstance(stream_event, SdkAgentStreamEventToolCallCompleted):
                        parsed = _parse_tool_call_completed(stream_event.toolCallCompleted)
                        if parsed.get("status") and parsed["status"] != "completed":
                            failed_tool_calls.append(f"{parsed.get('tool', 'unknown_tool')}: {parsed['status']}")
                    yield cast(AgentStreamEvent, stream_event)
        except httpx.RequestError as exc:
            raise TerseApiError(f"Could not connect to {self.backend_url} — is the backend running?\n  {exc}") from exc
        except ValidationError as exc:
            raise TerseApiError(f"Received invalid agent stream payload.\n  {exc}") from exc

    def run_and_wait(self, prompt: str, event: InputEvent | None = None) -> str | None:
        """Run the agent to completion and return the final output, if any."""

        final_output: str | None = None
        for chunk in self.run(prompt, event):
            if isinstance(chunk, SdkAgentStreamEventFinalOutput):
                final_output = chunk.finalOutput
        return final_output

    def execute_tool(self, tool_name: str, params: Mapping[str, object] | None = None) -> object:
        """Execute a deterministic tool via the backend."""

        api_key = _require_api_key()
        headers = _build_auth_headers(api_key, session_id=self.session_id)
        request_payload = {"toolName": tool_name, "params": dict(params or {})}
        _debug_log_request("POST", f"{self.backend_url}/sdk/tool-execute", headers, request_payload)

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
        _debug_log_response_payload("/sdk/tool-execute", payload)
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

        return payload_dict.get("result")


def clear_job_registry() -> None:
    """Clear the global job registry."""

    _JOB_REGISTRY.clear()


def get_job_registry() -> dict[str, RegisteredJob]:
    """Return a snapshot of the current job registry."""

    return dict(_JOB_REGISTRY)


def deserialize_input_event(value: SerializedEvent | Mapping[str, object] | str) -> AnyInputEvent:
    """Convert a serialized backend event into the best matching SDK event model."""

    if isinstance(value, SerializedEvent):
        payload = value.model_dump(exclude_none=True)
    elif isinstance(value, str):
        parsed = json.loads(value)
        if not isinstance(parsed, dict):
            raise TerseRuntimeError("Serialized event JSON must be an object.")
        payload = dict(parsed)
    else:
        payload = dict(value)

    event_class = _EVENT_MODEL_BY_INTEGRATION.get(_read_integration_type(payload))
    if event_class is None:
        return SerializedEventInputEvent.model_validate(payload)
    try:
        return event_class.model_validate(payload)
    except ValidationError:
        return SerializedEventInputEvent.model_validate(payload)


def execute_registered_job(
    job: RegisteredJob,
    event: AnyInputEvent,
    *,
    agent: TerseAgent | None = None,
) -> bool:
    """Execute a registered job and return ``True`` when it was skipped by the filter."""

    runtime_agent = agent or TerseAgent(job.skills)
    runtime_agent.ensure_generated_tools()

    if job.filter is not None:
        should_run = _run_callable(job.filter, event)
        if not should_run:
            return True

    _run_callable(job.handler, event, runtime_agent)
    return False


def _serialize_skill_config(skill: SkillConfig) -> SdkAgentSkillPayload:
    config = dict(skill.config)
    config["integrationId"] = skill.integration_id
    config["integrationType"] = skill.integration_type
    config["configType"] = skill.config_type
    return SdkAgentSkillPayload.model_validate({"configType": skill.config_type, "config": config})


def _resolve_generated_tools_factory() -> Callable[[TerseAgent], object] | None:
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


def _serialize_run_event(event: InputEvent) -> dict[str, str]:
    return {
        "integrationType": event.integration_type,
        "formattedContent": event.formatted_content,
        "debugLog": event.debug_log,
    }


def _manual_event() -> TerseInputEvent:
    return TerseInputEvent(
        event_type="manual",
        formatted_content="Manual trigger from terse run",
        debug_log="[MockInputEvent] Manual trigger via SDK",
    )


def _build_auth_headers(
    api_key: str,
    *,
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
    _debug_log_response_metadata(response, path)
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
    _debug_log_response_payload(path, payload)
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


def _read_response_detail(response: httpx.Response) -> str:
    _buffer_response_content(response)
    try:
        payload = response.json()
    except ValueError:
        return response.text.strip()

    if isinstance(payload, dict):
        detail = payload.get("error")
        if detail is not None:
            return str(detail)
    return response.text.strip()


def _buffer_response_content(response: httpx.Response) -> None:
    response.read()


def _debug_log_request(method: str, url: str, headers: Mapping[str, str], payload: object | None) -> None:
    if not LOGGER.isEnabledFor(logging.DEBUG):
        return

    LOGGER.debug("HTTP %s %s", method.upper(), url)
    LOGGER.debug("Request headers:\n%s", _format_debug_value(_redact_headers(headers)))
    if payload is not None:
        LOGGER.debug("Request payload:\n%s", _format_debug_value(payload))


def _debug_log_response_metadata(response: httpx.Response, path: str) -> None:
    if not LOGGER.isEnabledFor(logging.DEBUG):
        return

    LOGGER.debug("Response %s %s for %s", response.status_code, response.reason_phrase, path)
    LOGGER.debug("Response headers:\n%s", _format_debug_value(dict(response.headers)))


def _debug_log_response_payload(path: str, payload: object) -> None:
    if not LOGGER.isEnabledFor(logging.DEBUG):
        return

    LOGGER.debug("Response payload from %s:\n%s", path, _format_debug_value(payload))


def _redact_headers(headers: Mapping[str, str]) -> dict[str, str]:
    redacted: dict[str, str] = {}
    for key, value in headers.items():
        if key.lower() == "authorization":
            redacted[key] = "Bearer ***"
            continue
        redacted[key] = value
    return redacted


def _format_debug_value(value: object) -> str:
    try:
        return json.dumps(value, indent=2, sort_keys=True, default=str)
    except TypeError:
        return str(value)


def _as_object_dict(value: object) -> dict[str, object] | None:
    if isinstance(value, dict):
        return cast(dict[str, object], value)
    return None


def _read_integration_type(payload: Mapping[str, object]) -> str:
    raw_value = payload.get("integrationType", payload.get("integration_type"))
    if hasattr(raw_value, "root"):
        raw_value = raw_value.root
    return str(raw_value or "")


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


def _run_callable(func: Callable[..., ResultT | Awaitable[ResultT]], *args: object) -> ResultT:
    result = func(*args)
    if inspect.isawaitable(result):
        return _await_result(cast(Awaitable[ResultT], result))
    return cast(ResultT, result)


def _await_result(awaitable: Awaitable[ResultT]) -> ResultT:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(cast(Coroutine[Any, Any, ResultT], awaitable))
    raise TerseRuntimeError("Cannot synchronously await a coroutine while another event loop is running.")
