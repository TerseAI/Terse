from __future__ import annotations

import ast
import importlib.util
from pathlib import Path
from textwrap import dedent


def _load_generator_module():
    repo_root = Path(__file__).resolve().parents[3]
    script_path = repo_root / "scripts" / "generate-pydantic-from-schema.py"
    spec = importlib.util.spec_from_file_location("generate_pydantic_from_schema", script_path)
    assert spec is not None
    assert spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_inject_discriminators_emits_valid_annotated_unions(tmp_path: Path) -> None:
    generator = _load_generator_module()
    generator.DISCRIMINATED_UNIONS = {
        "SkillConfigData": "config_type",
        "TriggerConfigData": "config_type",
    }
    output = tmp_path / "_generated.py"
    output.write_text(
        dedent(
            """\
            from typing import Annotated
            from pydantic import RootModel

            class SkillConfigData(
                RootModel[
                    SlackOutputConfigInstance
                    | SnowflakeOutputConfigInstance
                ]
            ):
                root: (
                    SlackOutputConfigInstance
                    | SnowflakeOutputConfigInstance
                )


            class TriggerConfigData(
                RootModel[
                    GmailConfigInstance
                    | WorkOSInputConfigInstance
                ]
            ):
                root: (
                    GmailConfigInstance
                    | WorkOSInputConfigInstance
                )
            """
        )
    )

    generator._inject_discriminators(output)
    rewritten = output.read_text()

    ast.parse(rewritten)
    assert rewritten.count('Discriminator("config_type")') == 4
    assert "from pydantic import Discriminator, RootModel" in rewritten
    assert 'SnowflakeOutputConfigInstance,\n            Discriminator("config_type"),' in rewritten
    assert 'WorkOSInputConfigInstance,\n            Discriminator("config_type"),' in rewritten


def test_inject_discriminators_does_not_duplicate_discriminator_import(tmp_path: Path) -> None:
    generator = _load_generator_module()
    generator.DISCRIMINATED_UNIONS = {"SkillConfigData": "config_type"}
    output = tmp_path / "_generated.py"
    output.write_text(
        dedent(
            """\
            from typing import Annotated
            from pydantic import Discriminator, RootModel

            class SkillConfigData(
                RootModel[
                    SlackOutputConfigInstance
                    | SnowflakeOutputConfigInstance
                ]
            ):
                root: (
                    SlackOutputConfigInstance
                    | SnowflakeOutputConfigInstance
                )
            """
        )
    )

    generator._inject_discriminators(output)
    rewritten = output.read_text()

    assert rewritten.count("from pydantic import Discriminator, RootModel") == 1


def test_inject_discriminators_rewrites_single_line_root_model_unions(tmp_path: Path) -> None:
    generator = _load_generator_module()
    generator.DISCRIMINATED_UNIONS = {
        "SlackTrigger": "event_type",
        "LinearTrigger": "event_type",
    }
    output = tmp_path / "_generated.py"
    output.write_text(
        dedent(
            """\
            from pydantic import RootModel

            class SlackTrigger(
                RootModel[SlackMessageTrigger | SlackAppMentionTrigger | SlackReactionAddedTrigger]
            ):
                root: SlackMessageTrigger | SlackAppMentionTrigger | SlackReactionAddedTrigger


            class LinearTrigger(
                RootModel[LinearIssueCreatedTrigger | LinearIssueUpdatedTrigger | LinearCommentCreatedTrigger]
            ):
                root: LinearIssueCreatedTrigger | LinearIssueUpdatedTrigger | LinearCommentCreatedTrigger
            """
        )
    )

    generator._inject_discriminators(output)
    rewritten = output.read_text()

    ast.parse(rewritten)
    assert rewritten.count('Discriminator("event_type")') == 4
    assert "class SlackTrigger(\n    RootModel[\n        Annotated[" in rewritten
    assert "class LinearTrigger(\n    RootModel[\n        Annotated[" in rewritten
