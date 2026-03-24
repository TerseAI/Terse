# ruff: noqa: E501
from __future__ import annotations

import json
import os
import sys
import unittest
from types import ModuleType, SimpleNamespace
from typing import Any
from unittest.mock import patch

import httpx
import terse_sdk.runtime as runtime_module
from terse_sdk import (
    CronJobInputEvent,
    EventType,
    MissingApiKeyError,
    SerializedEventInputEvent,
    Terse,
    TerseAgent,
    TerseApiError,
    clear_job_registry,
    deserialize_input_event,
    execute_registered_job,
    get_job_registry,
)
from terse_sdk.generated.models import (
    SdkAgentStreamEventDone,
    SdkAgentStreamEventFinalOutput,
    SdkAgentStreamEventText,
    SdkAgentStreamEventToolCallCompleted,
)


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


class RuntimeTests(unittest.TestCase):
    def setUp(self) -> None:
        clear_job_registry()

    def tearDown(self) -> None:
        clear_job_registry()

    def test_job_registration_and_registry_clear(self) -> None:
        app = Terse()

        @app.job(name="demo-job")
        def demo(event: CronJobInputEvent, agent: TerseAgent) -> None:
            _ = (event, agent)

        registry = get_job_registry()
        self.assertIn("demo-job", registry)
        self.assertIs(registry["demo-job"].handler, demo)

        clear_job_registry()
        self.assertEqual(get_job_registry(), {})

    def test_execute_registered_job_supports_sync_and_async_callables(self) -> None:
        sync_calls: list[str] = []
        async_calls: list[str] = []
        app = Terse()

        @app.job(name="sync-job")
        def sync_handler(event: CronJobInputEvent, agent: TerseAgent) -> None:
            _ = agent
            sync_calls.append(event.formatted_content)

        async def allow_async(event: CronJobInputEvent) -> bool:
            return event.event_type == "manual"

        @app.job(name="async-job", filter=allow_async)
        async def async_handler(event: CronJobInputEvent, agent: TerseAgent) -> None:
            _ = agent
            async_calls.append(event.debug_log)

        event = CronJobInputEvent(
            event_type="manual",
            formatted_content="hello",
            debug_log="world",
        )

        sync_job = get_job_registry()["sync-job"]
        async_job = get_job_registry()["async-job"]

        self.assertFalse(execute_registered_job(sync_job, event, agent=TerseAgent()))
        self.assertEqual(sync_calls, ["hello"])

        self.assertFalse(execute_registered_job(async_job, event, agent=TerseAgent()))
        self.assertEqual(async_calls, ["world"])

    def test_execute_registered_job_returns_true_when_filter_skips(self) -> None:
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

        self.assertTrue(skipped)
        self.assertEqual(calls, [])

    def test_deserialize_input_event_supports_camel_case_payloads(self) -> None:
        event = deserialize_input_event(
            {
                "integrationType": "cron_job",
                "eventType": "manual",
                "formattedContent": "Scheduled job",
                "debugLog": "cron",
            }
        )

        self.assertIsInstance(event, CronJobInputEvent)
        self.assertEqual(event.integration_type, "cron_job")
        self.assertEqual(event.formatted_content, "Scheduled job")

    def test_deserialize_input_event_falls_back_for_unknown_integrations(self) -> None:
        event = deserialize_input_event(
            {
                "integrationType": "unknown_service",
                "eventType": "manual",
                "formattedContent": "Unknown",
                "debugLog": "unknown",
            }
        )

        self.assertIsInstance(event, SerializedEventInputEvent)
        self.assertEqual(event.integration_type, "unknown_service")

    def test_agent_execute_tool_includes_session_and_run_headers(self) -> None:
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

        self.assertEqual(result, {"ok": True})
        self.assertEqual(fake_client.calls[0]["headers"]["X-Terse-Session-Id"], "session_123")
        self.assertEqual(fake_client.calls[0]["headers"]["X-Terse-Run-Id"], "run_123")
        self.assertEqual(fake_client.calls[0]["json"]["toolName"], "demo_tool")

    def test_agent_execute_tool_requires_api_key(self) -> None:
        with patch.dict(os.environ, {"TERSE_API_KEY": ""}, clear=False), self.assertRaises(MissingApiKeyError):
            TerseAgent().execute_tool("demo_tool")

    def test_agent_tools_lazy_attach_from_generated_module(self) -> None:
        created_agents: list[TerseAgent] = []
        fake_tools = SimpleNamespace(snowflake="snowflake-tools")
        generated_module = ModuleType("terse_generated")

        def create_tools(agent: TerseAgent) -> object:
            created_agents.append(agent)
            return fake_tools

        generated_module.create_tools = create_tools  # type: ignore[attr-defined]

        with patch.dict(sys.modules, {"terse_generated": generated_module}, clear=False):
            agent = TerseAgent()
            self.assertIs(agent.tools, fake_tools)
            self.assertIs(agent.tools, fake_tools)

        self.assertEqual(created_agents, [agent])

    def test_agent_tools_raise_clear_error_when_generated_module_is_missing(self) -> None:
        with (
            patch("terse_sdk.runtime._resolve_generated_tools_factory", return_value=None),
            self.assertRaises(AttributeError),
        ):
            _ = TerseAgent().tools

    def test_agent_run_streams_events_and_serializes_event_payload(self) -> None:
        captured: dict[str, object] = {}
        stream = _FakeEventSource(
            [
                SdkAgentStreamEventText(type="text", text="hello").model_dump_json(),
                SdkAgentStreamEventToolCallCompleted(
                    type="tool_call_completed",
                    toolCallCompleted=json.dumps({"tool": "demo_tool", "status": "completed"}),
                ).model_dump_json(),
                SdkAgentStreamEventFinalOutput(type="final_output", finalOutput="done").model_dump_json(),
                SdkAgentStreamEventDone(type="done").model_dump_json(),
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

        self.assertEqual(len(events), 3)
        self.assertEqual(events[-1].type, EventType.FINAL_OUTPUT)
        self.assertEqual(events[-1].finalOutput, "done")
        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["headers"]["Authorization"], "Bearer terse_test_key")
        self.assertEqual(captured["json"]["event"]["integrationType"], "cron_job")
        self.assertEqual(captured["json"]["event"]["formattedContent"], "Scheduled event")

    def test_agent_run_raises_on_failed_tool_call(self) -> None:
        stream = _FakeEventSource(
            [
                SdkAgentStreamEventToolCallCompleted(
                    type="tool_call_completed",
                    toolCallCompleted=json.dumps({"tool": "demo_tool", "status": "failed"}),
                ).model_dump_json(),
                SdkAgentStreamEventDone(type="done").model_dump_json(),
            ]
        )

        with (
            patch.dict(os.environ, {"TERSE_API_KEY": "terse_test_key"}, clear=False),
            patch("terse_sdk.runtime.connect_sse", return_value=stream),
            self.assertRaises(TerseApiError),
        ):
            list(TerseAgent().run("hello"))

    def test_agent_run_and_wait_returns_final_output(self) -> None:
        with patch.object(
            TerseAgent,
            "run",
            return_value=iter(
                [
                    SdkAgentStreamEventText(type="text", text="thinking"),
                    SdkAgentStreamEventFinalOutput(type="final_output", finalOutput="done"),
                ]
            ),
        ):
            result = TerseAgent().run_and_wait("hello")

        self.assertEqual(result, "done")

    def test_agent_run_and_wait_returns_none_when_no_final_output_arrives(self) -> None:
        with patch.object(TerseAgent, "run", return_value=iter([])):
            result = TerseAgent().run_and_wait("hello")

        self.assertIsNone(result)

    def test_agent_run_and_wait_propagates_errors(self) -> None:
        with patch.object(TerseAgent, "run", side_effect=TerseApiError("boom")), self.assertRaises(TerseApiError):
            TerseAgent().run_and_wait("hello")

    def test_assert_sse_response_reads_streaming_json_error_payload(self) -> None:
        response = _streaming_json_response(
            200,
            {"success": False, "error": "backend unavailable"},
            path="/sdk/agent-run",
        )

        with self.assertRaises(TerseApiError) as exc_info:
            runtime_module._assert_sse_response(response, "/sdk/agent-run")

        self.assertIn("backend unavailable", str(exc_info.exception))

    def test_assert_sse_response_reads_streaming_error_detail_on_http_error(self) -> None:
        response = _streaming_json_response(
            401,
            {"error": "unauthorized"},
            path="/sdk/agent-run",
        )

        with self.assertRaises(TerseApiError) as exc_info:
            runtime_module._assert_sse_response(response, "/sdk/agent-run")

        self.assertIn("unauthorized", str(exc_info.exception))


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


if __name__ == "__main__":
    unittest.main()
