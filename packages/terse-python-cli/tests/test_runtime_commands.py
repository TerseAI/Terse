# ruff: noqa: E501
from __future__ import annotations

import base64
import json
import re
import textwrap
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

import httpx
import pytest
from click.testing import CliRunner
from terse_cli._generate import (
    CodegenInput,
    render_generated_module,
)
from terse_cli._package import PackagingError
from terse_cli._project import DependencyInstallResult
from terse_cli.cli import cli
from terse_cli.commands import test as test_command_module

_ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*m")


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


@pytest.fixture(autouse=True)
def mock_ty_check():
    result = DependencyInstallResult(succeeded=True, command=("uv", "run", "ty", "check"))
    with patch("terse_cli.commands.test.run_ty_check", return_value=result):
        yield


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
    tool_approvals_block: str | None = None,
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
    if tool_approvals_block is not None:
        lines.append(f"    tool_approvals={tool_approvals_block},")
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


def test_integrate_opens_browser(runner: CliRunner) -> None:
    with patch("terse_cli.commands.integrate.click.launch", return_value=True) as launch:
        result = runner.invoke(cli, ["integrate"])
    output = _plain_output(result.output)

    assert result.exit_code == 0, result.output
    launch.assert_called_once()
    assert "Opened in your default browser." in output


def test_integrate_falls_back_to_printed_url(runner: CliRunner) -> None:
    with patch("terse_cli.commands.integrate.click.launch", return_value=False):
        result = runner.invoke(cli, ["integrate"])
    output = _plain_output(result.output)

    assert result.exit_code == 0, result.output
    assert "Could not open browser automatically." in output
    assert "/app/integrations" in output


