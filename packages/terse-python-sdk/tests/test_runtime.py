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
    ConfigType,
    CronTrigger,
    Done,
    EventType,
    FinalOutput,
    IntegrationType,
    MissingApiKeyError,
    RunStarted,
    SdkAgentStreamEvent,
    SDKTrigger,
    SkillConfig,
    SlackChannelType,
    SlackListChannelsToolOutput,
    SlackListUsersToolOutput,
    SlackMessageTrigger,
    SlackReadConversationToolOutput,
    SlackSendMessageToolOutput,
    SlackTrigger,
    Terse,
    TerseAgent,
    TerseApiError,
    TerseRuntimeError,
    Text,
    ToolApprovalRequest,
    ToolApprovalRequested,
    ToolCallCompleted,
    Trigger,
    TriggerConfig,
    clear_job_registry,
    create_sdk_trigger,
    deserialize_input_event,
    deserialize_trigger_event,
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
    def demo(event: SDKTrigger[CronTrigger], agent: TerseAgent) -> None:
        _ = (event, agent)

    registry = get_job_registry()
    assert "demo-job" in registry
    assert registry["demo-job"].handler is demo

    clear_job_registry()
    assert get_job_registry() == {}


def test_job_registration_preserves_tool_approvals() -> None:
    app = Terse()

    @app.job(name="demo-job", tool_approvals=["attio_upsert_record"])
    def demo(event: SDKTrigger[CronTrigger], agent: TerseAgent) -> None:
        _ = (event, agent)

    assert get_job_registry()["demo-job"].tool_approvals == ["attio_upsert_record"]


def test_execute_registered_job_supports_sync_callables() -> None:
    handler_calls: list[str] = []
    filter_calls: list[str] = []
    app = Terse()

    def allow_sync(event: SDKTrigger[CronTrigger]) -> bool:
        filter_calls.append(event.event_type)
        return bool(event.is_manual_trigger)

    @app.job(name="sync-job", filter=allow_sync)
    def sync_handler(event: SDKTrigger[CronTrigger], agent: TerseAgent) -> None:
        _ = agent
        handler_calls.append(event.manual_context or "")

    event = CronTrigger(
        event_type="cron",
        input_id="input_123",
        is_manual_trigger=True,
        manual_context="hello",
    )

    sync_job = get_job_registry()["sync-job"]

    assert not execute_registered_job(sync_job, event, agent=TerseAgent())
    assert [value.root for value in filter_calls] == ["cron"]
    assert handler_calls == ["hello"]


def test_execute_registered_job_returns_true_when_filter_skips() -> None:
    calls: list[str] = []
    app = Terse()

    def never(event: SDKTrigger[CronTrigger]) -> bool:
        _ = event
        return False

    @app.job(name="demo-job", filter=never)
    def demo(event: SDKTrigger[CronTrigger], agent: TerseAgent) -> None:
        _ = (event, agent)
        calls.append("ran")

    skipped = execute_registered_job(
        get_job_registry()["demo-job"],
        CronTrigger(
            event_type="cron",
            input_id="input_123",
            is_manual_trigger=True,
            manual_context="demo",
        ),
        agent=TerseAgent(),
    )

    assert skipped
    assert calls == []


def test_deserialize_trigger_event_supports_camel_case_payloads() -> None:
    event = deserialize_trigger_event(
        {
            "integrationType": "cron_job",
            "eventType": "cron",
            "inputId": "input_123",
            "isManualTrigger": True,
            "manualContext": "Scheduled job",
        }
    )

    assert isinstance(event, CronTrigger)
    assert event.integration_type == "cron_job"
    assert event.input_id == "input_123"
    assert event.manual_context == "Scheduled job"


