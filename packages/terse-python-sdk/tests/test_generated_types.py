from __future__ import annotations

import pytest
from pydantic import ValidationError
from terse_sdk.types._generated import (
    LinearTeam,
    NotionPageBlock,
    PosthogConfigInstance,
    SdkAgentStreamEvent,
    SkillConfigData,
    SlackTrigger,
    TriggerConfigData,
    WorkOSTrigger,
)
from terse_sdk.types.enums import ConfigType


def test_generated_linear_team_model_validates() -> None:
    team = LinearTeam.model_validate({"id": "team_123", "name": "Platform", "key": "PLAT"})

    assert team.id == "team_123"
    assert team.name == "Platform"
    assert team.key == "PLAT"


def test_generated_notion_page_block_supports_recursive_children() -> None:
    block = NotionPageBlock.model_validate(
        {
            "id": "block_parent",
            "type": "paragraph",
            "object": "block",
            "children": [
                {
                    "id": "block_child",
                    "type": "to_do",
                    "object": "block",
                    "checked": True,
                }
            ],
        }
    )

    assert block.children is not None
    assert block.children[0].id == "block_child"
    assert block.children[0].checked is True


def test_generated_posthog_config_uses_snake_case_with_camel_case_aliases() -> None:
    config = PosthogConfigInstance.model_validate(
        {
            "integrationId": "int_123",
            "integrationType": "posthog",
            "configType": "POSTHOG",
            "projectId": "proj_123",
            "projectName": "Analytics",
        }
    )

    assert config.integration_id == "int_123"
    assert config.integration_type == "posthog"
    assert config.config_type == ConfigType.posthog
    assert config.project_id == "proj_123"
    assert config.project_name is not None
    assert config.project_name == "Analytics"
    assert config.model_dump(by_alias=True)["configType"] == "POSTHOG"


def test_skill_config_data_uses_discriminator_for_shorter_validation_errors() -> None:
    with pytest.raises(ValidationError) as exc_info:
        SkillConfigData.model_validate(
            {
                "configType": "slack_output",
                "integrationId": "int_123",
                "channelId": None,
                "channelName": None,
                "userIds": None,
                "userNames": None,
            }
        )

    errors = exc_info.value.errors(include_url=False)

    assert len(errors) == 1
    assert errors[0]["type"] == "missing"
    assert errors[0]["loc"][0] == "slack_output"
    assert errors[0]["loc"][-1] in {"listenToUserDms", "listen_to_user_dms"}


def test_trigger_config_data_uses_discriminator_for_shorter_validation_errors() -> None:
    with pytest.raises(ValidationError) as exc_info:
        TriggerConfigData.model_validate(
            {
                "configType": "workos_input",
                "integrationId": "int_123",
            }
        )

    errors = exc_info.value.errors(include_url=False)

    assert len(errors) == 1
    assert errors[0]["type"] == "missing"
    assert errors[0]["loc"][0] == "workos_input"
    assert errors[0]["loc"][-1] in {"eventTypes", "event_types"}


def test_sdk_agent_stream_event_uses_discriminator_for_shorter_validation_errors() -> None:
    with pytest.raises(ValidationError) as exc_info:
        SdkAgentStreamEvent.model_validate({"type": "run_started"})

    errors = exc_info.value.errors(include_url=False)

    assert len(errors) == 1
    assert errors[0]["type"] == "missing"
    assert errors[0]["loc"][0] == "run_started"
    assert errors[0]["loc"][-1] in {"runId", "run_id"}


@pytest.mark.parametrize(
    ("model", "payload", "expected_branch"),
    [
        (
            SlackTrigger,
            {
                "eventType": "message",
            },
            "message",
        ),
        (
            WorkOSTrigger,
            {
                "eventType": "invitation.revoked",
            },
            "invitation.revoked",
        ),
    ],
)
def test_leaf_trigger_unions_use_event_type_discriminator_for_shorter_validation_errors(
    model: type[SlackTrigger] | type[WorkOSTrigger],
    payload: dict[str, str],
    expected_branch: str,
) -> None:
    with pytest.raises(ValidationError) as exc_info:
        model.model_validate(payload)

    errors = exc_info.value.errors(include_url=False)

    assert errors
    assert {error["loc"][0] for error in errors} == {expected_branch}
