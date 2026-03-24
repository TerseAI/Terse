# ruff: noqa: E501
from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from click.testing import CliRunner
from terse_cli._generate import (
    CodegenInput,
    GenerateResult,
    SnowflakeInstanceData,
    ToolDefinition,
    render_generated_module,
    write_generated_module,
)
from terse_cli._http import ApiRequestError, AuthenticationError
from terse_cli._project import DependencyInstallResult
from terse_cli.cli import cli


def _successful_install() -> DependencyInstallResult:
    return DependencyInstallResult(succeeded=True, command=("uv", "sync"))


def _failed_install() -> DependencyInstallResult:
    return DependencyInstallResult(succeeded=False, command=("uv", "sync"), details="uv failed")


def _fake_generate_project(project_dir: Path | None = None) -> GenerateResult:
    resolved_dir = (project_dir or Path.cwd()).resolve()
    output_path = write_generated_module(resolved_dir, render_generated_module(CodegenInput()))
    return GenerateResult(
        project_dir=resolved_dir,
        output_path=output_path,
        summary_lines=["Schedule trigger"],
    )


class InitAndGenerateCommandTests(unittest.TestCase):
    def setUp(self) -> None:
        self.runner = CliRunner()

    def test_init_new_project_scaffolds_files(self) -> None:
        with self.runner.isolated_filesystem():
            with (
                patch("terse_cli.commands.init.run_uv_sync", return_value=_successful_install()),
                patch("terse_cli.commands.init.verify_api_key", return_value="Ada"),
                patch("terse_cli.commands.init.generate_project", side_effect=_fake_generate_project),
            ):
                result = self.runner.invoke(cli, ["init", "demo-project"], input="terse_test_key\n")

            self.assertEqual(result.exit_code, 0, result.output)
            project_dir = Path("demo-project")

            self.assertTrue((project_dir / "pyproject.toml").exists())
            self.assertTrue((project_dir / "README.md").exists())
            self.assertTrue((project_dir / ".env.example").exists())
            self.assertTrue((project_dir / ".gitignore").exists())
            self.assertTrue((project_dir / ".python-version").exists())
            self.assertTrue((project_dir / "src" / "main.py").exists())
            self.assertTrue((project_dir / "src" / "terse_generated.py").exists())
            self.assertEqual((project_dir / ".env").read_text(encoding="utf-8"), "TERSE_API_KEY=terse_test_key\n")
            self.assertIn("package = false", (project_dir / "pyproject.toml").read_text(encoding="utf-8"))
            main_source = (project_dir / "src" / "main.py").read_text(encoding="utf-8")
            readme_source = (project_dir / "README.md").read_text(encoding="utf-8")
            self.assertIn("from terse_sdk import CronJobInputEvent, EventType, Terse", main_source)
            self.assertIn("from terse_generated import Schedule, TerseAgent", main_source)
            self.assertIn("app = Terse()", main_source)
            self.assertIn("@app.job(", main_source)
            self.assertIn("for stream_event in agent.run(prompt, event):", main_source)
            self.assertIn("if stream_event.type == EventType.FINAL_OUTPUT:", main_source)
            self.assertIn("print(stream_event.finalOutput)", main_source)
            self.assertNotIn("_ = agent", main_source)
            self.assertNotIn("def main()", main_source)
            self.assertNotIn('__name__ == "__main__"', main_source)
            self.assertNotIn("JobDefinition", main_source)
            self.assertIn("If you connect Attio or Snowflake in Terse, rerun `terse generate`", readme_source)
            self.assertIn("agent.tools.snowflake.execute_query(query=\"select 1\")", readme_source)
            self.assertIn("Hello, Ada! API key verified.", result.output)
            self.assertIn("Run `terse test` to execute it locally", result.output)

    def test_init_in_place_is_supported(self) -> None:
        with self.runner.isolated_filesystem():
            with (
                patch("terse_cli.commands.init.run_uv_sync", return_value=_successful_install()),
                patch("terse_cli.commands.init.verify_api_key", return_value="Ada"),
                patch("terse_cli.commands.init.generate_project", side_effect=_fake_generate_project),
            ):
                result = self.runner.invoke(cli, ["init"], input="terse_test_key\n")

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertTrue(Path("pyproject.toml").exists())
            self.assertTrue(Path("src/main.py").exists())
            self.assertTrue(Path("src/terse_generated.py").exists())

    def test_init_dev_mode_writes_local_sdk_source_override(self) -> None:
        with self.runner.isolated_filesystem():
            with (
                patch(
                    "terse_cli.commands.init.scaffold_template_context",
                    return_value={
                        "PROJECT_NAME": "demo-project",
                        "SDK_DEPENDENCY": "terse-python-sdk>=0.1.0,<0.2.0",
                        "USE_LOCAL_SDK_SOURCE": True,
                        "SDK_SOURCE_PATH": '"/tmp/local sdk/packages/terse-python-sdk"',
                    },
                ),
                patch("terse_cli.commands.init.run_uv_sync", return_value=_successful_install()),
                patch("terse_cli.commands.init.verify_api_key", return_value="Ada"),
                patch("terse_cli.commands.init.generate_project", side_effect=_fake_generate_project),
            ):
                result = self.runner.invoke(cli, ["init", "demo-project"], input="terse_test_key\n")

            self.assertEqual(result.exit_code, 0, result.output)
            pyproject = Path("demo-project/pyproject.toml").read_text(encoding="utf-8")
            self.assertIn("[tool.uv.sources]", pyproject)
            self.assertIn(
                'terse-python-sdk = { path = "/tmp/local sdk/packages/terse-python-sdk", editable = true }',
                pyproject,
            )

    def test_init_rejects_existing_named_directory(self) -> None:
        with self.runner.isolated_filesystem():
            Path("demo-project").mkdir()
            result = self.runner.invoke(cli, ["init", "demo-project"])

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn('Directory "demo-project" already exists.', result.output)

    def test_init_skip_api_key_writes_empty_env_and_fallback_helpers(self) -> None:
        with self.runner.isolated_filesystem():
            with patch("terse_cli.commands.init.run_uv_sync", return_value=_successful_install()):
                result = self.runner.invoke(cli, ["init", "demo-project"], input="\n")

            self.assertEqual(result.exit_code, 0, result.output)
            project_dir = Path("demo-project")
            self.assertEqual((project_dir / ".env").read_text(encoding="utf-8"), "TERSE_API_KEY=\n")
            generated = (project_dir / "src" / "terse_generated.py").read_text(encoding="utf-8")
            self.assertIn("class Schedule:", generated)
            self.assertNotIn("class Terse:", generated)
            self.assertIn("Warning: Could not fetch integration helpers during init.", result.output)

    def test_init_warns_when_api_key_verification_fails(self) -> None:
        with self.runner.isolated_filesystem():
            with (
                patch("terse_cli.commands.init.run_uv_sync", return_value=_successful_install()),
                patch("terse_cli.commands.init.verify_api_key", side_effect=AuthenticationError("401 Unauthorized")),
                patch("terse_cli.commands.init.generate_project", side_effect=_fake_generate_project),
            ):
                result = self.runner.invoke(cli, ["init", "demo-project"], input="bad_key\n")

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertIn("Could not verify API key", result.output)
            self.assertEqual(Path("demo-project/.env").read_text(encoding="utf-8"), "TERSE_API_KEY=bad_key\n")

    def test_init_warns_when_dependency_install_fails(self) -> None:
        with self.runner.isolated_filesystem():
            with (
                patch("terse_cli.commands.init.run_uv_sync", return_value=_failed_install()),
                patch("terse_cli.commands.init.verify_api_key", return_value="Ada"),
                patch("terse_cli.commands.init.generate_project", side_effect=_fake_generate_project),
            ):
                result = self.runner.invoke(cli, ["init", "demo-project"], input="terse_test_key\n")

            self.assertEqual(result.exit_code, 0, result.output)
            self.assertIn("Warning: Failed to install dependencies with uv sync.", result.output)

    def test_init_warns_when_generate_fails(self) -> None:
        with self.runner.isolated_filesystem():
            with (
                patch("terse_cli.commands.init.run_uv_sync", return_value=_successful_install()),
                patch("terse_cli.commands.init.verify_api_key", return_value="Ada"),
                patch("terse_cli.commands.init.generate_project", side_effect=ApiRequestError("backend unavailable")),
            ):
                result = self.runner.invoke(cli, ["init", "demo-project"], input="terse_test_key\n")

            self.assertEqual(result.exit_code, 0, result.output)
            generated = Path("demo-project/src/terse_generated.py").read_text(encoding="utf-8")
            self.assertIn("class Schedule:", generated)
            self.assertNotIn("class Terse:", generated)
            self.assertIn("backend unavailable", result.output)

    def test_generate_writes_integration_helpers(self) -> None:
        with self.runner.isolated_filesystem():
            Path("src").mkdir()
            Path("pyproject.toml").write_text("[project]\nname = 'demo'\nversion = '0.1.0'\n", encoding="utf-8")
            Path("src/main.py").write_text("print('hello')\n", encoding="utf-8")
            Path(".env").write_text("TERSE_API_KEY=terse_test_key\n", encoding="utf-8")

            def fake_request_json(
                path: str, api_key: str, *, method: str = "GET", params: dict[str, object] | None = None
            ) -> object:
                self.assertEqual(api_key, "terse_test_key")
                if path == "/integrations/active":
                    return ["attio", "snowflake"]
                if path == "/attio/integrations":
                    return [{"id": "attio_1", "workspaceName": "Terse CRM"}]
                if path == "/attio/integrations/attio_1/objects":
                    return [{"api_slug": "companies", "singular_noun": "Company"}]
                if path == "/snowflake/integrations":
                    return [{"id": "snowflake_1", "accountIdentifier": "acme-prod"}]
                if path == "/sdk/tool-definitions":
                    return {
                        "tools": [
                            {
                                "name": "attio_list_objects",
                                "displayName": "List objects",
                                "description": "List Attio objects.",
                                "integration": "attio",
                                "isReadOnly": True,
                                "parameters": {},
                            },
                            {
                                "name": "attio_query_records",
                                "displayName": "Query records",
                                "description": "Query Attio records.",
                                "integration": "attio",
                                "isReadOnly": True,
                                "parameters": {},
                            },
                            {
                                "name": "attio_upsert_record",
                                "displayName": "Upsert record",
                                "description": "Upsert Attio record.",
                                "integration": "attio",
                                "isReadOnly": False,
                                "parameters": {},
                            },
                            {
                                "name": "snowflakeExecuteQuery",
                                "displayName": "Execute query",
                                "description": "Execute Snowflake query.",
                                "integration": "snowflake",
                                "isReadOnly": True,
                                "parameters": {},
                            },
                            {
                                "name": "snowflakeExplainQuery",
                                "displayName": "Explain query",
                                "description": "Explain Snowflake query.",
                                "integration": "snowflake",
                                "isReadOnly": True,
                                "parameters": {},
                            },
                        ]
                    }
                raise AssertionError(f"Unexpected path: {path}")

            with patch("terse_cli._generate.request_json", side_effect=fake_request_json):
                result = self.runner.invoke(cli, ["generate"])

            self.assertEqual(result.exit_code, 0, result.output)
            generated = Path("src/terse_generated.py").read_text(encoding="utf-8")
            self.assertIn("class Attio:", generated)
            self.assertIn("AttioObject = SimpleNamespace(", generated)
            self.assertIn("Company=AttioObjectResource(", generated)
            self.assertIn("class Snowflake:", generated)
            self.assertIn("class Schedule:", generated)
            self.assertIn("class GeneratedTools:", generated)
            self.assertIn("class TerseAgent(_SdkTerseAgent):", generated)
            self.assertIn("def create_tools(agent: _SdkTerseAgent)", generated)
            self.assertIn("class _AttioTools:", generated)
            self.assertIn("def list_objects(self)", generated)
            self.assertIn("def query_records(", generated)
            self.assertIn("def upsert_record(", generated)
            self.assertIn("class _SnowflakeTools:", generated)
            self.assertIn("def execute_query(self, *, query: str) -> SnowflakeExecuteQueryToolOutput:", generated)
            self.assertIn("def explain_query(self, *, query: str) -> SnowflakeExplainQueryToolOutput:", generated)
            self.assertIn("from terse_sdk.generated.models import (", generated)
            self.assertIn("AttioQueryRecordsToolOutput", generated)
            self.assertIn("SnowflakeExecuteQueryToolOutput", generated)
            self.assertNotIn("class Terse:", generated)
            self.assertIn("Attio (Terse CRM) — 1 objects", result.output)
            self.assertIn("Snowflake (acme-prod)", result.output)

    def test_generate_reports_auth_failure(self) -> None:
        with self.runner.isolated_filesystem():
            Path("src").mkdir()
            Path("pyproject.toml").write_text("[project]\nname = 'demo'\nversion = '0.1.0'\n", encoding="utf-8")
            Path("src/main.py").write_text("print('hello')\n", encoding="utf-8")
            Path(".env").write_text("TERSE_API_KEY=terse_test_key\n", encoding="utf-8")

            with patch("terse_cli._generate.request_json", side_effect=AuthenticationError("401 Unauthorized")):
                result = self.runner.invoke(cli, ["generate"])

            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("Authentication failed: your TERSE_API_KEY was rejected.", result.output)

    def test_render_generated_module_auto_fills_snowflake_integration_id(self) -> None:
        generated = render_generated_module(
            CodegenInput(
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
            )
        )

        self.assertIn("class GeneratedTools:", generated)
        self.assertIn("class _SnowflakeTools:", generated)
        self.assertIn("class TerseAgent(_SdkTerseAgent):", generated)
        self.assertIn("'integrationId': 'snowflake_1'", generated)
        self.assertIn("'query': query", generated)
        self.assertIn("SnowflakeExecuteQueryToolOutput", generated)


if __name__ == "__main__":
    unittest.main()