def test_deserialize_trigger_event_enriches_slack_metadata() -> None:
    event = deserialize_trigger_event(
        {
            "integrationType": "slack",
            "eventType": "message",
            "channelId": "C123",
            "channelName": "alerts",
            "userId": "U123",
            "userName": "Olivia",
            "text": "Deploy finished",
            "timestamp": "1710000000.100000",
            "threadTs": "1710000000.000001",
            "threadTimestamp": "1710000000.000001",
            "teamId": "T123",
            "permalink": "https://slack.example/message",
            "channelType": "im",
            "blocks": [
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": "Deploy finished"},
                }
            ],
            "attachments": [
                {
                    "fallback": "fallback text",
                    "author_name": "Terse",
                }
            ],
            "files": [
                {
                    "id": "F123",
                    "name": "deploy.log",
                    "url_private": "https://files.example/deploy.log",
                }
            ],
        }
    )

    assert isinstance(event, SlackMessageTrigger)
    assert event.channel_id == "C123"
    assert event.channel_name == "alerts"
    assert event.user_id == "U123"
    assert event.user_name == "Olivia"
    assert event.text == "Deploy finished"
    assert event.timestamp == "1710000000.100000"
    assert event.thread_ts == "1710000000.000001"
    assert event.thread_timestamp == "1710000000.000001"
    assert event.team_id == "T123"
    assert event.permalink == "https://slack.example/message"
    assert event.channel_type == SlackChannelType.im
    assert event.blocks == [{"type": "section", "text": {"type": "mrkdwn", "text": "Deploy finished"}}]
    assert event.attachments is not None
    assert event.attachments[0]["author_name"] == "Terse"
    assert event.files is not None
    assert event.files[0]["url_private"] == "https://files.example/deploy.log"


def test_deserialize_trigger_event_unwraps_generated_trigger_event_root_models() -> None:
    payload = {
        "integrationType": "slack",
        "eventType": "message",
        "channelId": "C123",
        "channelName": "alerts",
        "userId": "U123",
        "userName": "Olivia",
        "text": "Deploy finished",
        "timestamp": "1710000000.100000",
        "threadTs": "1710000000.000001",
        "threadTimestamp": "1710000000.000001",
        "teamId": "T123",
        "permalink": "https://slack.example/message",
        "channelType": "im",
        "blocks": None,
        "attachments": None,
        "files": None,
    }

    generated_event = Trigger.model_validate(payload)

    event = deserialize_trigger_event(generated_event)

    assert isinstance(event, SlackMessageTrigger)
    assert event.channel_id == "C123"
    assert event.event_type == "message"


def test_deserialize_trigger_event_unwraps_generated_integration_root_models() -> None:
    payload = {
        "integrationType": "slack",
        "eventType": "message",
        "channelId": "C123",
        "channelName": "alerts",
        "userId": "U123",
        "userName": "Olivia",
        "text": "Deploy finished",
        "timestamp": "1710000000.100000",
        "threadTs": "1710000000.000001",
        "threadTimestamp": "1710000000.000001",
        "teamId": "T123",
        "permalink": "https://slack.example/message",
        "channelType": "im",
        "blocks": None,
        "attachments": None,
        "files": None,
    }

    generated_event = SlackTrigger.model_validate(payload)

    event = deserialize_trigger_event(generated_event)

    assert isinstance(event, SlackMessageTrigger)
    assert event.channel_id == "C123"
    assert event.event_type == "message"


def test_deserialize_trigger_event_rejects_unknown_integrations() -> None:
    with pytest.raises(TerseRuntimeError):
        deserialize_trigger_event(
            {
                "integrationType": "unknown_service",
                "eventType": "manual",
            }
        )


