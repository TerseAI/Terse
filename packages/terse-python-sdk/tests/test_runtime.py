# ruff: noqa: E501
from __future__ import annotations

import json
import os
import sys
from types import ModuleType, SimpleNamespace
from typing import Any
from unittest.mock import patch

import httpx
import pytest
import terse_sdk.runtime as runtime_module
import terse_sdk.types as terse_types
from terse_sdk import (
    CronJobInputEvent,
    EventType,
    MissingApiKeyError,
    SdkAgentStreamEvent,
    SdkAgentStreamEventDone,
    SdkAgentStreamEventFinalOutput,
    SdkAgentStreamEventRunStarted,
    SdkAgentStreamEventText,
    SdkAgentStreamEventToolApprovalRequested,
    SdkAgentStreamEventToolCallCompleted,
    SdkAgentToolApprovalRequest,
    SerializedEventInputEvent,
    SkillConfig,
    Terse,
    TerseAgent,
    TerseApiError,
    TerseRuntimeError,
    clear_job_registry,
    deserialize_input_event,
    execute_registered_job,
    get_job_registry,
)


@pytest.fixture(autouse=True)
def clear_registry() -> None:
    clear_job_registry()
    yield
    clear_job_registry()


class _FakeSSEEvent:
    def __init__(self, data: str) -> None:
        self.data = data


class _FakeEventSource:
    def __init__(self, events: list[str], *, path: str = "/sdk/agent-run") -> None:
        self.response = _json_response(
            200,
            {"ok": True},
            headers={"Content-Type": "text/event-stream"},
            path=path,
        )
        self._events = events

    def __enter__(self) -> _FakeEventSource:
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> bool:
        return False

    def iter_sse(self):
        for event in self._events:
            yield _FakeSSEEvent(event)


class _FakeClient:
    def __init__(self, response: httpx.Response | None = None) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    def __enter__(self) -> _FakeClient:
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> bool:
        return False

    def post(self, url: str, *, headers: dict[str, str], json: dict[str, object]) -> httpx.Response:
        self.calls.append({"url": url, "headers": headers, "json": json})
        if self.response is None:
            raise AssertionError("No response configured")
        return self.response


def test_job_registration_and_registry_clear() -> None:
    app = Terse()

    @app.job(name="demo-job")
    def demo(event: CronJobInputEvent, agent: TerseAgent) -> None:
        _ = (event, agent)

    registry = get_job_registry()
    assert "demo-job" in registry
    assert registry["demo-job"].handler is demo

    clear_job_registry()
    assert get_job_registry() == {}


def test_job_registration_preserves_tool_approvals() -> None:
    app = Terse()

    @app.job(name="demo-job", tool_approvals=["attio_upsert_record"])
    def demo(event: CronJobInputEvent, agent: TerseAgent) -> None:
        _ = (event, agent)

    assert get_job_registry()["demo-job"].tool_approvals == ["attio_upsert_record"]


def test_execute_registered_job_supports_sync_callables() -> None:
    handler_calls: list[str] = []
    filter_calls: list[str] = []
    app = Terse()

    def allow_sync(event: CronJobInputEvent) -> bool:
        filter_calls.append(event.event_type)
        return event.event_type == "manual"

    @app.job(name="sync-job", filter=allow_sync)
    def sync_handler(event: CronJobInputEvent, agent: TerseAgent) -> None:
        _ = agent
        handler_calls.append(event.formatted_content)

    event = CronJobInputEvent(
        event_type="manual",
        formatted_content="hello",
        debug_log="world",
    )

    sync_job = get_job_registry()["sync-job"]

    assert not execute_registered_job(sync_job, event, agent=TerseAgent())
    assert filter_calls == ["manual"]
    assert handler_calls == ["hello"]


