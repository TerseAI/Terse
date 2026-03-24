# ruff: noqa: E501
from __future__ import annotations

import base64
import json
import re
import textwrap
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

import httpx
from click.testing import CliRunner
from terse_cli._generate import CodegenInput, SnowflakeInstanceData, ToolDefinition, render_generated_module
from terse_cli._package import PackagingError
from terse_cli.cli import cli

_ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*m")


def _event_json(*, formatted_content: str = "Manual trigger") -> str:
    return json.dumps(
        {
            "integrationType": "cron_job",
            "eventType": "manual",
            "formattedContent": formatted_content,
            "debugLog": "Manual trigger",
        }
    )


def _runtime_main_source(
    body: str,
    *,
    extra: str = "",
    job_name: str = "demo-job",
    trigger_block: str | None = None,
    filter_name: str | None = None,
    generated_imports: str = "from terse_generated import Schedule",
    skills_block: str = "[]",
) -> str:
    trigger_lines = trigger_block or '[Schedule.cron("0 9 * * 1")]'
    lines = [
        "from pathlib import Path",
        "",
        "from terse_sdk import CronJobInputEvent, Terse, TerseAgent",
        generated_imports,
    ]
    if extra:
        lines.extend(["", textwrap.dedent(extra).strip()])

    lines.extend(
        [
            "",
            "app = Terse()",
            "",
            "",
            "@app.job(",
            f"    name={job_name!r},",
            f"    triggers={trigger_lines},",
            f"    skills={skills_block},",
        ]
    )
    if filter_name:
        lines.append(f"    filter={filter_name},")
    lines.extend(
        [
            ")",
            "def handle(event: CronJobInputEvent, agent: TerseAgent) -> None:",
            textwrap.indent(textwrap.dedent(body).strip(), "    "),
            "",
        ]
    )
    return "\n".join(lines)


def _plain_output(output: str) -> str:
    return _ANSI_ESCAPE_RE.sub("", output)


def _streaming_json_response(status_code: int, payload: object, *, path: str) -> httpx.Response:
    return httpx.Response(
        status_code,
        headers={"Content-Type": "application/json"},
        stream=httpx.ByteStream(json.dumps(payload).encode("utf-8")),
        request=httpx.Request("POST", f"https://example.com{path}"),
    )


def _write_runtime_project(
    main_source: str,
    *,
    api_key: str | None = "terse_test_key",
    gitignore: str = "",
    codegen_input: CodegenInput | None = None,
) -> None:
    Path("src").mkdir(parents=True, exist_ok=True)
    Path("pyproject.toml").write_text("[project]\nname = 'demo'\nversion = '0.1.0'\n", encoding="utf-8")
    Path("src/terse_generated.py").write_text(
        render_generated_module(codegen_input or CodegenInput()),
        encoding="utf-8",
    )
    Path("src/main.py").write_text(main_source, encoding="utf-8")
    if api_key is not None:
        Path(".env").write_text(f"TERSE_API_KEY={api_key}\n", encoding="utf-8")
    if gitignore:
        Path(".gitignore").write_text(gitignore, encoding="utf-8")


class _FakeSession:
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self.closed = False

    def close(self) -> None:
        self.closed = True


class _FakeEventSource:
    def __init__(self, response: httpx.Response) -> None:
        self.response = response

    def __enter__(self) -> _FakeEventSource:
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> bool:
        return False

    def iter_sse(self):
        return iter(())