def test_slack_tool_output_models_accept_backend_shapes() -> None:
    send_result = SlackSendMessageToolOutput.model_validate(
        {
            "success": True,
            "message_ts": "1710000000.100000",
            "channel": "#alerts",
            "thread_ts": "1710000000.100000",
            "summary": 'text message sent to #alerts: "Deploy finished"',
            "has_blocks": False,
        }
    )
    channels_result = SlackListChannelsToolOutput.model_validate(
        {
            "success": True,
            "channels": [
                {
                    "id": "C123",
                    "name": "#alerts",
                    "isPrivate": False,
                    "isIm": False,
                    "isMpim": False,
                    "userId": None,
                }
            ],
            "count": 1,
            "nextCursor": "cursor_123",
            "hasMore": True,
        }
    )
    users_result = SlackListUsersToolOutput.model_validate(
        {
            "success": True,
            "users": [{"id": "U123", "name": "Olivia"}],
            "count": 1,
        }
    )
    conversation_result = SlackReadConversationToolOutput.model_validate(
        {
            "success": True,
            "channelId": "C123",
            "channelName": "#alerts",
            "messages": [
                {
                    "userId": "U123",
                    "userName": "Olivia",
                    "text": "Deploy finished",
                    "timestamp": "1710000000.100000",
                    "threadTs": "1710000000.100000",
                }
            ],
            "count": 1,
            "hasMore": False,
            "nextCursor": None,
        }
    )

    assert send_result.message_ts == "1710000000.100000"
    assert send_result.has_blocks is False
    assert channels_result.next_cursor is not None
    assert channels_result.next_cursor == "cursor_123"
    assert channels_result.channels[0].is_private is False
    assert channels_result.channels[0].user_id is None
    assert users_result.users[0].name == "Olivia"
    assert conversation_result.channel_id == "C123"
    assert conversation_result.messages[0].user_name == "Olivia"


def test_agent_execute_tool_includes_session_and_run_headers() -> None:
    fake_client = _FakeClient(
        _json_response(
            200,
            {"success": True, "result": {"ok": True}},
            path="/sdk/tool-execute",
        )
    )

    with (
        patch.dict(
            os.environ,
            {"TERSE_API_KEY": "terse_test_key", "TERSE_RUN_ID": "run_123"},
            clear=False,
        ),
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


def test_execute_registered_job_uses_trigger_configs_for_manual_tools() -> None:
    seen_tools: list[object] = []
    seen_manual_tool_configs: list[object] = []
    generated_module = ModuleType("terse_generated")

    def create_tools(agent: TerseAgent) -> object:
        seen_manual_tool_configs.extend(agent.manual_tool_configs or [])
        return SimpleNamespace(slack="slack-tools")

    generated_module.create_tools = create_tools  # type: ignore[attr-defined]

    job = runtime_module.RegisteredJob(
        name="trigger-only-manual-tools",
        handler=lambda event, agent: seen_tools.append(agent.tools.slack),
        triggers=[
            TriggerConfig(
                integration_id="slack_integration",
                integration_type=IntegrationType.slack,
                event_type="message",
                config_type=ConfigType.slack,
                config={"channelId": "C123"},
            )
        ],
        skills=[],
    )

    with patch.dict(sys.modules, {"terse_generated": generated_module}, clear=False):
        execute_registered_job(
            job,
            CronTrigger(
                event_type="cron",
                input_id="input_123",
                is_manual_trigger=True,
            ),
            agent=TerseAgent(),
        )

    assert seen_tools == ["slack-tools"]
    assert [config.integration_type for config in seen_manual_tool_configs] == [IntegrationType.slack]


def test_agent_tools_raise_clear_error_when_generated_module_is_missing() -> None:
    with (
        patch("terse_sdk.runtime._resolve_generated_tools_factory", return_value=None),
        pytest.raises(TerseRuntimeError),
    ):
        _ = TerseAgent().tools


def test_stream_event_exports_include_sdk_run_events() -> None:
    assert terse_types.RunStarted is RunStarted
    assert terse_types.ToolApprovalRequested is ToolApprovalRequested
    assert terse_types.ToolApprovalRequest is ToolApprovalRequest
    assert EventType.RUN_STARTED == "run_started"
    assert EventType.TOOL_APPROVAL_REQUESTED == "tool_approval_requested"


def test_run_started_event_supports_backend_payload() -> None:
    event = SdkAgentStreamEvent.model_validate({"type": "run_started", "runId": "run_123"}).root

    assert isinstance(event, RunStarted)
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

    assert isinstance(event, ToolApprovalRequested)
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
                CronTrigger(
                    event_type="cron",
                    input_id="input_123",
                    is_manual_trigger=True,
                    manual_context="Scheduled event",
                ),
            )
        )

    assert len(events) == 5
    assert isinstance(events[0], RunStarted)
    assert events[0].type == EventType.RUN_STARTED
    assert events[0].run_id == "run_123"
    assert isinstance(events[2], ToolApprovalRequested)
    assert events[2].type == EventType.TOOL_APPROVAL_REQUESTED
    assert events[2].tool_approval_requested.tool_name == "demo_tool"
    assert events[-1].type == EventType.FINAL_OUTPUT
    assert events[-1].final_output == "done"
    assert captured["method"] == "POST"
    assert captured["headers"]["Authorization"] == "Bearer terse_test_key"
    assert captured["json"]["event"]["integrationType"] == "cron_job"
    assert captured["json"]["event"]["inputId"] == "input_123"
    assert captured["json"]["event"]["manualContext"] == "Scheduled event"