def test_execute_registered_job_returns_true_when_filter_skips() -> None:
    calls: list[str] = []
    app = Terse()

    def never(event: CronJobInputEvent) -> bool:
        _ = event
        return False

    @app.job(name="demo-job", filter=never)
    def demo(event: CronJobInputEvent, agent: TerseAgent) -> None:
        _ = (event, agent)
        calls.append("ran")

    skipped = execute_registered_job(
        get_job_registry()["demo-job"],
        CronJobInputEvent(event_type="manual", formatted_content="demo", debug_log="demo"),
        agent=TerseAgent(),
    )

    assert skipped
    assert calls == []


def test_deserialize_input_event_supports_camel_case_payloads() -> None:
    event = deserialize_input_event(
        {
            "integrationType": "cron_job",
            "eventType": "manual",
            "formattedContent": "Scheduled job",
            "debugLog": "cron",
        }
    )

    assert isinstance(event, CronJobInputEvent)
    assert event.integration_type == "cron_job"
    assert event.formatted_content == "Scheduled job"


def test_deserialize_input_event_falls_back_for_unknown_integrations() -> None:
    event = deserialize_input_event(
        {
            "integrationType": "unknown_service",
            "eventType": "manual",
            "formattedContent": "Unknown",
            "debugLog": "unknown",
        }
    )

    assert isinstance(event, SerializedEventInputEvent)
    assert event.integration_type == "unknown_service"


def test_agent_execute_tool_includes_session_and_run_headers() -> None:
    fake_client = _FakeClient(
        _json_response(
            200,
            {"success": True, "result": {"ok": True}},
            path="/sdk/tool-execute",
        )
    )

    with (
        patch.dict(os.environ, {"TERSE_API_KEY": "terse_test_key", "TERSE_RUN_ID": "run_123"}, clear=False),
        patch("terse_sdk.runtime.httpx.Client", return_value=fake_client),
    ):
        result = TerseAgent(session_id="session_123").execute_tool("demo_tool", {"value": 1})

    assert result == {"ok": True}
    assert fake_client.calls[0]["headers"]["X-Terse-Session-Id"] == "session_123"
    assert fake_client.calls[0]["headers"]["X-Terse-Run-Id"] == "run_123"
    assert fake_client.calls[0]["json"]["toolName"] == "demo_tool"


def test_agent_execute_tool_requires_api_key() -> None:
    with patch.dict(os.environ, {"TERSE_API_KEY": ""}, clear=False), pytest.raises(MissingApiKeyError):
        TerseAgent().execute_tool("demo_tool")


def test_agent_tools_lazy_attach_from_generated_module() -> None:
    created_agents: list[TerseAgent] = []
    fake_tools = SimpleNamespace(snowflake="snowflake-tools")
    generated_module = ModuleType("terse_generated")

    def create_tools(agent: TerseAgent) -> object:
        created_agents.append(agent)
        return fake_tools

    generated_module.create_tools = create_tools  # type: ignore[attr-defined]

    with patch.dict(sys.modules, {"terse_generated": generated_module}, clear=False):
        agent = TerseAgent()
        assert agent.tools is fake_tools
        assert agent.tools is fake_tools

    assert created_agents == [agent]


def test_agent_tools_raise_clear_error_when_generated_module_is_missing() -> None:
    with (
        patch("terse_sdk.runtime._resolve_generated_tools_factory", return_value=None),
        pytest.raises(TerseRuntimeError),
    ):
        _ = TerseAgent().tools


def test_stream_event_exports_include_sdk_run_events() -> None:
    assert terse_types.SdkAgentStreamEventRunStarted is SdkAgentStreamEventRunStarted
    assert terse_types.SdkAgentStreamEventToolApprovalRequested is SdkAgentStreamEventToolApprovalRequested
    assert terse_types.SdkAgentToolApprovalRequest is SdkAgentToolApprovalRequest
    assert EventType.RUN_STARTED == "run_started"
    assert EventType.TOOL_APPROVAL_REQUESTED == "tool_approval_requested"