def test_run_executes_job_with_inline_event(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(
            _runtime_main_source("Path('ran.txt').write_text(event.formatted_content, encoding='utf-8')")
        )

        result = runner.invoke(cli, ["run", "--event", _event_json(formatted_content="Inline event")])
        output = _plain_output(result.output)

        assert result.exit_code == 0, result.output
        assert Path("ran.txt").read_text(encoding="utf-8") == "Inline event"
        assert 'Job "demo-job" completed successfully.' in output


def test_run_executes_job_from_event_file(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(_runtime_main_source("Path('ran.txt').write_text(event.debug_log, encoding='utf-8')"))
        Path("event.json").write_text(_event_json(), encoding="utf-8")

        result = runner.invoke(cli, ["run", "--event-file", "event.json"])

        assert result.exit_code == 0, result.output
        assert Path("ran.txt").read_text(encoding="utf-8") == "Manual trigger"


def test_run_requires_event_input(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(_runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"))

        result = runner.invoke(cli, ["run"])
        output = _plain_output(result.output)

        assert result.exit_code != 0
        assert "--event <json> or --event-file <path> is required." in output
        assert "Use `terse test`" in output


def test_run_rejects_invalid_json(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(_runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"))

        result = runner.invoke(cli, ["run", "--event", "not-json"])
        output = _plain_output(result.output)

        assert result.exit_code != 0
        assert "--event value is not valid JSON." in output


def test_run_reports_missing_job(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(_runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"))

        result = runner.invoke(cli, ["run", "missing-job", "--event", _event_json()])
        output = _plain_output(result.output)

        assert result.exit_code != 0
        assert 'Job "missing-job" not found.' in output


def test_run_prompts_when_multiple_jobs_exist(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
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

        with patch(
            "terse_cli._loader.prompt_select",
            side_effect=lambda message, choices: choices[1][1],
        ):
            result = runner.invoke(cli, ["run", "--event", _event_json()])

        assert result.exit_code == 0, result.output
        assert Path("selected.txt").read_text(encoding="utf-8") == "second"


def test_run_respects_filter_skip(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
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

        result = runner.invoke(cli, ["run", "--event", _event_json()])
        output = _plain_output(result.output)

        assert result.exit_code == 0, result.output
        assert not Path("ran.txt").exists()
        assert 'Job "demo-job" skipped (filter returned false).' in output


def test_test_command_runs_single_cron_trigger_without_api_key(
    runner: CliRunner,
) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(
            _runtime_main_source("Path('session.txt').write_text(str(agent.session_id), encoding='utf-8')"),
            api_key=None,
        )

        result = runner.invoke(cli, ["test"])
        output = _plain_output(result.output)

        assert result.exit_code == 0, result.output
        assert Path("session.txt").read_text(encoding="utf-8") == "None"
        assert "No TERSE_API_KEY found; running locally without session logging." in output


def test_test_command_uses_session_stream_when_api_key_exists(
    runner: CliRunner,
) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(
            _runtime_main_source("Path('session.txt').write_text(str(agent.session_id), encoding='utf-8')")
        )
        session = _FakeSession("session_123")

        with patch("terse_cli.commands.test.open_session_stream", return_value=session) as open_session_stream:
            result = runner.invoke(cli, ["test"])

        assert result.exit_code == 0, result.output
        assert Path("session.txt").read_text(encoding="utf-8") == "session_123"
        assert session.closed
        open_session_stream.assert_called_once_with("terse_test_key", None)


def test_test_command_verbose_enables_session_stream_output(
    runner: CliRunner,
) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(
            _runtime_main_source("Path('session.txt').write_text(str(agent.session_id), encoding='utf-8')")
        )
        session = _FakeSession("session_123")

        with patch("terse_cli.commands.test.open_session_stream", return_value=session) as open_session_stream:
            result = runner.invoke(cli, ["test", "--verbose"])

        assert result.exit_code == 0, result.output
        assert Path("session.txt").read_text(encoding="utf-8") == "session_123"
        assert session.closed
        open_session_stream.assert_called_once_with("terse_test_key", test_command_module.log_stream_event)


def test_test_command_reports_missing_uv_before_running(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(
            _runtime_main_source("Path('session.txt').write_text(str(agent.session_id), encoding='utf-8')"),
            api_key=None,
        )
        ty_result = DependencyInstallResult(
            succeeded=False,
            command=("uv", "run", "ty", "check"),
            details="[Errno 2] No such file or directory: 'uv'",
        )

        with patch("terse_cli.commands.test.run_ty_check", return_value=ty_result):
            result = runner.invoke(cli, ["test"])
            output = _plain_output(result.output)

        assert result.exit_code != 0
        assert "`uv` is not installed." in output
        assert "then run `uv sync`." in output
        assert "rerun `terse test`." in output


def test_test_command_debug_logs_agent_run_request_details_on_backend_error(
    runner: CliRunner,
) -> None:
    with runner.isolated_filesystem():
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
            result = runner.invoke(cli, ["--debug", "test"])
            output = _plain_output(result.output)

        assert result.exit_code != 0
        assert "Debug logging enabled." in output
        assert "HTTP POST" in output
        assert "/sdk/agent-run" in output
        assert '"integrationType": "cron_job"' in output
        assert '"formattedContent": "This is a manually triggered event for a cron trigger' in output
        assert "Response 400 Bad Request for /sdk/agent-run" in output
        assert "Invalid request body" in output


def test_test_command_prompts_for_multiple_cron_triggers(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(
            _runtime_main_source(
                "Path('debug.txt').write_text(event.formatted_content, encoding='utf-8')",
                trigger_block='[Schedule.cron("0 9 * * 1"), Schedule.cron("0 10 * * 1")]',
            ),
            api_key=None,
        )

        with patch(
            "terse_cli.commands.test.prompt_select",
            side_effect=lambda message, choices: choices[1][1],
        ):
            result = runner.invoke(cli, ["test"])

        assert result.exit_code == 0, result.output
        assert "schedule: 0 10 * * 1" in Path("debug.txt").read_text(encoding="utf-8")


def test_test_command_requires_cron_trigger(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(
            _runtime_main_source(
                "Path('ran.txt').write_text('ran', encoding='utf-8')",
                trigger_block="[]",
            ),
            api_key=None,
        )

        result = runner.invoke(cli, ["test"])
        output = _plain_output(result.output)

        assert result.exit_code != 0
        assert "No cron triggers found for this job." in output


def test_test_command_reports_missing_jobs(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project("from terse_sdk import Terse\napp = Terse()\n", api_key=None)

        result = runner.invoke(cli, ["test"])
        output = _plain_output(result.output)

        assert result.exit_code != 0
        assert "No jobs found." in output


def test_deploy_requires_api_key(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(
            _runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"),
            api_key=None,
        )

        result = runner.invoke(cli, ["deploy"])
        output = _plain_output(result.output)

        assert result.exit_code != 0
        assert "No TERSE_API_KEY found in .env." in output


def test_deploy_reports_empty_archive_errors(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(_runtime_main_source("Path('ran.txt').write_text('ran', encoding='utf-8')"))

        with patch(
            "terse_cli.commands.deploy.build_deploy_archive",
            side_effect=PackagingError("No files found to deploy."),
        ):
            result = runner.invoke(cli, ["deploy"])
            output = _plain_output(result.output)

        assert result.exit_code != 0
        assert "No files found to deploy." in output


def test_deploy_reports_missing_jobs(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project("from terse_sdk import Terse\napp = Terse()\n")

        result = runner.invoke(cli, ["deploy"])
        output = _plain_output(result.output)

        assert result.exit_code != 0
        assert "No jobs found." in output


def test_deploy_builds_expected_payload_and_reports_results(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        _write_runtime_project(
            _runtime_main_source(
                "Path('ran.txt').write_text('ran', encoding='utf-8')",
                tool_approvals_block='["attio_upsert_record"]',
            ),
            gitignore="ignored.txt\nignored_dir/\n",
        )
        Path("pyproject.toml").write_text(
            textwrap.dedent(
                """
                [project]
                name = "demo"
                version = "0.1.0"

                [tool.uv]
                package = false

                [tool.uv.sources]
                terse-sdk = { path = "/tmp/local sdk/packages/terse-python-sdk", editable = true }
                some-local-package = { path = "vendor/some-local-package", editable = true }
                """
            ).strip()
            + "\n",
            encoding="utf-8",
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
            path: str,
            api_key: str,
            *,
            method: str = "GET",
            params: dict[str, object] | None = None,
        ) -> object:
            assert path == "/sdk/deploy"
            assert api_key == "terse_test_key"
            assert method == "POST"
            assert params is not None
            assert "jobs" in params
            jobs = params["jobs"]
            assert isinstance(jobs, list)
            assert len(jobs) == 1
            assert jobs[0]["jobName"] == "demo-job"
            assert jobs[0]["triggers"][0]["integrationType"] == "cron_job"
            assert jobs[0]["triggers"][0]["configType"] == "time_trigger"
            assert jobs[0]["toolApprovals"] == ["attio_upsert_record"]

            encoded = str(params["sourceZipBase64"])
            with ZipFile(BytesIO(base64.b64decode(encoded))) as archive:
                names = sorted(archive.namelist())
                archived_pyproject = archive.read("pyproject.toml").decode("utf-8")

            assert "pyproject.toml" in names
            assert "src/main.py" in names
            assert "src/terse_generated.py" in names
            assert "kept.txt" in names
            assert ".env" not in names
            assert "ignored.txt" not in names
            assert "ignored_dir/secret.txt" not in names
            assert ".venv/pyvenv.cfg" not in names
            assert "dist/output.txt" not in names
            assert 'terse-sdk = { path = "/tmp/local sdk/packages/terse-python-sdk"' not in archived_pyproject
            assert 'some-local-package = { path = "vendor/some-local-package", editable = true }' in archived_pyproject

            return {
                "success": True,
                "results": [
                    {
                        "jobName": "demo-job",
                        "automationId": "auto_123",
                        "isUpdate": False,
                    }
                ],
                "removed": [{"name": "old-job", "id": "auto_old"}],
            }

        with patch("terse_cli.commands.deploy.request_json", side_effect=fake_request_json):
            result = runner.invoke(cli, ["deploy"])
            output = _plain_output(result.output)

        assert result.exit_code == 0, result.output
        assert "Deployed 1 job" in output
        assert 'Created "demo-job" (auto_123)' in output
        assert "Removed 1 stale job" in output
