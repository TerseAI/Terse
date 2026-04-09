from __future__ import annotations

from terse_sdk import (
    GitHubPullRequestOpenedTriggerEvent,
    GitHubPullRequestSynchronizedTriggerEvent,
    LinearIssueCreatedTriggerEvent,
    WorkOSOrganizationMembershipCreatedTriggerEvent,
)
from terse_sdk.types._generated import (
    LinearTeam,
    NotionPageBlock,
    PosthogConfigInstance,
)
from terse_sdk.types.enums import ConfigType


def test_generated_linear_team_model_validates() -> None:
    team = LinearTeam.model_validate(
        {"id": "team_123", "name": "Platform", "key": "PLAT"}
    )

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