class RuntimeCommandTests(unittest.TestCase):
    def setUp(self) -> None:
        self.runner = CliRunner()

    def test_integrate_opens_browser(self) -> None:
        with patch("terse_cli.commands.integrate.click.launch", return_value=True) as launch:
            result = self.runner.invoke(cli, ["integrate"])
        output = _plain_output(result.output)

        self.assertEqual(result.exit_code, 0, result.output)
        launch.assert_called_once()
        self.assertIn("Opened in your default browser.", output)

    def test_integrate_falls_back_to_printed_url(self) -> None:
        with patch("terse_cli.commands.integrate.click.launch", return_value=False):
            result = self.runner.invoke(cli, ["integrate"])
        output = _plain_output(result.output)

        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("Could not open browser automatically.", output)
        self.assertIn("/app/integrations", output)

    def test_run_executes_job_with_inline_event(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source("Path('ran.txt').write_text(event.formatted_content, encoding='utf-8')")
            )

            result = self.runner.invoke(cli, ["run", "--event", _event_json(formatted_content="Inline event")])
            output = _plain_output(result.output)

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertEqual(Path("ran.txt").read_text(encoding="utf-8"), "Inline event")
            self.assertIn('Job "demo-job" completed successfully.', output)

    def test_run_executes_job_from_event_file(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source("Path('ran.txt').write_text(event.debug_log, encoding='utf-8')")
            )
            Path("event.json").write_text(_event_json(), encoding="utf-8")

            result = self.runner.invoke(cli, ["run", "--event-file", "event.json"])

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertEqual(Path("ran.txt").read_text(encoding="utf-8"), "Manual trigger")

    def test_run_requires_event_input(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(_runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"))

            result = self.runner.invoke(cli, ["run"])
            output = _plain_output(result.output)

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("--event <json> or --event-file <path> is required.", output)
            self.assertIn("Use `terse test`", output)

    def test_run_rejects_invalid_json(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(_runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"))

            result = self.runner.invoke(cli, ["run", "--event", "not-json"])
            output = _plain_output(result.output)

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("--event value is not valid JSON.", output)

    def test_run_reports_missing_job(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(_runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"))

            result = self.runner.invoke(cli, ["run", "missing-job", "--event", _event_json()])
            output = _plain_output(result.output)

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn('Job "missing-job" not found.', output)

    def test_run_prompts_when_multiple_jobs_exist(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                textwrap.dedent(
                    """
                    from pathlib import Path

                    from terse_sdk import CronJobInputEvent, Terse, TerseAgent
                    from terse_generated import Schedule

                    app = Terse()


                    @app.job(name="first-job", triggers=[Schedule.cron("0 9 * * 1")], skills=[])
                    def first(event: CronJobInputEvent, agent: TerseAgent) -> None:
                        Path("selected.txt").write_text("first", encoding="utf-8")


                    @app.job(name="second-job", triggers=[Schedule.cron("0 10 * * 1")], skills=[])
                    def second(event: CronJobInputEvent, agent: TerseAgent) -> None:
                        Path("selected.txt").write_text("second", encoding="utf-8")
                    """
                ).strip()
                + "\n"
            )

            with patch("terse_cli._loader.prompt_select", side_effect=lambda message, choices: choices[1][1]):
                result = self.runner.invoke(cli, ["run", "--event", _event_json()])

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertEqual(Path("selected.txt").read_text(encoding="utf-8"), "second")

    def test_run_respects_filter_skip(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source(
                    "Path('ran.txt').write_text('ran', encoding='utf-8')",
                    extra=textwrap.dedent(
                        """
                        def allow_run(event: CronJobInputEvent) -> bool:
                            return False
                        """
                    ).strip(),
                    filter_name="allow_run",
                )
            )

            result = self.runner.invoke(cli, ["run", "--event", _event_json()])
            output = _plain_output(result.output)

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertFalse(Path("ran.txt").exists())
            self.assertIn('Job "demo-job" skipped (filter returned false).', output)

    def test_run_attaches_generated_tools_before_handler_execution(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source(
                    "Path('tool.json').write_text(json.dumps(agent.tools.snowflake.execute_query(query='select 1').model_dump()), encoding='utf-8')",
                    extra="import json",
                    generated_imports="from terse_generated import Schedule, Snowflake",
                    skills_block="[Snowflake.skill()]",
                ),
                codegen_input=CodegenInput(
                    snowflake=[SnowflakeInstanceData(id="snowflake_1", display_name="acme-prod")],
                    tools=[
                        ToolDefinition(
                            name="snowflakeExecuteQuery",
                            display_name="Execute query",
                            description="Execute Snowflake query.",
                            integration="snowflake",
                            is_read_only=True,
                        )
                    ],
                ),
            )

            with patch(
                "terse_sdk.runtime.TerseAgent.execute_tool",
                return_value={"success": True, "rowCount": 1, "columns": ["value"], "rows": [{"value": 1}]},
            ) as execute_tool:
                result = self.runner.invoke(cli, ["run", "--event", _event_json()])

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertEqual(
                json.loads(Path("tool.json").read_text(encoding="utf-8")),
                {"actions": None, "columns": ["value"], "rowCount": 1.0, "rows": [{"value": 1}], "success": True},
            )
            execute_tool.assert_called_once_with(
                "snowflakeExecuteQuery",
                {"integrationId": "snowflake_1", "query": "select 1"},
            )

    def test_test_command_runs_single_cron_trigger_without_api_key(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source(
                    "Path('session.txt').write_text(str(agent.session_id), encoding='utf-8')",
                ),
                api_key=None,
            )

            result = self.runner.invoke(cli, ["test"])
            output = _plain_output(result.output)

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertEqual(Path("session.txt").read_text(encoding="utf-8"), "None")
            self.assertIn("No TERSE_API_KEY found; running locally without session logging.", output)

    def test_test_command_uses_session_stream_when_api_key_exists(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source(
                    "Path('session.txt').write_text(str(agent.session_id), encoding='utf-8')",
                )
            )
            session = _FakeSession("session_123")

            with patch("terse_cli.commands.test.open_session_stream", return_value=session):
                result = self.runner.invoke(cli, ["test"])

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertEqual(Path("session.txt").read_text(encoding="utf-8"), "session_123")
            self.assertTrue(session.closed)

    def test_test_command_debug_logs_agent_run_request_details_on_backend_error(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source(
                    """
                    for _chunk in agent.run("hello from debug mode", event):
                        pass
                    """
                )
            )
            session = _FakeSession("session_123")
            event_source = _FakeEventSource(
                _streaming_json_response(
                    400,
                    {"error": "Invalid request body"},
                    path="/sdk/agent-run",
                )
            )

            with (
                patch("terse_cli.commands.test.open_session_stream", return_value=session),
                patch("terse_sdk.runtime.connect_sse", return_value=event_source),
            ):
                result = self.runner.invoke(cli, ["--debug", "test"])
                output = _plain_output(result.output)

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("Debug logging enabled.", output)
            self.assertIn("HTTP POST", output)
            self.assertIn("/sdk/agent-run", output)
            self.assertIn('"integrationType": "cron_job"', output)
            self.assertIn('"formattedContent": "This is a manually triggered event for a cron trigger', output)
            self.assertIn("Response 400 Bad Request for /sdk/agent-run", output)
            self.assertIn("Invalid request body", output)

    def test_test_command_attaches_generated_tools_before_handler_execution(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source(
                    "Path('tool.json').write_text(json.dumps(agent.tools.snowflake.explain_query(query='select 1').model_dump()), encoding='utf-8')",
                    extra="import json",
                    generated_imports="from terse_generated import Schedule, Snowflake",
                    skills_block="[Snowflake.skill()]",
                ),
                api_key=None,
                codegen_input=CodegenInput(
                    snowflake=[SnowflakeInstanceData(id="snowflake_1", display_name="acme-prod")],
                    tools=[
                        ToolDefinition(
                            name="snowflakeExplainQuery",
                            display_name="Explain query",
                            description="Explain Snowflake query.",
                            integration="snowflake",
                            is_read_only=True,
                        )
                    ],
                ),
            )

            with patch(
                "terse_sdk.runtime.TerseAgent.execute_tool",
                return_value={
                    "success": True,
                    "rowCount": 1,
                    "columns": ["operation"],
                    "explainPlan": [{"operation": "scan"}],
                },
            ) as execute_tool:
                result = self.runner.invoke(cli, ["test"])

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertEqual(
                json.loads(Path("tool.json").read_text(encoding="utf-8")),
                {
                    "actions": None,
                    "columns": ["operation"],
                    "explainPlan": [{"operation": "scan"}],
                    "rowCount": 1.0,
                    "success": True,
                },
            )
            execute_tool.assert_called_once_with(
                "snowflakeExplainQuery",
                {"integrationId": "snowflake_1", "query": "select 1"},
            )

    def test_test_command_prompts_for_multiple_cron_triggers(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source(
                    "Path('debug.txt').write_text(event.formatted_content, encoding='utf-8')",
                    trigger_block='[Schedule.cron("0 9 * * 1"), Schedule.cron("0 10 * * 1")]',
                ),
                api_key=None,
            )

            with patch("terse_cli.commands.test.prompt_select", side_effect=lambda message, choices: choices[1][1]):
                result = self.runner.invoke(cli, ["test"])

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertIn("schedule: 0 10 * * 1", Path("debug.txt").read_text(encoding="utf-8"))

    def test_test_command_requires_cron_trigger(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source(
                    "Path('ran.txt').write_text('ran', encoding='utf-8')",
                    trigger_block="[]",
                ),
                api_key=None,
            )

            result = self.runner.invoke(cli, ["test"])
            output = _plain_output(result.output)

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("No cron triggers found for this job.", output)

    def test_test_command_reports_missing_jobs(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project("from terse_sdk import Terse\napp = Terse()\n", api_key=None)

            result = self.runner.invoke(cli, ["test"])
            output = _plain_output(result.output)

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("No jobs found.", output)

    def test_deploy_requires_api_key(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"), api_key=None
            )

            result = self.runner.invoke(cli, ["deploy"])
            output = _plain_output(result.output)

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("No TERSE_API_KEY found in .env.", output)

    def test_deploy_reports_empty_archive_errors(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(_runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"))

            with patch(
                "terse_cli.commands.deploy.build_deploy_archive",
                side_effect=PackagingError("No files found to deploy."),
            ):
                result = self.runner.invoke(cli, ["deploy"])
                output = _plain_output(result.output)

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("No files found to deploy.", output)

    def test_deploy_reports_missing_jobs(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project("from terse_sdk import Terse\napp = Terse()\n")

            result = self.runner.invoke(cli, ["deploy"])
            output = _plain_output(result.output)

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("No jobs found.", output)

    def test_deploy_builds_expected_payload_and_reports_results(self) -> None:
        with self.runner.isolated_filesystem():
            _write_runtime_project(
                _runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"),
                gitignore="ignored.txt\nignored_dir/\n",
            )
            Path("kept.txt").write_text("keep", encoding="utf-8")
            Path("ignored.txt").write_text("ignore", encoding="utf-8")
            Path("ignored_dir").mkdir()
            Path("ignored_dir/secret.txt").write_text("ignore", encoding="utf-8")
            Path(".venv").mkdir()
            Path(".venv/pyvenv.cfg").write_text("ignore", encoding="utf-8")
            Path("dist").mkdir()
            Path("dist/output.txt").write_text("ignore", encoding="utf-8")

            def fake_request_json(
                path: str, api_key: str, *, method: str = "GET", params: dict[str, object] | None = None
            ) -> object:
                self.assertEqual(path, "/sdk/deploy")
                self.assertEqual(api_key, "terse_test_key")
                self.assertEqual(method, "POST")
                self.assertIsNotNone(params)
                self.assertIn("jobs", params)
                jobs = params["jobs"]
                self.assertIsInstance(jobs, list)
                self.assertEqual(len(jobs), 1)
                self.assertEqual(jobs[0]["jobName"], "demo-job")
                self.assertEqual(jobs[0]["triggers"][0]["integrationType"], "cron_job")
                self.assertEqual(jobs[0]["triggers"][0]["configType"], "time_trigger")

                encoded = str(params["sourceZipBase64"])
                with ZipFile(BytesIO(base64.b64decode(encoded))) as archive:
                    names = sorted(archive.namelist())

                self.assertIn("pyproject.toml", names)
                self.assertIn("src/main.py", names)
                self.assertIn("src/terse_generated.py", names)
                self.assertIn("kept.txt", names)
                self.assertNotIn(".env", names)
                self.assertNotIn("ignored.txt", names)
                self.assertNotIn("ignored_dir/secret.txt", names)
                self.assertNotIn(".venv/pyvenv.cfg", names)
                self.assertNotIn("dist/output.txt", names)

                return {
                    "success": True,
                    "results": [{"jobName": "demo-job", "automationId": "auto_123", "isUpdate": False}],
                    "removed": [{"name": "old-job", "id": "auto_old"}],
                }

            with patch("terse_cli.commands.deploy.request_json", side_effect=fake_request_json):
                result = self.runner.invoke(cli, ["deploy"])
                output = _plain_output(result.output)

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertIn("Deployed 1 job", output)
            self.assertIn('Created "demo-job" (auto_123)', output)
            self.assertIn("Removed 1 stale job", output)


if __name__ == "__main__":
    unittest.main()