def test_run_started_event_supports_backend_payload() -> None:
    event = SdkAgentStreamEvent.model_validate({"type": "run_started", "runId": "run_123"}).root

    assert isinstance(event, SdkAgentStreamEventRunStarted)
    assert event.run_id == "run_123"


def test_tool_approval_requested_event_supports_backend_payload() -> None:
    event = SdkAgentStreamEvent.model_validate(
        {
            "type": "tool_approval_requested",
            "toolApprovalRequested": {
                "stepId": "step_123",
                "toolName": "demo_tool",
                "arguments": json.dumps({"value": 1}),
            },
        }
    ).root

    assert isinstance(event, SdkAgentStreamEventToolApprovalRequested)
    assert event.tool_approval_requested.step_id == "step_123"
    assert event.tool_approval_requested.tool_name == "demo_tool"
    assert event.tool_approval_requested.arguments == json.dumps({"value": 1})


def test_agent_run_streams_backend_events_and_serializes_event_payload() -> None:
    captured: dict[str, object] = {}
    stream = _FakeEventSource(
        [
            json.dumps({"type": "run_started", "runId": "run_123"}),
            json.dumps({"type": "text", "text": "hello"}),
            json.dumps(
                {
                    "type": "tool_approval_requested",
                    "toolApprovalRequested": {
                        "stepId": "step_123",
                        "toolName": "demo_tool",
                        "arguments": json.dumps({"value": 1}),
                    },
                }
            ),
            json.dumps(
                {
                    "type": "tool_call_completed",
                    "toolCallCompleted": json.dumps({"tool": "demo_tool", "status": "completed"}),
                }
            ),
            json.dumps({"type": "final_output", "finalOutput": "done"}),
            json.dumps({"type": "done"}),
        ]
    )

    def fake_connect_sse(
        client: object,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        json: dict[str, object],
    ) -> _FakeEventSource:
        captured.update({"method": method, "url": url, "headers": headers, "json": json})
        return stream

    with (
        patch.dict(os.environ, {"TERSE_API_KEY": "terse_test_key"}, clear=False),
        patch("terse_sdk.runtime.connect_sse", side_effect=fake_connect_sse),
    ):
        events = list(
            TerseAgent().run(
                "hello",
                CronJobInputEvent(
                    event_type="manual",
                    formatted_content="Scheduled event",
                    debug_log="cron",
                ),
            )
        )

    assert len(events) == 5
    assert isinstance(events[0], SdkAgentStreamEventRunStarted)
    assert events[0].type == EventType.RUN_STARTED
    assert events[0].run_id == "run_123"
    assert isinstance(events[2], SdkAgentStreamEventToolApprovalRequested)
    assert events[2].type == EventType.TOOL_APPROVAL_REQUESTED
    assert events[2].tool_approval_requested.tool_name == "demo_tool"
    assert events[-1].type == EventType.FINAL_OUTPUT
    assert events[-1].final_output == "done"
    assert captured["method"] == "POST"
    assert captured["headers"]["Authorization"] == "Bearer terse_test_key"
    assert captured["json"]["event"]["integrationType"] == "cron_job"
    assert captured["json"]["event"]["formattedContent"] == "Scheduled event"


def test_agent_run_serializes_missing_attio_object_slug_as_null() -> None:
    captured: dict[str, object] = {}
    stream = _FakeEventSource([json.dumps({"type": "done"})])

    def fake_connect_sse(
        client: object,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        json: dict[str, object],
    ) -> _FakeEventSource:
        captured.update({"method": method, "url": url, "headers": headers, "json": json})
        return stream

    with (
        patch.dict(os.environ, {"TERSE_API_KEY": "terse_test_key"}, clear=False),
        patch("terse_sdk.runtime.connect_sse", side_effect=fake_connect_sse),
    ):
        list(
            TerseAgent(
                skills=[
                    SkillConfig(
                        integration_id="cm_attio",
                        integration_type="attio",
                        config_type="attio_output",
                        config={},
                    )
                ]
            ).run("hello")
        )

    assert captured["json"]["skills"][0]["config"]["objectSlug"] is None