def test_agent_run_does_not_promote_manual_tool_configs_to_skills() -> None:
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
                skills=[],
                manual_tool_configs=[
                    TriggerConfig(
                        integration_id="slack_integration",
                        integration_type=IntegrationType.slack,
                        event_type="message",
                        config_type=ConfigType.slack,
                        config={"channelId": "C123"},
                    )
                ],
            ).run("hello")
        )

    assert captured["json"]["skills"] == []


def test_agent_run_serializes_skills_as_flat_config_data() -> None:
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
                        integration_id="attio_integration",
                        integration_type=IntegrationType.attio,
                        config_type=ConfigType.attio_output,
                        config={"objectSlug": "people"},
                    )
                ]
            ).run("hello")
        )

    assert captured["json"]["skills"] == [
        {
            "integrationId": "attio_integration",
            "integrationType": "attio",
            "configType": "attio_output",
            "objectSlug": "people",
        }
    ]


def test_agent_run_raises_on_failed_tool_call() -> None:
    stream = _FakeEventSource(
        [
            ToolCallCompleted(
                type="tool_call_completed",
                tool_call_completed=json.dumps({"tool": "demo_tool", "status": "failed"}),
            ).model_dump_json(),
            Done(type="done").model_dump_json(),
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
                Text(type="text", text="thinking"),
                FinalOutput(type="final_output", final_output="done"),
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
        {
            "error": "Invalid request body",
            "details": ["`skills[0].config.objectSlug` is required"],
        },
        path="/sdk/agent-run",
    )

    with pytest.raises(TerseApiError) as exc_info:
        runtime_module._assert_sse_response(response, "/sdk/agent-run")

    assert "Invalid request body" in str(exc_info.value)
    assert "`skills[0].config.objectSlug` is required" in str(exc_info.value)


def test_sdk_trigger_delegates_attribute_access() -> None:
    trigger = CronTrigger(
        event_type="cron",
        input_id="input_123",
        is_manual_trigger=True,
        manual_context="hello",
    )
    sdk = SDKTrigger(trigger, "formatted text", "debug info")

    assert sdk.data is trigger
    assert sdk.formatted_content == "formatted text"
    assert sdk.debug_log == "debug info"
    assert sdk.event_type == trigger.event_type
    assert sdk.input_id == "input_123"
    assert sdk.is_manual_trigger is True
    assert sdk.manual_context == "hello"
    assert "SDKTrigger(" in repr(sdk)


def test_sdk_trigger_raises_attribute_error_for_missing_attrs() -> None:
    trigger = CronTrigger(event_type="cron", input_id="input_123")
    sdk = SDKTrigger(trigger, "", "")

    with pytest.raises(AttributeError):
        _ = sdk.nonexistent_field


def test_create_sdk_trigger_from_dict() -> None:
    envelope = {
        "integrationType": "cron_job",
        "eventType": "cron",
        "formattedContent": "Scheduled job ran",
        "debugLog": "cron triggered at 12:00",
        "data": {
            "integrationType": "cron_job",
            "eventType": "cron",
            "inputId": "input_123",
            "isManualTrigger": True,
        },
    }

    sdk = create_sdk_trigger(envelope)

    assert isinstance(sdk, SDKTrigger)
    assert isinstance(sdk.data, CronTrigger)
    assert sdk.formatted_content == "Scheduled job ran"
    assert sdk.debug_log == "cron triggered at 12:00"
    assert sdk.input_id == "input_123"


def test_create_sdk_trigger_from_json_string() -> None:
    envelope = json.dumps(
        {
            "integrationType": "cron_job",
            "eventType": "cron",
            "formattedContent": "cron fmt",
            "debugLog": "cron dbg",
            "data": {
                "integrationType": "cron_job",
                "eventType": "cron",
                "inputId": "input_456",
            },
        }
    )

    sdk = create_sdk_trigger(envelope)

    assert isinstance(sdk.data, CronTrigger)
    assert sdk.formatted_content == "cron fmt"
    assert sdk.debug_log == "cron dbg"
    assert sdk.input_id == "input_456"


def test_deserialize_input_event_matches_create_sdk_trigger() -> None:
    envelope = {
        "integrationType": "slack",
        "eventType": "message",
        "formattedContent": "Slack message",
        "debugLog": "slack debug",
        "data": {
            "integrationType": "slack",
            "eventType": "message",
            "channelId": "C123",
            "channelName": "general",
            "userId": "U123",
            "userName": "bot",
            "text": "hello",
            "timestamp": "1710000000.100000",
            "threadTs": "1710000000.000001",
            "threadTimestamp": "1710000000.000001",
            "teamId": "T1",
            "permalink": "https://example.com",
            "channelType": "channel",
            "blocks": None,
            "attachments": None,
            "files": None,
        },
    }

    sdk = deserialize_input_event(envelope)

    assert isinstance(sdk, SDKTrigger)
    assert isinstance(sdk.data, SlackMessageTrigger)
    assert sdk.formatted_content == "Slack message"
    assert sdk.debug_log == "slack debug"
    assert sdk.text == "hello"
    assert sdk.channel_id == "C123"


def test_execute_registered_job_wraps_raw_trigger_in_sdk_trigger() -> None:
    received_events: list[Any] = []
    app = Terse()

    @app.job(name="wrap-test")
    def handler(event: SDKTrigger[CronTrigger], agent: TerseAgent) -> None:
        received_events.append(event)

    raw = CronTrigger(
        event_type="cron",
        input_id="input_123",
        is_manual_trigger=True,
    )

    execute_registered_job(get_job_registry()["wrap-test"], raw, agent=TerseAgent())

    assert len(received_events) == 1
    assert isinstance(received_events[0], SDKTrigger)
    assert received_events[0].data is raw
    assert received_events[0].formatted_content == ""
    assert received_events[0].debug_log == ""


def test_execute_registered_job_passes_sdk_trigger_through() -> None:
    received_events: list[Any] = []
    app = Terse()

    @app.job(name="passthrough-test")
    def handler(event: SDKTrigger[CronTrigger], agent: TerseAgent) -> None:
        received_events.append(event)

    raw = CronTrigger(
        event_type="cron",
        input_id="input_123",
    )
    sdk_event = SDKTrigger(raw, "pre-formatted", "pre-debug")

    execute_registered_job(get_job_registry()["passthrough-test"], sdk_event, agent=TerseAgent())

    assert len(received_events) == 1
    assert received_events[0] is sdk_event
    assert received_events[0].formatted_content == "pre-formatted"
    assert received_events[0].debug_log == "pre-debug"


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
