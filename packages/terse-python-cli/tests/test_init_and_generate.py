# ruff: noqa: E501
from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
from click.testing import CliRunner
from terse_cli._generate import (
    AttioAttributeData,
    AttioInstanceData,
    AttioObjectData,
    CodegenInput,
    GenerateResult,
    SnowflakeInstanceData,
    TemplateContextBuilder,
    ToolDefinition,
    render_generated_module,
    write_generated_module,
)
from terse_cli._http import ApiRequestError, AuthenticationError
from terse_cli._project import DependencyInstallResult
from terse_cli.cli import cli


@pytest.fixture
def runner() -> CliRunner:
    return CliRunner()


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


def test_init_new_project_scaffolds_files(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        with (
            patch(
                "terse_cli.commands.init.run_uv_sync",
                return_value=_successful_install(),
            ),
            patch("terse_cli.commands.init.verify_api_key", return_value="Ada"),
            patch(
                "terse_cli.commands.init.generate_project",
                side_effect=_fake_generate_project,
            ),
        ):
            result = runner.invoke(cli, ["init", "demo-project"], input="terse_test_key\n")

        assert result.exit_code == 0, result.output
        project_dir = Path("demo-project")

        assert (project_dir / "pyproject.toml").exists()
        assert (project_dir / "README.md").exists()
        assert (project_dir / ".env.example").exists()
        assert (project_dir / ".gitignore").exists()
        assert (project_dir / ".python-version").exists()
        assert (project_dir / "src" / "main.py").exists()
        assert (project_dir / "src" / "terse_generated.py").exists()
        assert (project_dir / ".env").read_text(encoding="utf-8") == "TERSE_API_KEY=terse_test_key\n"
        assert "package = false" in (project_dir / "pyproject.toml").read_text(encoding="utf-8")
        main_source = (project_dir / "src" / "main.py").read_text(encoding="utf-8")
        readme_source = (project_dir / "README.md").read_text(encoding="utf-8")
        assert "from terse_sdk import CronJobInputEvent, SdkAgentStreamEventFinalOutput, Terse" in main_source
        assert "from terse_generated import Schedule, TerseAgent" in main_source
        assert "app = Terse()" in main_source
        assert "@app.job(" in main_source
        assert "for stream_event in agent.run(prompt, event):" in main_source
        assert "if isinstance(stream_event, SdkAgentStreamEventFinalOutput):" in main_source
        assert "print(stream_event.final_output)" in main_source
        assert "_ = agent" not in main_source
        assert "def main()" not in main_source
        assert '__name__ == "__main__"' not in main_source
        assert "JobDefinition" not in main_source
        assert "If you connect Attio or Snowflake in Terse, rerun `terse generate`" in readme_source
        assert 'agent.tools.snowflake.execute_query(query="select 1")' in readme_source
        assert "Hello, Ada! API key verified." in result.output
        assert "Run `terse test` to execute it locally" in result.output


def test_init_in_place_is_supported(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        with (
            patch(
                "terse_cli.commands.init.run_uv_sync",
                return_value=_successful_install(),
            ),
            patch("terse_cli.commands.init.verify_api_key", return_value="Ada"),
            patch(
                "terse_cli.commands.init.generate_project",
                side_effect=_fake_generate_project,
            ),
        ):
            result = runner.invoke(cli, ["init"], input="terse_test_key\n")

        assert result.exit_code == 0, result.output
        assert Path("pyproject.toml").exists()
        assert Path("src/main.py").exists()
        assert Path("src/terse_generated.py").exists()


def test_init_dev_mode_writes_local_sdk_source_override(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        with (
            patch(
                "terse_cli.commands.init.scaffold_template_context",
                return_value={
                    "PROJECT_NAME": "demo-project",
                    "SDK_DEPENDENCY": "terse-sdk~=0.1.5",
                    "USE_LOCAL_SDK_SOURCE": True,
                    "SDK_SOURCE_PATH": '"/tmp/local sdk/packages/terse-python-sdk"',
                    "SDK_SRC_PATH": '"/tmp/local sdk/packages/terse-python-sdk/src"',
                },
            ),
            patch(
                "terse_cli.commands.init.run_uv_sync",
                return_value=_successful_install(),
            ),
            patch("terse_cli.commands.init.verify_api_key", return_value="Ada"),
            patch(
                "terse_cli.commands.init.generate_project",
                side_effect=_fake_generate_project,
            ),
        ):
            result = runner.invoke(cli, ["init", "demo-project"], input="terse_test_key\n")

        assert result.exit_code == 0, result.output
        pyproject = Path("demo-project/pyproject.toml").read_text(encoding="utf-8")
        assert "[tool.uv.sources]" in pyproject
        assert 'terse-sdk = { path = "/tmp/local sdk/packages/terse-python-sdk", editable = true }' in pyproject
        assert 'extra-paths = ["/tmp/local sdk/packages/terse-python-sdk/src"]' in pyproject


def test_init_rejects_existing_named_directory(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        Path("demo-project").mkdir()
        result = runner.invoke(cli, ["init", "demo-project"])

        assert result.exit_code != 0
        assert 'Directory "demo-project" already exists.' in result.output


def test_init_skip_api_key_writes_empty_env_and_fallback_helpers(
    runner: CliRunner,
) -> None:
    with runner.isolated_filesystem():
        with patch("terse_cli.commands.init.run_uv_sync", return_value=_successful_install()):
            result = runner.invoke(cli, ["init", "demo-project"], input="\n")

        assert result.exit_code == 0, result.output
        project_dir = Path("demo-project")
        assert (project_dir / ".env").read_text(encoding="utf-8") == "TERSE_API_KEY=\n"
        generated = (project_dir / "src" / "terse_generated.py").read_text(encoding="utf-8")
        assert "class Schedule:" in generated
        assert "class Terse:" not in generated
        assert "Warning: Could not fetch integration helpers during init." in result.output


def test_init_warns_when_api_key_verification_fails(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        with (
            patch(
                "terse_cli.commands.init.run_uv_sync",
                return_value=_successful_install(),
            ),
            patch(
                "terse_cli.commands.init.verify_api_key",
                side_effect=AuthenticationError("401 Unauthorized"),
            ),
            patch(
                "terse_cli.commands.init.generate_project",
                side_effect=_fake_generate_project,
            ),
        ):
            result = runner.invoke(cli, ["init", "demo-project"], input="bad_key\n")

        assert result.exit_code == 0, result.output
        assert "Could not verify API key" in result.output
        assert Path("demo-project/.env").read_text(encoding="utf-8") == "TERSE_API_KEY=bad_key\n"


def test_init_warns_when_dependency_install_fails(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        with (
            patch("terse_cli.commands.init.run_uv_sync", return_value=_failed_install()),
            patch("terse_cli.commands.init.verify_api_key", return_value="Ada"),
            patch(
                "terse_cli.commands.init.generate_project",
                side_effect=_fake_generate_project,
            ),
        ):
            result = runner.invoke(cli, ["init", "demo-project"], input="terse_test_key\n")

        assert result.exit_code == 0, result.output
        assert "Warning: Failed to install dependencies with uv sync." in result.output


def test_init_warns_when_generate_fails(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        with (
            patch(
                "terse_cli.commands.init.run_uv_sync",
                return_value=_successful_install(),
            ),
            patch("terse_cli.commands.init.verify_api_key", return_value="Ada"),
            patch(
                "terse_cli.commands.init.generate_project",
                side_effect=ApiRequestError("backend unavailable"),
            ),
        ):
            result = runner.invoke(cli, ["init", "demo-project"], input="terse_test_key\n")

        assert result.exit_code == 0, result.output
        generated = Path("demo-project/src/terse_generated.py").read_text(encoding="utf-8")
        assert "class Schedule:" in generated
        assert "class Terse:" not in generated
        assert "backend unavailable" in result.output


def test_generate_writes_integration_helpers(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        Path("src").mkdir()
        Path("pyproject.toml").write_text("[project]\nname = 'demo'\nversion = '0.1.0'\n", encoding="utf-8")
        Path("src/main.py").write_text("print('hello')\n", encoding="utf-8")
        Path(".env").write_text("TERSE_API_KEY=terse_test_key\n", encoding="utf-8")

        def fake_request_json(
            path: str,
            api_key: str,
            *,
            method: str = "GET",
            params: dict[str, object] | None = None,
        ) -> object:
            assert api_key == "terse_test_key"
            if path == "/integrations/active":
                return ["attio", "snowflake"]
            if path == "/attio/integrations":
                return [{"id": "attio_1", "workspaceName": "Terse CRM"}]
            if path == "/attio/integrations/attio_1/objects":
                return [
                    {
                        "api_slug": "companies",
                        "singular_noun": "Company",
                        "attributes": [
                            {"api_slug": "name", "title": "Name", "type": "text", "is_required": True},
                            {"api_slug": "domains", "title": "Domains", "type": "domain", "is_unique": True},
                            {"api_slug": "founded_at", "title": "Founded at", "type": "date"},
                        ],
                    }
                ]
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
                            "supportsApproval": True,
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
            result = runner.invoke(cli, ["generate"])

        assert result.exit_code == 0, result.output
        generated = Path("src/terse_generated.py").read_text(encoding="utf-8")
        assert "class Attio:" in generated
        assert "class AttioObjects:" in generated
        assert "class CompanyRecordValues(TypedDict, total=False):" in generated
        assert "class CompanyInputValues(TypedDict, total=False):" in generated
        assert "CompanyAttributeSlug = Literal['name', 'domains', 'founded_at']" in generated
        assert "class CompanyFilter(TypedDict, total=False):" in generated
        assert (
            "Company: AttioObjectType[CompanyAttributeSlug, CompanyRecordValues, CompanyInputValues, CompanyFilter]"
            in generated
        )
        assert (
            "def skill(obj: AttioObjectType[Any, Any, Any, Any] | None = None) -> SkillConfig[AttioToolNames]:"
            in generated
        )
        assert "class Snowflake:" in generated
        assert "def skill() -> SkillConfig[SnowflakeToolNames]:" in generated
        assert "class Schedule:" in generated
        assert "class GeneratedTools:" in generated
        assert "class TerseAgent(_SdkTerseAgent):" in generated
        assert "def create_tools(agent: _SdkTerseAgent)" in generated
        assert "class _AttioTools:" in generated
        assert "def list_objects(self)" in generated
        assert "def query_records(" in generated
        assert "filter: _TFilterValues | None = None," in generated
        assert "def upsert_record(" in generated
        assert "records: list[_TInputValues]," in generated
        assert "'records': records," in generated
        assert "class _SnowflakeTools:" in generated
        assert "def execute_query(self, query: str) -> SnowflakeExecuteQueryToolOutput:" in generated
        assert "def explain_query(self, query: str) -> SnowflakeExplainQueryToolOutput:" in generated
        assert "from terse_sdk import (" in generated
        assert "AttioTypedQueryResult" in generated
        assert "AttioTypedUpsertResult" in generated
        assert "AttioQueryRecordsToolOutput" in generated
        assert "SnowflakeExecuteQueryToolOutput" in generated
        assert "AttioToolNames = Literal['attio_upsert_record']" in generated
        assert "SnowflakeToolNames = Literal['snowflakeExecuteQuery']" in generated
        assert "AllToolNames = Literal['attio_upsert_record', 'snowflakeExecuteQuery']" in generated
        assert (
            "class AttioObjectType(BaseModel, Generic[_TSlug, _TRecordValues, _TInputValues, _TFilterValues]):"
            in generated
        )
        assert "model_config = ConfigDict(frozen=True)" in generated
        assert "from pydantic import" in generated
        assert "uv run ty check src/" in generated
        assert "SimpleNamespace" not in generated
        assert "class Terse:" not in generated
        assert "Attio (Terse CRM) — 1 objects" in result.output
        assert "Snowflake (acme-prod)" in result.output


def test_generate_reports_auth_failure(runner: CliRunner) -> None:
    with runner.isolated_filesystem():
        Path("src").mkdir()
        Path("pyproject.toml").write_text("[project]\nname = 'demo'\nversion = '0.1.0'\n", encoding="utf-8")
        Path("src/main.py").write_text("print('hello')\n", encoding="utf-8")
        Path(".env").write_text("TERSE_API_KEY=terse_test_key\n", encoding="utf-8")

        with patch(
            "terse_cli._generate.request_json",
            side_effect=AuthenticationError("401 Unauthorized"),
        ):
            result = runner.invoke(cli, ["generate"])

        assert result.exit_code != 0
        assert "Authentication failed: your TERSE_API_KEY was rejected." in result.output


def test_template_context_builder_groups_content_by_integration() -> None:
    context = (
        TemplateContextBuilder(
            CodegenInput(
                attio=[
                    AttioInstanceData(
                        id="attio_1",
                        display_name="Terse CRM",
                        objects=[
                            AttioObjectData(
                                api_slug="companies",
                                singular_noun="Company",
                                attributes=[AttioAttributeData(api_slug="name", title="Name", type="text")],
                            )
                        ],
                    )
                ],
                snowflake=[SnowflakeInstanceData(id="snowflake_1", display_name="acme-prod")],
                tools=[
                    ToolDefinition(
                        name="attio_upsert_record",
                        display_name="Upsert record",
                        description="Upsert Attio record.",
                        integration="attio",
                        is_read_only=False,
                    ),
                    ToolDefinition(
                        name="snowflakeExecuteQuery",
                        display_name="Execute query",
                        description="Execute Snowflake query.",
                        integration="snowflake",
                        is_read_only=True,
                        supports_approval=True,
                    ),
                ],
            )
        )
        .with_all()
        .build()
    )

    assert set(context) == {"attio", "snowflake"}
    assert "typing_names" not in context
    assert "attio_tool_names_literal" not in context
    assert "exported_names_repr" not in context

    assert context["attio"] is not None
    assert context["snowflake"] is not None
    assert [tool.name for tool in context["attio"].tools] == ["attio_upsert_record"]
    assert context["attio"].tools[0].approvable is True
    assert [tool.name for tool in context["snowflake"].tools] == ["snowflakeExecuteQuery"]
    assert context["snowflake"].tools[0].approvable is True


def test_render_generated_module_auto_fills_snowflake_integration_id() -> None:
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

    assert "class GeneratedTools:" in generated
    assert "class _SnowflakeTools:" in generated
    assert "class TerseAgent(_SdkTerseAgent):" in generated
    assert "'integrationId': 'snowflake_1'" in generated
    assert "'query': query" in generated
    assert "SnowflakeExecuteQueryToolOutput" in generated