def test_agent_run_raises_on_failed_tool_call() -> None:
    stream = _FakeEventSource(
        [
            SdkAgentStreamEventToolCallCompleted(
                type="tool_call_completed",
                tool_call_completed=json.dumps({"tool": "demo_tool", "status": "failed"}),
            ).model_dump_json(),
            SdkAgentStreamEventDone(type="done").model_dump_json(),
        ]
    )

    with (
        patch.dict(os.environ, {"TERSE_API_KEY": "terse_test_key"}, clear=False),
        patch("terse_sdk.runtime.connect_sse", return_value=stream),
        pytest.raises(TerseApiError),
    ):
        list(TerseAgent().run("hello"))


def test_agent_run_and_wait_returns_final_output() -> None:
    with patch.object(
        TerseAgent,
        "run",
        return_value=iter(
            [
                SdkAgentStreamEventText(type="text", text="thinking"),
                SdkAgentStreamEventFinalOutput(type="final_output", final_output="done"),
            ]
        ),
    ):
        result = TerseAgent().run_and_wait("hello")

    assert result == "done"


def test_agent_run_and_wait_returns_none_when_no_final_output_arrives() -> None:
    with patch.object(TerseAgent, "run", return_value=iter([])):
        result = TerseAgent().run_and_wait("hello")

    assert result is None


def test_agent_run_and_wait_propagates_errors() -> None:
    with patch.object(TerseAgent, "run", side_effect=TerseApiError("boom")), pytest.raises(TerseApiError):
        TerseAgent().run_and_wait("hello")


def test_assert_sse_response_reads_streaming_json_error_payload() -> None:
    response = _streaming_json_response(
        200,
        {"success": False, "error": "backend unavailable"},
        path="/sdk/agent-run",
    )

    with pytest.raises(TerseApiError) as exc_info:
        runtime_module._assert_sse_response(response, "/sdk/agent-run")

    assert "backend unavailable" in str(exc_info.value)


def test_assert_sse_response_reads_streaming_error_detail_on_http_error() -> None:
    response = _streaming_json_response(
        401,
        {"error": "unauthorized"},
        path="/sdk/agent-run",
    )

    with pytest.raises(TerseApiError) as exc_info:
        runtime_module._assert_sse_response(response, "/sdk/agent-run")

    assert "unauthorized" in str(exc_info.value)


def test_assert_sse_response_reads_streaming_error_details_list_on_http_error() -> None:
    response = _streaming_json_response(
        400,
        {"error": "Invalid request body", "details": ["`skills[0].config.objectSlug` is required"]},
        path="/sdk/agent-run",
    )

    with pytest.raises(TerseApiError) as exc_info:
        runtime_module._assert_sse_response(response, "/sdk/agent-run")

    assert "Invalid request body" in str(exc_info.value)
    assert "`skills[0].config.objectSlug` is required" in str(exc_info.value)


def _json_response(
    status_code: int,
    payload: object,
    *,
    headers: dict[str, str] | None = None,
    path: str,
) -> httpx.Response:
    return httpx.Response(
        status_code,
        headers={"Content-Type": "application/json", **(headers or {})},
        content=json.dumps(payload).encode("utf-8"),
        request=httpx.Request("POST", f"https://example.com{path}"),
    )


def _streaming_json_response(
    status_code: int,
    payload: object,
    *,
    headers: dict[str, str] | None = None,
    path: str,
) -> httpx.Response:
    return httpx.Response(
        status_code,
        headers={"Content-Type": "application/json", **(headers or {})},
        stream=httpx.ByteStream(json.dumps(payload).encode("utf-8")),
        request=httpx.Request("POST", f"https://example.com{path}"),
    )
