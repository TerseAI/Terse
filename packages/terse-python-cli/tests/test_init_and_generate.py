# ruff: noqa: E501
from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch

from click.testing import CliRunner
from terse_cli._generate import (
    CodegenInput,
    GenerateResult,
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
        summary_lines=["Schedule trigger", "Terse skills (web search)"],
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
            self.assertIn(
                "from terse_generated import Schedule, Terse",
                (project_dir / "src" / "main.py").read_text(encoding="utf-8"),
            )
            self.assertIn("Hello, Ada! API key verified.", result.output)

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
            self.assertIn("class Terse:", generated)
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
                    return ["github", "slack"]
                if path == "/github/integrations":
                    return [{"id": "github_1", "account_name": "TerseAI", "installation_id": "install_1"}]
                if path == "/github/get-repositories-for-integration":
                    self.assertEqual(params, {"installation_id": "install_1"})
                    return {"repositories": [{"id": 42, "name": "terse", "owner": "TerseAI"}]}
                if path == "/slack/integrations":
                    return [{"id": "slack_1", "teamName": "Terse"}]
                if path == "/slack/channels":
                    self.assertEqual(params, {"integrationId": "slack_1"})
                    return {"channels": [{"id": "C123", "name": "alerts"}]}
                raise AssertionError(f"Unexpected path: {path}")

            with patch("terse_cli._generate.request_json", side_effect=fake_request_json):
                result = self.runner.invoke(cli, ["generate"])

            self.assertEqual(result.exit_code, 0, result.output)
            generated = Path("src/terse_generated.py").read_text(encoding="utf-8")
            self.assertIn("class GitHub:", generated)
            self.assertIn("Repos = SimpleNamespace(", generated)
            self.assertIn("class Slack:", generated)
            self.assertIn("SlackChannel = SimpleNamespace(", generated)
            self.assertIn("class Schedule:", generated)
            self.assertIn("class Terse:", generated)

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


if __name__ == "__main__":
    unittest.main()
