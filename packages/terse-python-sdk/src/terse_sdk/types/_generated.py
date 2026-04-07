# AUTO-GENERATED - DO NOT EDIT. Run 'pnpm run generate:python-types' to regenerate.
# ruff: noqa: E501

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import AnyUrl, AwareDatetime, ConfigDict, EmailStr, Field, RootModel

from terse_sdk.types._base import TerseModel


class Model(RootModel[Any]):
    root: Any


class AtlassianIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
        regex_engine="python-re",
    )
    id: str
    base_url: Annotated[AnyUrl, Field(alias="baseUrl")]
    email: Annotated[
        EmailStr,
        Field(
            pattern="^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"
        ),
    ]
    site_name: Annotated[str | None, Field(alias="siteName")] = None
    project_key: Annotated[str | None, Field(alias="projectKey")] = None
    project_name: Annotated[str | None, Field(alias="projectName")] = None


class AttioIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    workspace_name: Annotated[str | None, Field(alias="workspaceName")] = None


class AttioOutputConfigInstanceObjectSlug(RootModel[str | None]):
    root: Annotated[str | None, Field(title="AttioOutputConfigInstanceObjectSlug")]


class AttioOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["attio"], Field(alias="integrationType")] = "attio"
    config_type: Annotated[Literal["attio_output"], Field(alias="configType")] = "attio_output"
    object_slug: Annotated[
        AttioOutputConfigInstanceObjectSlug | None,
        Field(alias="objectSlug", title="AttioOutputConfigInstanceObjectSlug"),
    ]


class ConfigTypeEnum(StrEnum):
    gmail = "gmail"
    gmail_output = "gmail_output"
    gmail_draft_output = "gmail_draft_output"
    figma = "figma"
    slack = "slack"
    slack_output = "slack_output"
    notion = "notion"
    linear_input = "linear_input"
    linear_output = "linear_output"
    github = "github"
    jira = "jira"
    confluence = "confluence"
    posthog = "POSTHOG"
    datadog = "DATADOG"
    time_trigger = "time_trigger"
    launchdarkly = "launchdarkly"
    terse = "terse"
    workos_input = "workos_input"
    workos_output = "workos_output"
    attio_output = "attio_output"
    snowflake_output = "snowflake_output"


class IntegrationTypeEnum(StrEnum):
    github = "github"
    gmail = "gmail"
    linear = "linear"
    atlassian = "atlassian"
    slack = "slack"
    notion = "notion"
    figma = "figma"
    terse = "terse"
    posthog = "posthog"
    datadog = "datadog"
    cron_job = "cron_job"
    launchdarkly = "launchdarkly"
    workos = "workos"
    attio = "attio"
    snowflake = "snowflake"


class BaseConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[IntegrationTypeEnum, Field(alias="integrationType")]
    config_type: Annotated[ConfigTypeEnum, Field(alias="configType")]


class ConfluenceConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["atlassian"], Field(alias="integrationType")] = "atlassian"
    config_type: Annotated[Literal["confluence"], Field(alias="configType")] = "confluence"
    space_name: Annotated[str, Field(alias="spaceName")]
    space_id: Annotated[str, Field(alias="spaceId")]
    page_id: Annotated[str, Field(alias="pageId")]
    page_name: Annotated[str, Field(alias="pageName")]


class DatadogConfigInstanceDefaultIndexes(RootModel[list[str]]):
    root: Annotated[list[str], Field(title="DatadogConfigInstanceDefaultIndexes")] = ["main"]


class DatadogConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["datadog"], Field(alias="integrationType")] = "datadog"
    config_type: Annotated[Literal["DATADOG"], Field(alias="configType")] = "DATADOG"
    default_indexes: Annotated[
        DatadogConfigInstanceDefaultIndexes,
        Field(
            alias="defaultIndexes",
            title="DatadogConfigInstanceDefaultIndexes",
            validate_default=True,
        ),
    ]


class DatadogIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    region: str


class FigmaEventType(StrEnum):
    file_comment = "file_comment"


class FigmaConfigInstanceEventTypes(RootModel[list[FigmaEventType] | None]):
    root: Annotated[list[FigmaEventType] | None, Field(title="FigmaConfigInstanceEventTypes")]


class FigmaConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["figma"], Field(alias="integrationType")] = "figma"
    config_type: Annotated[Literal["figma"], Field(alias="configType")] = "figma"
    file_key: Annotated[str, Field(alias="fileKey")]
    file_name: Annotated[str, Field(alias="fileName")]
    team_id: Annotated[str, Field(alias="teamId")]
    event_types: Annotated[
        FigmaConfigInstanceEventTypes | None,
        Field(alias="eventTypes", title="FigmaConfigInstanceEventTypes"),
    ]


class FigmaIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    handle: str
    figma_user_id: str
    token_expiry: AwareDatetime


class GitHubEventType(StrEnum):
    push = "push"
    pull_request_opened = "pull_request.opened"
    pull_request_merged = "pull_request.merged"
    pull_request_closed = "pull_request.closed"
    pull_request_synchronize = "pull_request.synchronize"


class GitHubConfigInstanceEventTypes(RootModel[list[GitHubEventType] | None]):
    root: Annotated[list[GitHubEventType] | None, Field(title="GitHubConfigInstanceEventTypes")]


class GitHubConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["github"], Field(alias="integrationType")] = "github"
    config_type: Annotated[Literal["github"], Field(alias="configType")] = "github"
    repository_ids: Annotated[list[int], Field(alias="repositoryIds")]
    event_types: Annotated[
        GitHubConfigInstanceEventTypes | None,
        Field(alias="eventTypes", title="GitHubConfigInstanceEventTypes"),
    ]


class GitHubIntegrationInstanceInstallationId(RootModel[int]):
    root: Annotated[int, Field(title="GitHubIntegrationInstanceInstallationId")]


class GitHubIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    installation_id: Annotated[
        GitHubIntegrationInstanceInstallationId,
        Field(title="GitHubIntegrationInstanceInstallationId"),
    ]
    account_name: str | None = None


class GmailEventType(StrEnum):
    email_received = "email.received"


class GmailConfigInstanceEventTypes(RootModel[list[GmailEventType] | None]):
    root: Annotated[list[GmailEventType] | None, Field(title="GmailConfigInstanceEventTypes")]


class GmailConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["gmail"], Field(alias="integrationType")] = "gmail"
    config_type: Annotated[Literal["gmail"], Field(alias="configType")] = "gmail"
    event_types: Annotated[
        GmailConfigInstanceEventTypes | None,
        Field(alias="eventTypes", title="GmailConfigInstanceEventTypes"),
    ]


class GmailDraftOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["gmail"], Field(alias="integrationType")] = "gmail"
    config_type: Annotated[Literal["gmail_draft_output"], Field(alias="configType")] = "gmail_draft_output"


class GmailIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
        regex_engine="python-re",
    )
    id: str
    email: Annotated[
        EmailStr,
        Field(
            pattern="^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"
        ),
    ]
    history_id: Annotated[str | None, Field(alias="historyId")] = None
    watch_expiration: Annotated[AwareDatetime | None, Field(alias="watchExpiration")] = None


class GmailOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["gmail"], Field(alias="integrationType")] = "gmail"
    config_type: Annotated[Literal["gmail_output"], Field(alias="configType")] = "gmail_output"


class BaseIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str


class IntegrationWithStatus(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[IntegrationTypeEnum, Field(alias="integrationType")]
    is_active: Annotated[bool, Field(alias="isActive")]


class JiraEventType(StrEnum):
    issue_created = "issue.created"
    issue_updated = "issue.updated"


class JiraConfigInstanceProjectKey(RootModel[str | None]):
    root: Annotated[str | None, Field(title="JiraConfigInstanceProjectKey")]


class JiraConfigInstanceProjectId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="JiraConfigInstanceProjectId")]


class JiraConfigInstanceEventTypes(RootModel[list[JiraEventType] | None]):
    root: Annotated[list[JiraEventType] | None, Field(title="JiraConfigInstanceEventTypes")]


class JiraConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["atlassian"], Field(alias="integrationType")] = "atlassian"
    config_type: Annotated[Literal["jira"], Field(alias="configType")] = "jira"
    project_key: Annotated[
        JiraConfigInstanceProjectKey | None,
        Field(alias="projectKey", title="JiraConfigInstanceProjectKey"),
    ]
    project_id: Annotated[
        JiraConfigInstanceProjectId | None,
        Field(alias="projectId", title="JiraConfigInstanceProjectId"),
    ]
    event_types: Annotated[
        JiraConfigInstanceEventTypes | None,
        Field(alias="eventTypes", title="JiraConfigInstanceEventTypes"),
    ]


class LaunchDarklyConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["launchdarkly"], Field(alias="integrationType")] = "launchdarkly"
    config_type: Annotated[Literal["launchdarkly"], Field(alias="configType")] = "launchdarkly"
    project_key: Annotated[str, Field(alias="projectKey")]
    environment_keys: Annotated[list[str], Field(alias="environmentKeys")]


class LaunchDarklyIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
        regex_engine="python-re",
    )
    id: str
    email: Annotated[
        EmailStr | None,
        Field(
            pattern="^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"
        ),
    ] = None
    token_name: Annotated[str | None, Field(alias="tokenName")] = None


class LinearEventType(StrEnum):
    issue_created = "issue.created"
    issue_updated = "issue.updated"
    comment_created = "comment.created"


class LinearInputConfigInstanceProjectId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearInputConfigInstanceProjectId")]


class LinearInputConfigInstanceProjectName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearInputConfigInstanceProjectName")]


class LinearInputConfigInstanceEventTypes(RootModel[list[LinearEventType] | None]):
    root: Annotated[list[LinearEventType] | None, Field(title="LinearInputConfigInstanceEventTypes")]


class LinearInputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["linear"], Field(alias="integrationType")] = "linear"
    config_type: Annotated[Literal["linear_input"], Field(alias="configType")] = "linear_input"
    project_id: Annotated[
        LinearInputConfigInstanceProjectId | None,
        Field(alias="projectId", title="LinearInputConfigInstanceProjectId"),
    ]
    project_name: Annotated[
        LinearInputConfigInstanceProjectName | None,
        Field(alias="projectName", title="LinearInputConfigInstanceProjectName"),
    ]
    event_types: Annotated[
        LinearInputConfigInstanceEventTypes | None,
        Field(alias="eventTypes", title="LinearInputConfigInstanceEventTypes"),
    ]


class LinearIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    workspace_name: Annotated[str, Field(alias="workspaceName")]


class LinearOutputConfigInstanceTeamId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearOutputConfigInstanceTeamId")]


class LinearOutputConfigInstanceTeamName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearOutputConfigInstanceTeamName")]


class LinearOutputConfigInstanceProjectId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearOutputConfigInstanceProjectId")]


class LinearOutputConfigInstanceProjectName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearOutputConfigInstanceProjectName")]


class LinearOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["linear"], Field(alias="integrationType")] = "linear"
    config_type: Annotated[Literal["linear_output"], Field(alias="configType")] = "linear_output"
    team_id: Annotated[
        LinearOutputConfigInstanceTeamId | None,
        Field(alias="teamId", title="LinearOutputConfigInstanceTeamId"),
    ]
    team_name: Annotated[
        LinearOutputConfigInstanceTeamName | None,
        Field(alias="teamName", title="LinearOutputConfigInstanceTeamName"),
    ]
    project_id: Annotated[
        LinearOutputConfigInstanceProjectId | None,
        Field(alias="projectId", title="LinearOutputConfigInstanceProjectId"),
    ]
    project_name: Annotated[
        LinearOutputConfigInstanceProjectName | None,
        Field(alias="projectName", title="LinearOutputConfigInstanceProjectName"),
    ]


class NotionConfigInstanceDatabaseIds(RootModel[list[str]]):
    root: Annotated[list[str], Field(title="NotionConfigInstanceDatabaseIds")] = []


class NotionConfigInstanceDatabaseNames(RootModel[list[str]]):
    root: Annotated[list[str], Field(title="NotionConfigInstanceDatabaseNames")] = []


class NotionConfigInstancePageIds(RootModel[list[str]]):
    root: Annotated[list[str], Field(title="NotionConfigInstancePageIds")] = []


class NotionConfigInstancePageNames(RootModel[list[str]]):
    root: Annotated[list[str], Field(title="NotionConfigInstancePageNames")] = []


class NotionConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["notion"], Field(alias="integrationType")] = "notion"
    config_type: Annotated[Literal["notion"], Field(alias="configType")] = "notion"
    database_ids: Annotated[
        NotionConfigInstanceDatabaseIds,
        Field(
            alias="databaseIds",
            title="NotionConfigInstanceDatabaseIds",
            validate_default=True,
        ),
    ]
    database_names: Annotated[
        NotionConfigInstanceDatabaseNames,
        Field(
            alias="databaseNames",
            title="NotionConfigInstanceDatabaseNames",
            validate_default=True,
        ),
    ]
    page_ids: Annotated[
        NotionConfigInstancePageIds,
        Field(alias="pageIds", title="NotionConfigInstancePageIds", validate_default=True),
    ]
    page_names: Annotated[
        NotionConfigInstancePageNames,
        Field(
            alias="pageNames",
            title="NotionConfigInstancePageNames",
            validate_default=True,
        ),
    ]


class NotionIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    workspace_id: Annotated[str | None, Field(alias="workspaceId")] = None
    workspace_name: Annotated[str | None, Field(alias="workspaceName")] = None


class PosthogConfigInstanceProjectName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="PosthogConfigInstanceProjectName")]


class PosthogConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["posthog"], Field(alias="integrationType")] = "posthog"
    config_type: Annotated[Literal["POSTHOG"], Field(alias="configType")] = "POSTHOG"
    project_id: Annotated[str, Field(alias="projectId")]
    project_name: Annotated[
        PosthogConfigInstanceProjectName | None,
        Field(alias="projectName", title="PosthogConfigInstanceProjectName"),
    ]


class PosthogIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
        regex_engine="python-re",
    )
    id: str
    email: Annotated[
        EmailStr | None,
        Field(
            pattern="^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"
        ),
    ] = None
    org_name: Annotated[str | None, Field(alias="orgName")] = None


class SlackEventType(StrEnum):
    message = "message"
    app_mention = "app_mention"
    reaction_added = "reaction_added"


class SlackConfigInstanceChannelId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SlackConfigInstanceChannelId")]


class SlackConfigInstanceChannelName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SlackConfigInstanceChannelName")]


class SlackConfigInstanceListenToUserDms(RootModel[bool]):
    root: Annotated[bool, Field(title="SlackConfigInstanceListenToUserDms")] = False


class SlackConfigInstanceUserIds(RootModel[list[str] | None]):
    root: Annotated[list[str] | None, Field(title="SlackConfigInstanceUserIds")]


class SlackConfigInstanceEventTypes(RootModel[list[SlackEventType] | None]):
    root: Annotated[list[SlackEventType] | None, Field(title="SlackConfigInstanceEventTypes")]


class SlackConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["slack"], Field(alias="integrationType")] = "slack"
    config_type: Annotated[Literal["slack"], Field(alias="configType")] = "slack"
    channel_id: Annotated[
        SlackConfigInstanceChannelId | None,
        Field(alias="channelId", title="SlackConfigInstanceChannelId"),
    ]
    channel_name: Annotated[
        SlackConfigInstanceChannelName | None,
        Field(alias="channelName", title="SlackConfigInstanceChannelName"),
    ]
    listen_to_user_dms: Annotated[
        SlackConfigInstanceListenToUserDms,
        Field(
            alias="listenToUserDms",
            title="SlackConfigInstanceListenToUserDms",
            validate_default=True,
        ),
    ]
    user_ids: Annotated[
        SlackConfigInstanceUserIds | None,
        Field(alias="userIds", title="SlackConfigInstanceUserIds"),
    ]
    event_types: Annotated[
        SlackConfigInstanceEventTypes | None,
        Field(alias="eventTypes", title="SlackConfigInstanceEventTypes"),
    ]


class SlackIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    team_id: Annotated[str | None, Field(alias="teamId")] = None
    team_name: Annotated[str | None, Field(alias="teamName")] = None
    is_bot_user: Annotated[bool | None, Field(alias="isBotUser")] = None


class SlackOutputConfigInstanceChannelId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SlackOutputConfigInstanceChannelId")]


class SlackOutputConfigInstanceChannelName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SlackOutputConfigInstanceChannelName")]


class SlackOutputConfigInstanceUserIds(RootModel[list[str] | None]):
    root: Annotated[list[str] | None, Field(title="SlackOutputConfigInstanceUserIds")]


class SlackOutputConfigInstanceUserNames(RootModel[list[str] | None]):
    root: Annotated[list[str] | None, Field(title="SlackOutputConfigInstanceUserNames")]


class SlackOutputConfigInstanceListenToUserDms(RootModel[bool]):
    root: Annotated[bool, Field(title="SlackOutputConfigInstanceListenToUserDms")] = False


class SlackOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["slack"], Field(alias="integrationType")] = "slack"
    config_type: Annotated[Literal["slack_output"], Field(alias="configType")] = "slack_output"
    channel_id: Annotated[
        SlackOutputConfigInstanceChannelId | None,
        Field(alias="channelId", title="SlackOutputConfigInstanceChannelId"),
    ]
    channel_name: Annotated[
        SlackOutputConfigInstanceChannelName | None,
        Field(alias="channelName", title="SlackOutputConfigInstanceChannelName"),
    ]
    user_ids: Annotated[
        SlackOutputConfigInstanceUserIds | None,
        Field(alias="userIds", title="SlackOutputConfigInstanceUserIds"),
    ]
    user_names: Annotated[
        SlackOutputConfigInstanceUserNames | None,
        Field(alias="userNames", title="SlackOutputConfigInstanceUserNames"),
    ]
    listen_to_user_dms: Annotated[
        SlackOutputConfigInstanceListenToUserDms,
        Field(
            alias="listenToUserDms",
            title="SlackOutputConfigInstanceListenToUserDms",
            validate_default=True,
        ),
    ]


class SnowflakeIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    account_identifier: Annotated[str, Field(alias="accountIdentifier")]
    username: str
    warehouse: str
    database_name: Annotated[str | None, Field(alias="databaseName")] = None
    schema_name: Annotated[str | None, Field(alias="schemaName")] = None


class SnowflakeOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["snowflake"], Field(alias="integrationType")] = "snowflake"
    config_type: Annotated[Literal["snowflake_output"], Field(alias="configType")] = "snowflake_output"


class TerseConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[Literal["system"], Field(alias="integrationId")] = "system"
    integration_type: Annotated[Literal["terse"], Field(alias="integrationType")] = "terse"
    config_type: Annotated[Literal["terse"], Field(alias="configType")] = "terse"


class TimeTriggerConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[Literal["system"], Field(alias="integrationId")] = "system"
    integration_type: Annotated[Literal["cron_job"], Field(alias="integrationType")] = "cron_job"
    config_type: Annotated[Literal["time_trigger"], Field(alias="configType")] = "time_trigger"
    cron_expression: Annotated[str, Field(alias="cronExpression")]


class WorkOSEventType(StrEnum):
    user_created = "user.created"
    user_updated = "user.updated"
    user_deleted = "user.deleted"
    organization_created = "organization.created"
    organization_membership_created = "organization_membership.created"
    organization_membership_updated = "organization_membership.updated"
    organization_membership_deleted = "organization_membership.deleted"
    invitation_created = "invitation.created"
    invitation_accepted = "invitation.accepted"
    invitation_resent = "invitation.resent"
    invitation_revoked = "invitation.revoked"


class WorkOSInputConfigInstanceEventTypes(RootModel[list[WorkOSEventType]]):
    root: Annotated[list[WorkOSEventType], Field(title="WorkOSInputConfigInstanceEventTypes")] = []


class WorkOSInputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    config_type: Annotated[Literal["workos_input"], Field(alias="configType")] = "workos_input"
    event_types: Annotated[
        WorkOSInputConfigInstanceEventTypes,
        Field(
            alias="eventTypes",
            title="WorkOSInputConfigInstanceEventTypes",
            validate_default=True,
        ),
    ]


class Environment(StrEnum):
    live = "live"
    test = "test"


class WorkOSIntegration(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    webhook_url: Annotated[str, Field(alias="webhookUrl")]
    environment: Environment


class WorkOSOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    config_type: Annotated[Literal["workos_output"], Field(alias="configType")] = "workos_output"


class OutputItem(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    output_item_id: str
    output_item_type: ConfigTypeEnum


class RunHistoryActionType(StrEnum):
    create = "create"
    update = "update"
    delete = "delete"
    read = "read"
    approve = "approve"
    error = "error"


class RunHistoryAction(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    action: str
    integration: IntegrationTypeEnum
    target: str
    details: str
    url: str | None = None
    step_id: str | None = None
    type: RunHistoryActionType
    is_read_only: Annotated[bool | None, Field(alias="isReadOnly")] = None
    output_items: list[OutputItem] | None = None


class Action(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["action"] = "action"
    action: RunHistoryAction


class CommitAssociation(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    sha: str
    message: str
    url: str


class SubActivity(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    summary: str
    commits: list[CommitAssociation]


class ActivityEvent(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    event_type: str
    title: str
    github_repository_owner_id: str
    github_repository_name: str
    created_at: AwareDatetime
    sub_activities: list[SubActivity]


class AgentActivityItemRunCount(RootModel[int]):
    root: Annotated[int, Field(title="AgentActivityItemRunCount")]


class AgentActivityItem(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    agent_id: Annotated[str, Field(alias="agentId")]
    agent_name: Annotated[str, Field(alias="agentName")]
    run_count: Annotated[
        AgentActivityItemRunCount,
        Field(alias="runCount", title="AgentActivityItemRunCount"),
    ]


class AgentAndImprovementParams(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    agent_id: Annotated[str, Field(alias="agentId")]
    id: str


class AgentNotificationSettings(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    enabled: bool
    action_types: Annotated[list[RunHistoryActionType], Field(alias="actionTypes")]


class ConfigData(
    RootModel[
        GmailConfigInstance
        | FigmaConfigInstance
        | SlackConfigInstance
        | SlackOutputConfigInstance
        | GmailOutputConfigInstance
        | GmailDraftOutputConfigInstance
        | NotionConfigInstance
        | LinearInputConfigInstance
        | LinearOutputConfigInstance
        | GitHubConfigInstance
        | JiraConfigInstance
        | ConfluenceConfigInstance
        | PosthogConfigInstance
        | DatadogConfigInstance
        | TimeTriggerConfigInstance
        | LaunchDarklyConfigInstance
        | TerseConfigInstance
        | WorkOSInputConfigInstance
        | WorkOSOutputConfigInstance
        | AttioOutputConfigInstance
        | SnowflakeOutputConfigInstance
    ]
):
    root: (
        GmailConfigInstance
        | FigmaConfigInstance
        | SlackConfigInstance
        | SlackOutputConfigInstance
        | GmailOutputConfigInstance
        | GmailDraftOutputConfigInstance
        | NotionConfigInstance
        | LinearInputConfigInstance
        | LinearOutputConfigInstance
        | GitHubConfigInstance
        | JiraConfigInstance
        | ConfluenceConfigInstance
        | PosthogConfigInstance
        | DatadogConfigInstance
        | TimeTriggerConfigInstance
        | LaunchDarklyConfigInstance
        | TerseConfigInstance
        | WorkOSInputConfigInstance
        | WorkOSOutputConfigInstance
        | AttioOutputConfigInstance
        | SnowflakeOutputConfigInstance
    )


class AgentOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    config: ConfigData


class AgentTrigger(AgentOutput):
    pass


class AgentPrompt(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    text: str


class AgentCreateNotificationSettings(RootModel[AgentNotificationSettings | None]):
    root: Annotated[AgentNotificationSettings | None, Field(title="AgentCreateNotificationSettings")]


class AgentCreateToolApprovals(RootModel[list[str] | None]):
    root: Annotated[list[str] | None, Field(title="AgentCreateToolApprovals")]


class AgentCreate(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    is_active: Annotated[bool, Field(alias="isActive")]
    require_approval: Annotated[bool, Field(alias="requireApproval")]
    prompt: AgentPrompt
    triggers: list[AgentTrigger]
    outputs: list[AgentOutput]
    notification_settings: Annotated[
        AgentCreateNotificationSettings | None,
        Field(alias="notificationSettings", title="AgentCreateNotificationSettings"),
    ]
    tool_approvals: Annotated[
        AgentCreateToolApprovals | None,
        Field(alias="toolApprovals", title="AgentCreateToolApprovals"),
    ]


class AgentDraftNotificationSettings(RootModel[AgentNotificationSettings | None]):
    root: Annotated[AgentNotificationSettings | None, Field(title="AgentDraftNotificationSettings")]


class AgentDraftToolApprovals(RootModel[list[str] | None]):
    root: Annotated[list[str] | None, Field(title="AgentDraftToolApprovals")]


class AgentDraftId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="AgentDraftId")]


class AgentDraft(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    is_active: Annotated[bool, Field(alias="isActive")]
    require_approval: Annotated[bool, Field(alias="requireApproval")]
    prompt: AgentPrompt
    triggers: list[AgentTrigger]
    outputs: list[AgentOutput]
    notification_settings: Annotated[
        AgentDraftNotificationSettings | None,
        Field(alias="notificationSettings", title="AgentDraftNotificationSettings"),
    ]
    tool_approvals: Annotated[
        AgentDraftToolApprovals | None,
        Field(alias="toolApprovals", title="AgentDraftToolApprovals"),
    ]
    id: Annotated[AgentDraftId | None, Field(title="AgentDraftId")]
    created_by_user_id: Annotated[str, Field(alias="createdByUserId")]


class AgentIdParams(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    agent_id: Annotated[str, Field(alias="agentId")]


class AgentImprovementStatus(StrEnum):
    pending = "PENDING"
    applied = "APPLIED"
    dismissed = "DISMISSED"


class AgentImprovementTargetArea(StrEnum):
    prompt = "prompt"
    trigger_config = "trigger_config"
    output_config = "output_config"
    general = "general"
    code = "code"


class AgentImprovement(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    review_id: Annotated[str, Field(alias="reviewId")]
    automation_id: Annotated[str, Field(alias="automationId")]
    title: str
    description: str
    target_area: Annotated[AgentImprovementTargetArea, Field(alias="targetArea")]
    confidence: float
    status: AgentImprovementStatus
    suggested_patch: Annotated[str | None, Field(alias="suggestedPatch")] = None
    applied_prompt: Annotated[str | None, Field(alias="appliedPrompt")] = None
    applied_at: Annotated[str | None, Field(alias="appliedAt")] = None
    dismissed_at: Annotated[str | None, Field(alias="dismissedAt")] = None
    created_at: Annotated[str, Field(alias="createdAt")]
    updated_at: Annotated[str, Field(alias="updatedAt")]


class AgentReviewRunsAnalyzed(RootModel[int]):
    root: Annotated[int, Field(title="AgentReviewRunsAnalyzed")]


class AgentReview(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    automation_id: Annotated[str, Field(alias="automationId")]
    title: str
    summary: str
    runs_analyzed: Annotated[
        AgentReviewRunsAnalyzed,
        Field(alias="runsAnalyzed", title="AgentReviewRunsAnalyzed"),
    ]
    review_period_start: Annotated[str, Field(alias="reviewPeriodStart")]
    review_period_end: Annotated[str, Field(alias="reviewPeriodEnd")]
    created_at: Annotated[str, Field(alias="createdAt")]


class AgentNotificationSettings1(RootModel[AgentNotificationSettings | None]):
    root: Annotated[AgentNotificationSettings | None, Field(title="AgentNotificationSettings")]


class AgentToolApprovals(RootModel[list[str] | None]):
    root: Annotated[list[str] | None, Field(title="AgentToolApprovals")]


class AgentUpdatedAt(RootModel[str | None]):
    root: Annotated[str | None, Field(title="AgentUpdatedAt")]


class AgentSource1(StrEnum):
    web_ui = "WEB_UI"
    sdk = "SDK"


class AgentSource(RootModel[AgentSource1 | None]):
    root: Annotated[AgentSource1 | None, Field(title="AgentSource")]


class Agent(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    is_active: Annotated[bool, Field(alias="isActive")]
    require_approval: Annotated[bool, Field(alias="requireApproval")]
    prompt: AgentPrompt
    triggers: list[AgentTrigger]
    outputs: list[AgentOutput]
    created_by_user_id: Annotated[str, Field(alias="createdByUserId")]
    notification_settings: Annotated[
        AgentNotificationSettings1 | None,
        Field(alias="notificationSettings", title="AgentNotificationSettings"),
    ]
    tool_approvals: Annotated[
        AgentToolApprovals | None,
        Field(alias="toolApprovals", title="AgentToolApprovals"),
    ]
    updated_at: Annotated[AgentUpdatedAt | None, Field(alias="updatedAt", title="AgentUpdatedAt")]
    source: Annotated[AgentSource | None, Field(title="AgentSource")]


class TemplateConfigRef(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    config_type: Annotated[ConfigTypeEnum, Field(alias="configType")]
    integration_type: Annotated[IntegrationTypeEnum, Field(alias="integrationType")]


class TemplateOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    config: TemplateConfigRef


class TemplateTrigger(TemplateOutput):
    pass


class TemplateCategory(StrEnum):
    ship = "ship"
    users = "users"
    sync = "sync"
    track = "track"


class AgentTemplate(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    category: TemplateCategory
    name: str
    description: str
    chat_prompt: Annotated[str, Field(alias="chatPrompt")]
    prompt: AgentPrompt
    triggers: list[TemplateTrigger]
    outputs: list[TemplateOutput]
    require_approval: Annotated[bool, Field(alias="requireApproval")]
    is_active: Annotated[bool, Field(alias="isActive")]


class AgentUpdateNotificationSettings(RootModel[AgentNotificationSettings | None]):
    root: Annotated[AgentNotificationSettings | None, Field(title="AgentUpdateNotificationSettings")]


class AgentUpdateToolApprovals(RootModel[list[str] | None]):
    root: Annotated[list[str] | None, Field(title="AgentUpdateToolApprovals")]


class AgentUpdate(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str | None = None
    triggers: list[AgentTrigger] | None = None
    outputs: list[AgentOutput] | None = None
    prompt: AgentPrompt | None = None
    is_active: Annotated[bool | None, Field(alias="isActive")] = None
    require_approval: Annotated[bool | None, Field(alias="requireApproval")] = None
    notification_settings: Annotated[
        AgentUpdateNotificationSettings | None,
        Field(alias="notificationSettings", title="AgentUpdateNotificationSettings"),
    ] = None
    tool_approvals: Annotated[
        AgentUpdateToolApprovals | None,
        Field(alias="toolApprovals", title="AgentUpdateToolApprovals"),
    ] = None


class Pagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    page: float
    limit: float
    total: float
    total_pages: Annotated[float, Field(alias="totalPages")]


class AgentsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    agents: list[Agent]
    pagination: Pagination


class DatadogAggregationGroupByLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of groups to return (default: 10)",
            title="DatadogAggregationGroupByLimit",
        ),
    ] = 10


class DatadogAggregationGroupByTotal(RootModel[bool]):
    root: Annotated[
        bool,
        Field(
            description='Include "total" group with all events combined (default: false)',
            title="DatadogAggregationGroupByTotal",
        ),
    ] = False


class DatadogAggregationGroupBy(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    facet: Annotated[
        str,
        Field(description="Facet to group by (e.g., @view.name, @service, @browser.name)"),
    ]
    limit: Annotated[
        DatadogAggregationGroupByLimit,
        Field(
            description="Maximum number of groups to return (default: 10)",
            title="DatadogAggregationGroupByLimit",
            validate_default=True,
        ),
    ]
    total: Annotated[
        DatadogAggregationGroupByTotal,
        Field(
            description='Include "total" group with all events combined (default: false)',
            title="DatadogAggregationGroupByTotal",
            validate_default=True,
        ),
    ]


class Aggregation(StrEnum):
    count = "count"
    pc90 = "pc90"
    pc95 = "pc95"
    pc99 = "pc99"
    avg = "avg"
    sum = "sum"
    min = "min"
    max = "max"
    cardinality = "cardinality"


class DatadogAggregationComputeType(StrEnum):
    total = "total"
    timeseries = "timeseries"


class DatadogAggregationCompute(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    aggregation: Annotated[
        Aggregation,
        Field(description="Aggregation: count, pc90/pc95/pc99, avg, sum, min, max, cardinality"),
    ]
    metric: Annotated[
        str,
        Field(description='Metric to compute (e.g., @view.loading_time, @duration). Use "*" for count of all events.'),
    ]
    type: Annotated[
        DatadogAggregationComputeType,
        Field(
            description='Computation type: "total" (overall) or "timeseries" (time-bucketed)',
            title="DatadogAggregationComputeType",
        ),
    ]


class AggregateRumEventsToolInputQuery(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Datadog RUM search query to filter events before aggregation (e.g., @type:view)",
            title="AggregateRumEventsToolInputQuery",
        ),
    ]


class AggregateRumEventsToolInputTo(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='End time (ISO8601). Defaults to "now" if not provided.',
            title="AggregateRumEventsToolInputTo",
        ),
    ]


class AggregateRumEventsToolInputGroupBy(RootModel[list[DatadogAggregationGroupBy] | None]):
    root: Annotated[
        list[DatadogAggregationGroupBy] | None,
        Field(
            description="Facets to group results by",
            title="AggregateRumEventsToolInputGroupBy",
        ),
    ]


class AggregateRumEventsToolInputTimezone(RootModel[str]):
    root: Annotated[
        str,
        Field(
            description='Timezone for time-based queries (default: "GMT")',
            title="AggregateRumEventsToolInputTimezone",
        ),
    ] = "GMT"


class AggregateRumEventsToolInputPageLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of buckets to return (default: 25)",
            title="AggregateRumEventsToolInputPageLimit",
        ),
    ] = 25


class AggregateRumEventsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    query: Annotated[
        AggregateRumEventsToolInputQuery | None,
        Field(
            description="Datadog RUM search query to filter events before aggregation (e.g., @type:view)",
            title="AggregateRumEventsToolInputQuery",
        ),
    ] = None
    from_: Annotated[
        str,
        Field(alias="from", description='Start time (ISO8601 or relative like "now-15m")'),
    ]
    to: Annotated[
        AggregateRumEventsToolInputTo | None,
        Field(
            description='End time (ISO8601). Defaults to "now" if not provided.',
            title="AggregateRumEventsToolInputTo",
        ),
    ] = None
    compute: Annotated[
        list[DatadogAggregationCompute],
        Field(description="Array of metrics to compute. At least one required."),
    ]
    group_by: Annotated[
        AggregateRumEventsToolInputGroupBy | None,
        Field(
            alias="groupBy",
            description="Facets to group results by",
            title="AggregateRumEventsToolInputGroupBy",
        ),
    ]
    timezone: Annotated[
        AggregateRumEventsToolInputTimezone,
        Field(
            description='Timezone for time-based queries (default: "GMT")',
            title="AggregateRumEventsToolInputTimezone",
            validate_default=True,
        ),
    ]
    page_limit: Annotated[
        AggregateRumEventsToolInputPageLimit,
        Field(
            alias="pageLimit",
            description="Maximum number of buckets to return (default: 25)",
            title="AggregateRumEventsToolInputPageLimit",
            validate_default=True,
        ),
    ]
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Datadog skill to use.",
        ),
    ]


class AggregateRumEventsInput(RootModel[AggregateRumEventsToolInput]):
    root: AggregateRumEventsToolInput


class DatadogAggregationMeta(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    elapsed: float | None = None
    request_id: Annotated[str | None, Field(alias="requestId")] = None
    status: Any | None = None


class DatadogPagePaginationLimit(RootModel[int]):
    root: Annotated[int, Field(title="DatadogPagePaginationLimit")]


class DatadogPagePaginationNextCursor(RootModel[str | None]):
    root: Annotated[str | None, Field(title="DatadogPagePaginationNextCursor")]


class DatadogPagePagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    limit: Annotated[DatadogPagePaginationLimit, Field(title="DatadogPagePaginationLimit")]
    next_cursor: Annotated[
        DatadogPagePaginationNextCursor | None,
        Field(alias="nextCursor", title="DatadogPagePaginationNextCursor"),
    ]
    has_more: Annotated[bool, Field(alias="hasMore")]
    showing: str


class DatadogAggregationBucketCompute(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    value: Any
    aggregation: str
    metric: str


class DatadogAggregationBucket(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    by: dict[str, Any]
    computes: dict[str, DatadogAggregationBucketCompute]


class AggregateRumEventsToolOutputQuery(RootModel[str | None]):
    root: Annotated[str | None, Field(title="AggregateRumEventsToolOutputQuery")]


class AggregateRumEventsToolOutputTo(RootModel[str | None]):
    root: Annotated[str | None, Field(title="AggregateRumEventsToolOutputTo")]


class AggregateRumEventsToolOutputTotalBuckets(RootModel[int]):
    root: Annotated[int, Field(title="AggregateRumEventsToolOutputTotalBuckets")]


class AggregateRumEventsToolOutputWarnings(RootModel[str | None]):
    root: Annotated[str | None, Field(title="AggregateRumEventsToolOutputWarnings")]


class AggregateRumEventsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    query: Annotated[
        AggregateRumEventsToolOutputQuery | None,
        Field(title="AggregateRumEventsToolOutputQuery"),
    ]
    from_: Annotated[str, Field(alias="from")]
    to: Annotated[
        AggregateRumEventsToolOutputTo | None,
        Field(title="AggregateRumEventsToolOutputTo"),
    ]
    compute: str
    group_by: Annotated[str, Field(alias="groupBy")]
    total_buckets: Annotated[
        AggregateRumEventsToolOutputTotalBuckets,
        Field(alias="totalBuckets", title="AggregateRumEventsToolOutputTotalBuckets"),
    ]
    buckets: list[DatadogAggregationBucket]
    rum_link: Annotated[str, Field(alias="rumLink")]
    pagination: DatadogPagePagination
    warnings: Annotated[
        AggregateRumEventsToolOutputWarnings | None,
        Field(title="AggregateRumEventsToolOutputWarnings"),
    ]
    meta: DatadogAggregationMeta
    message: str


class ApiTokenCreateRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: Annotated[str, Field(max_length=100)]


class ApiTokenLastUsedAt(RootModel[str | None]):
    root: Annotated[str | None, Field(title="ApiTokenLastUsedAt")]


class ApiToken(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    token_prefix: Annotated[str, Field(alias="tokenPrefix")]
    created_at: Annotated[str, Field(alias="createdAt")]
    last_used_at: Annotated[ApiTokenLastUsedAt | None, Field(alias="lastUsedAt", title="ApiTokenLastUsedAt")]


class ApiTokenCreateResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    token: ApiToken
    raw_token: Annotated[str, Field(alias="rawToken")]


class ApiTokenUpdateRequest(ApiTokenCreateRequest):
    pass


class ApplyImprovementResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    applied_prompt: Annotated[str, Field(alias="appliedPrompt")]


class ApprovalActionType(StrEnum):
    open_run_history = "open_run_history"
    approve_action = "approve_action"
    reject_action = "reject_action"


class ApprovalAction(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: ApprovalActionType
    label: str
    deep_link: Annotated[str, Field(alias="deepLink")]


class ApprovalRequestStatus(StrEnum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"


class ApprovalRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    icon: IntegrationTypeEnum
    title: str
    subheader: str
    timestamp: str
    status: ApprovalRequestStatus
    actions: list[ApprovalAction]
    run_id: Annotated[str, Field(alias="runId")]
    agent_id: Annotated[str, Field(alias="agentId")]


class AttioAttribute(TerseModel):
    api_slug: str | None = None
    title: str | None = None
    type: str | None = None
    is_required: bool | None = None
    is_unique: bool | None = None


class AttioListObjectsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Attio workspace to use.",
        ),
    ]


class AttioListObjectsInput(RootModel[AttioListObjectsToolInput]):
    root: AttioListObjectsToolInput


class AttioObjectWithAttributes(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    api_slug: str
    singular_noun: str
    plural_noun: str
    attributes: list[AttioAttribute] | None = None


class AttioListObjectsToolOutputCount(RootModel[int]):
    root: Annotated[int, Field(title="AttioListObjectsToolOutputCount")]


class AttioListObjectsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    objects: list[AttioObjectWithAttributes]
    count: Annotated[AttioListObjectsToolOutputCount, Field(title="AttioListObjectsToolOutputCount")]


class AttioObject(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    api_slug: str
    singular_noun: str
    plural_noun: str


class AttioQueryRecordsToolInputFilter(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Optional Attio filter as a JSON string. Pass null for no filtering. Use shorthand (e.g. \'{"email_addresses":"test@example.com"}\') or verbose syntax with operators.',
            title="AttioQueryRecordsToolInputFilter",
        ),
    ]


class AttioQueryRecordsToolInputLimit(RootModel[int | None]):
    root: Annotated[
        int | None,
        Field(
            description="Maximum number of records to return. Pass null to use the default of 20.",
            title="AttioQueryRecordsToolInputLimit",
        ),
    ]


class AttioQueryRecordsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Attio workspace to use.",
        ),
    ]
    object_slug: Annotated[
        str,
        Field(
            alias="objectSlug",
            description="The Attio object type slug (e.g. 'people', 'companies').",
        ),
    ]
    filter: Annotated[
        AttioQueryRecordsToolInputFilter | None,
        Field(
            description='Optional Attio filter as a JSON string. Pass null for no filtering. Use shorthand (e.g. \'{"email_addresses":"test@example.com"}\') or verbose syntax with operators.',
            title="AttioQueryRecordsToolInputFilter",
        ),
    ]
    limit: Annotated[
        AttioQueryRecordsToolInputLimit | None,
        Field(
            description="Maximum number of records to return. Pass null to use the default of 20.",
            title="AttioQueryRecordsToolInputLimit",
        ),
    ]


class AttioQueryRecordsInput(RootModel[AttioQueryRecordsToolInput]):
    root: AttioQueryRecordsToolInput


class AttioRecordIdentifier(TerseModel):
    workspace_id: str | None = None
    object_id: str | None = None
    record_id: str | None = None


class AttioRecord(TerseModel):
    id: AttioRecordIdentifier | None = None
    values: dict[str, Any] | None = None
    web_url: str | None = None
    created_at: str | None = None


class AttioQueryRecordsToolOutputCount(RootModel[int]):
    root: Annotated[int, Field(title="AttioQueryRecordsToolOutputCount")]


class AttioQueryRecordsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    records: list[AttioRecord]
    count: Annotated[
        AttioQueryRecordsToolOutputCount,
        Field(title="AttioQueryRecordsToolOutputCount"),
    ]


class AttioUpsertErrorIndex(RootModel[int]):
    root: Annotated[int, Field(title="AttioUpsertErrorIndex")]


class AttioUpsertError(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    index: Annotated[AttioUpsertErrorIndex, Field(title="AttioUpsertErrorIndex")]
    message: str


class AttioUpsertRecordToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Attio workspace to use.",
        ),
    ]
    object_slug: Annotated[
        str,
        Field(
            alias="objectSlug",
            description="The Attio object type slug (e.g. 'people', 'companies').",
        ),
    ]
    matching_attribute: Annotated[
        str,
        Field(
            alias="matchingAttribute",
            description="The attribute slug to match on for upsert (e.g. 'email_addresses' for people, 'domains' for companies).",
        ),
    ]
    records: Annotated[
        str,
        Field(
            description='A JSON string representing a list of Attio records to upsert. Each record should map attribute slugs to their values. For multi-value attributes like email_addresses, pass an array of strings. Example: \'[{"email_addresses":["test@example.com"],"name":"John"}]\'.'
        ),
    ]


class AttioUpsertRecordInput(RootModel[AttioUpsertRecordToolInput]):
    root: AttioUpsertRecordToolInput


class AttioUpsertRecordToolOutputCount(RootModel[int]):
    root: Annotated[int, Field(title="AttioUpsertRecordToolOutputCount")]


class AttioUpsertRecordToolOutputRequestedCount(RootModel[int]):
    root: Annotated[int, Field(title="AttioUpsertRecordToolOutputRequestedCount")]


class AttioUpsertRecordToolOutputSuccessCount(RootModel[int]):
    root: Annotated[int, Field(title="AttioUpsertRecordToolOutputSuccessCount")]


class AttioUpsertRecordToolOutputFailureCount(RootModel[int]):
    root: Annotated[int, Field(title="AttioUpsertRecordToolOutputFailureCount")]


class AttioUpsertRecordToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    records: list[AttioRecord] | None = None
    count: Annotated[
        AttioUpsertRecordToolOutputCount | None,
        Field(title="AttioUpsertRecordToolOutputCount"),
    ] = None
    requested_count: Annotated[
        AttioUpsertRecordToolOutputRequestedCount | None,
        Field(alias="requestedCount", title="AttioUpsertRecordToolOutputRequestedCount"),
    ] = None
    success_count: Annotated[
        AttioUpsertRecordToolOutputSuccessCount | None,
        Field(alias="successCount", title="AttioUpsertRecordToolOutputSuccessCount"),
    ] = None
    failure_count: Annotated[
        AttioUpsertRecordToolOutputFailureCount | None,
        Field(alias="failureCount", title="AttioUpsertRecordToolOutputFailureCount"),
    ] = None
    partial: bool | None = None
    errors: list[AttioUpsertError] | None = None


class Button(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["button"] = "button"
    label: str
    url: str


class Cancelled(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["Cancelled"] = "Cancelled"
    reason: str | None = None
    timestamp: float


class ChangeEventType(StrEnum):
    created = "CREATED"
    updated = "UPDATED"
    action_executed = "ACTION_EXECUTED"


class EntityType(StrEnum):
    ticket = "ticket"
    comment = "comment"
    user = "user"
    action_event = "action_event"
    run_history_action = "run_history_action"


class ChangedItem(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type_name: EntityType
    id: str
    change_event_type: ChangeEventType


class Image(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["image"] = "image"
    url: str


class MultipleChoiceOption(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    label: str
    value: str


class MultipleChoice(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["multiple_choice"] = "multiple_choice"
    question_id: Annotated[str, Field(alias="questionId")]
    question: str
    options: list[MultipleChoiceOption]
    allow_multiple: Annotated[bool | None, Field(alias="allowMultiple")] = None


class Navigate(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["navigate"] = "navigate"
    path: str


class IntegrationPrompt(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["integration_prompt"] = "integration_prompt"
    integration: str
    message: str
    state_token: Annotated[str | None, Field(alias="stateToken")] = None


class SnippetVariant(RootModel[Button | IntegrationPrompt | Navigate | MultipleChoice | Image]):
    root: Button | IntegrationPrompt | Navigate | MultipleChoice | Image


class ChatSnippet1(TerseModel):
    id: str | None = None
    step_id: str | None = None
    selected_value: Annotated[str | None, Field(alias="selectedValue")] = None


class ChatSnippet2(Button, ChatSnippet1):
    pass


class ChatSnippet3(IntegrationPrompt, ChatSnippet1):
    pass


class ChatSnippet4(Navigate, ChatSnippet1):
    pass


class ChatSnippet5(MultipleChoice, ChatSnippet1):
    pass


class ChatSnippet6(Image, ChatSnippet1):
    pass


class ChatSnippet(RootModel[ChatSnippet2 | ChatSnippet3 | ChatSnippet4 | ChatSnippet5 | ChatSnippet6]):
    root: ChatSnippet2 | ChatSnippet3 | ChatSnippet4 | ChatSnippet5 | ChatSnippet6


class ConfigurationOption(MultipleChoiceOption):
    pass


class ConfigurationFieldType(StrEnum):
    radio = "radio"
    select = "select"


class ConfigurationFieldDefinition(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    type: ConfigurationFieldType
    label: str
    options: list[ConfigurationOption]
    required: bool | None = None
    hint: str | None = None


class ConfluenceAddCommentToolInputTextToCommentOn(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional: The specific text in the page that this comment refers to. If provided, the tool will try to find this text and attach the comment to it. If not provided, you must specify start_position and end_position.",
            title="ConfluenceAddCommentToolInputTextToCommentOn",
        ),
    ]


class ConfluenceAddCommentToolInputStartPosition(RootModel[int | None]):
    root: Annotated[
        int | None,
        Field(
            description="Optional: The start character position (offset) in the page storage format where the comment should be attached. Required if text_to_comment_on is not provided.",
            title="ConfluenceAddCommentToolInputStartPosition",
        ),
    ]


class ConfluenceAddCommentToolInputEndPosition(RootModel[int | None]):
    root: Annotated[
        int | None,
        Field(
            description="Optional: The end character position (offset) in the page storage format where the comment should be attached. Required if text_to_comment_on is not provided.",
            title="ConfluenceAddCommentToolInputEndPosition",
        ),
    ]


class ConfluenceAddCommentToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Atlassian/Confluence integration to use.",
        ),
    ]
    page_id: Annotated[
        str,
        Field(alias="pageId", description="The Confluence page ID to add a comment to."),
    ]
    comment_text: Annotated[str, Field(description="The text content of the comment to add.")]
    text_to_comment_on: Annotated[
        ConfluenceAddCommentToolInputTextToCommentOn | None,
        Field(
            description="Optional: The specific text in the page that this comment refers to. If provided, the tool will try to find this text and attach the comment to it. If not provided, you must specify start_position and end_position.",
            title="ConfluenceAddCommentToolInputTextToCommentOn",
        ),
    ] = None
    start_position: Annotated[
        ConfluenceAddCommentToolInputStartPosition | None,
        Field(
            description="Optional: The start character position (offset) in the page storage format where the comment should be attached. Required if text_to_comment_on is not provided.",
            title="ConfluenceAddCommentToolInputStartPosition",
        ),
    ] = None
    end_position: Annotated[
        ConfluenceAddCommentToolInputEndPosition | None,
        Field(
            description="Optional: The end character position (offset) in the page storage format where the comment should be attached. Required if text_to_comment_on is not provided.",
            title="ConfluenceAddCommentToolInputEndPosition",
        ),
    ] = None


class ConfluenceAddCommentInput(RootModel[ConfluenceAddCommentToolInput]):
    root: ConfluenceAddCommentToolInput


class ConfluenceCommentPositionStart(RootModel[int]):
    root: Annotated[int, Field(title="ConfluenceCommentPositionStart")]


class ConfluenceCommentPositionEnd(RootModel[int]):
    root: Annotated[int, Field(title="ConfluenceCommentPositionEnd")]


class ConfluenceCommentPosition(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    start: Annotated[ConfluenceCommentPositionStart, Field(title="ConfluenceCommentPositionStart")]
    end: Annotated[ConfluenceCommentPositionEnd, Field(title="ConfluenceCommentPositionEnd")]


class ConfluenceAddCommentToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    comment_id: str
    comment_text: str
    position: ConfluenceCommentPosition
    text_commented_on: str | None = None
    message: str


class ConfluenceBodyRepresentation(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    value: str
    representation: str


class ConfluenceBodyContent(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    storage: ConfluenceBodyRepresentation | None = None
    view: ConfluenceBodyRepresentation | None = None
    export_view: ConfluenceBodyRepresentation | None = None


class ConfluencePageRelation(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    title: str
    type: str


class ConfluencePageVersionAuthor(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: str
    username: str | None = None
    user_key: Annotated[str | None, Field(alias="userKey")] = None
    account_id: Annotated[str | None, Field(alias="accountId")] = None
    display_name: Annotated[str | None, Field(alias="displayName")] = None


class ConfluencePageVersionNumber(RootModel[int]):
    root: Annotated[int, Field(title="ConfluencePageVersionNumber")]


class ConfluencePageVersion(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    number: Annotated[ConfluencePageVersionNumber, Field(title="ConfluencePageVersionNumber")]
    when: str
    message: str | None = None
    by: ConfluencePageVersionAuthor | None = None


class ConfluencePageSpaceId(RootModel[str | float]):
    root: Annotated[str | float, Field(title="ConfluencePageSpaceId")]


class ConfluencePageSpace(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: Annotated[ConfluencePageSpaceId, Field(title="ConfluencePageSpaceId")]
    key: str
    name: str
    type: str


class ConfluencePageQueryResultAncestorsCount(RootModel[int]):
    root: Annotated[int, Field(title="ConfluencePageQueryResultAncestorsCount")]


class ConfluencePageQueryResultDescendantsCount(RootModel[int]):
    root: Annotated[int, Field(title="ConfluencePageQueryResultDescendantsCount")]


class ConfluencePageQueryResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    page_id: str
    title: str
    type: str
    status: str
    space: ConfluencePageSpace | None = None
    version: ConfluencePageVersion | None = None
    created_date: str | None = None
    last_modified: str | None = None
    url: str | None = None
    body: ConfluenceBodyContent
    body_text: str
    ancestors: list[ConfluencePageRelation]
    descendants: list[ConfluencePageRelation]
    ancestors_count: Annotated[
        ConfluencePageQueryResultAncestorsCount,
        Field(title="ConfluencePageQueryResultAncestorsCount"),
    ]
    descendants_count: Annotated[
        ConfluencePageQueryResultDescendantsCount,
        Field(title="ConfluencePageQueryResultDescendantsCount"),
    ]


class ConfluencePageVersion1(RootModel[int]):
    root: Annotated[int, Field(title="ConfluencePageVersion")]


class ConfluencePage(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    title: str
    space_id: Annotated[str, Field(alias="spaceId")]
    space_name: Annotated[str, Field(alias="spaceName")]
    url: str
    status: str
    version: Annotated[ConfluencePageVersion1, Field(title="ConfluencePageVersion")]


class ConfluencePagesQuery(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    space_id: Annotated[str | None, Field(alias="spaceId")] = None
    space_key: Annotated[str | None, Field(alias="spaceKey")] = None


class ConfluencePagesResponseTotal(RootModel[int]):
    root: Annotated[int, Field(title="ConfluencePagesResponseTotal")]


class ConfluencePagesResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    pages: list[ConfluencePage]
    space_id: Annotated[str, Field(alias="spaceId")]
    total: Annotated[ConfluencePagesResponseTotal, Field(title="ConfluencePagesResponseTotal")]


class ConfluenceQueryPageToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Atlassian/Confluence integration to use.",
        ),
    ]
    page_id: Annotated[str, Field(alias="pageId", description="The Confluence page ID to query.")]


class ConfluenceQueryPageInput(RootModel[ConfluenceQueryPageToolInput]):
    root: ConfluenceQueryPageToolInput


class ConfluenceQueryPageToolOutputAncestorsCount(RootModel[int]):
    root: Annotated[int, Field(title="ConfluenceQueryPageToolOutputAncestorsCount")]


class ConfluenceQueryPageToolOutputDescendantsCount(RootModel[int]):
    root: Annotated[int, Field(title="ConfluenceQueryPageToolOutputDescendantsCount")]


class ConfluenceQueryPageToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    page_id: str
    title: str
    type: str
    status: str
    space: ConfluencePageSpace | None = None
    version: ConfluencePageVersion | None = None
    created_date: str | None = None
    last_modified: str | None = None
    url: str | None = None
    body: ConfluenceBodyContent
    body_text: str
    ancestors: list[ConfluencePageRelation]
    descendants: list[ConfluencePageRelation]
    ancestors_count: Annotated[
        ConfluenceQueryPageToolOutputAncestorsCount,
        Field(title="ConfluenceQueryPageToolOutputAncestorsCount"),
    ]
    descendants_count: Annotated[
        ConfluenceQueryPageToolOutputDescendantsCount,
        Field(title="ConfluenceQueryPageToolOutputDescendantsCount"),
    ]


class ConfluenceResourcesResponseTotal(RootModel[int]):
    root: Annotated[int, Field(title="ConfluenceResourcesResponseTotal")]


class ConfluenceResourcesResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    resources: list[ConfluencePage]
    space_id: Annotated[str, Field(alias="spaceId")]
    total: Annotated[
        ConfluenceResourcesResponseTotal,
        Field(title="ConfluenceResourcesResponseTotal"),
    ]


class CountByStringCount(RootModel[int]):
    root: Annotated[int, Field(title="CountByStringCount")]


class CountByString(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    label: str
    count: Annotated[CountByStringCount, Field(title="CountByStringCount")]


class NotificationDestinationType(StrEnum):
    email = "email"
    slack = "slack"


class CreateNotificationDestinationRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
        regex_engine="python-re",
    )
    type: NotificationDestinationType
    email: Annotated[
        EmailStr | None,
        Field(
            pattern="^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"
        ),
    ] = None
    integration_id: Annotated[str | None, Field(alias="integrationId")] = None
    slack_channel_id: Annotated[str | None, Field(alias="slackChannelId")] = None
    slack_channel_name: Annotated[str | None, Field(alias="slackChannelName")] = None
    slack_user_id: Annotated[str | None, Field(alias="slackUserId")] = None
    slack_user_name: Annotated[str | None, Field(alias="slackUserName")] = None
    is_active: Annotated[bool | None, Field(alias="isActive")] = None


class DailyEventCountEvents(RootModel[int]):
    root: Annotated[int, Field(title="DailyEventCountEvents")]


class DailyEventCount(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    date: str
    events: Annotated[DailyEventCountEvents, Field(title="DailyEventCountEvents")]


class DatadogCursorPaginationLimit(RootModel[int]):
    root: Annotated[int, Field(title="DatadogCursorPaginationLimit")]


class DatadogCursorPaginationCursor(RootModel[str | None]):
    root: Annotated[str | None, Field(title="DatadogCursorPaginationCursor")]


class DatadogCursorPaginationNextCursor(RootModel[str | None]):
    root: Annotated[str | None, Field(title="DatadogCursorPaginationNextCursor")]


class DatadogCursorPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    limit: Annotated[DatadogCursorPaginationLimit, Field(title="DatadogCursorPaginationLimit")]
    cursor: Annotated[
        DatadogCursorPaginationCursor | None,
        Field(title="DatadogCursorPaginationCursor"),
    ] = None
    next_cursor: Annotated[
        DatadogCursorPaginationNextCursor | None,
        Field(alias="nextCursor", title="DatadogCursorPaginationNextCursor"),
    ]
    has_more: Annotated[bool, Field(alias="hasMore")]
    showing: str


class DatadogIndexDailyLimit(RootModel[int]):
    root: Annotated[int, Field(title="DatadogIndexDailyLimit")]


class DatadogIndexRetentionDays(RootModel[int]):
    root: Annotated[int, Field(title="DatadogIndexRetentionDays")]


class DatadogIndex(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    is_enabled: Annotated[bool, Field(alias="isEnabled")]
    daily_limit: Annotated[
        DatadogIndexDailyLimit | None,
        Field(alias="dailyLimit", title="DatadogIndexDailyLimit"),
    ] = None
    retention_days: Annotated[
        DatadogIndexRetentionDays | None,
        Field(alias="retentionDays", title="DatadogIndexRetentionDays"),
    ] = None


class DatadogIndexesResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    indexes: list[DatadogIndex]


class DatadogLogEntry(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    timestamp: str | None = None
    message: str | None = None
    host: str | None = None
    service: str | None = None
    status: str | None = None
    tags: list[str]
    custom_attributes: Annotated[dict[str, Any], Field(alias="customAttributes")]


class DatadogRumActionDetails(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str | None = None
    type: str | None = None
    target: str | None = None
    loading_time: Annotated[float | None, Field(alias="loadingTime")] = None


class DatadogRumErrorDetails(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str | None = None
    message: str | None = None
    source: str | None = None
    stack: str | None = None
    type: str | None = None


class DatadogRumLongTaskDetails(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str | None = None
    duration: float | None = None


class DatadogRumResourceDetailsStatusCode(RootModel[int]):
    root: Annotated[int, Field(title="DatadogRumResourceDetailsStatusCode")]


class DatadogRumResourceDetails(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str | None = None
    type: str | None = None
    url: str | None = None
    method: str | None = None
    status_code: Annotated[
        DatadogRumResourceDetailsStatusCode | None,
        Field(alias="statusCode", title="DatadogRumResourceDetailsStatusCode"),
    ] = None
    duration: float | None = None


class DatadogRumViewDetails(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str | None = None
    name: str | None = None
    url: str | None = None
    load_time: Annotated[float | None, Field(alias="loadTime")] = None
    time_spent: Annotated[float | None, Field(alias="timeSpent")] = None


class DatadogRumSessionDetails(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str | None = None
    type: str | None = None
    has_replay: Annotated[bool | None, Field(alias="hasReplay")] = None
    duration: float | None = None


class DatadogRumEventView(RootModel[DatadogRumViewDetails | dict[str, Any]]):
    root: Annotated[DatadogRumViewDetails | dict[str, Any], Field(title="DatadogRumEventView")]


class DatadogRumEvent(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    type: str
    timestamp: str | None = None
    session: DatadogRumSessionDetails | None = None
    view: Annotated[DatadogRumEventView | None, Field(title="DatadogRumEventView")] = None
    action: DatadogRumActionDetails | None = None
    error: DatadogRumErrorDetails | None = None
    resource: DatadogRumResourceDetails | None = None
    long_task: Annotated[DatadogRumLongTaskDetails | None, Field(alias="longTask")] = None
    service: str | None = None
    version: str | None = None
    environment: str | None = None
    device: dict[str, Any] | None = None
    os: dict[str, Any] | None = None
    browser: dict[str, Any] | None = None
    user: dict[str, Any] | None = None
    tags: list[str]
    custom_attributes: Annotated[dict[str, Any], Field(alias="customAttributes")]


class DeviceTokenExchangeRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    access_token: Annotated[str, Field(alias="accessToken")]


class DeviceTokenExchangeUserFirstName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="DeviceTokenExchangeUserFirstName")]


class DeviceTokenExchangeUserDisplayName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="DeviceTokenExchangeUserDisplayName")]


class DeviceTokenExchangeUser(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    email: str
    first_name: Annotated[
        DeviceTokenExchangeUserFirstName | None,
        Field(alias="firstName", title="DeviceTokenExchangeUserFirstName"),
    ]
    display_name: Annotated[
        DeviceTokenExchangeUserDisplayName | None,
        Field(alias="displayName", title="DeviceTokenExchangeUserDisplayName"),
    ]


class DeviceTokenExchangeResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    api_key: Annotated[str, Field(alias="apiKey")]
    user: DeviceTokenExchangeUser


class DismissImprovementResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool


class Done(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["done"] = "done"


class Error(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["error"] = "error"
    message: str


class FigmaWebhookUser(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    handle: str
    email: str
    img_url: str


class FigmaVectorData(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    x: float
    y: float


class FigmaClientMeta(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    x: float
    y: float
    width: float
    height: float
    node_id: str
    node_offset: FigmaVectorData


class FigmaApiCommentClientMeta(RootModel[FigmaClientMeta | None]):
    root: Annotated[FigmaClientMeta | None, Field(title="FigmaApiCommentClientMeta")]


class FigmaApiCommentResolvedAt(RootModel[str | None]):
    root: Annotated[str | None, Field(title="FigmaApiCommentResolvedAt")]


class FigmaApiCommentParentId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="FigmaApiCommentParentId")]


class FigmaApiComment(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    message: str
    client_meta: Annotated[FigmaApiCommentClientMeta | None, Field(title="FigmaApiCommentClientMeta")]
    user: FigmaWebhookUser
    created_at: str
    resolved_at: Annotated[FigmaApiCommentResolvedAt | None, Field(title="FigmaApiCommentResolvedAt")]
    parent_id: Annotated[FigmaApiCommentParentId | None, Field(title="FigmaApiCommentParentId")] = None
    order_id: str | None = None
    mentions: list[Any] | None = None
    reactions: list[Any] | None = None


class FigmaCommentImageUrls(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    node_image: Annotated[str | None, Field(alias="nodeImage")] = None
    full_frame: Annotated[str | None, Field(alias="fullFrame")] = None


class FigmaFrameOffsetRegionData(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    node_id: str
    node_offset: FigmaVectorData
    x: float
    y: float
    width: float
    height: float


class FigmaFrameOffsetRegionPositioning(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["FrameOffsetRegion"] = "FrameOffsetRegion"
    data: FigmaFrameOffsetRegionData


class FigmaRegionData(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    x: float
    y: float
    width: float
    height: float


class FigmaRegionPositioning(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["Region"] = "Region"
    data: FigmaRegionData


class FigmaFrameOffsetData(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    node_id: str
    node_offset: FigmaVectorData


class FigmaFrameOffsetPositioning(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["FrameOffset"] = "FrameOffset"
    data: FigmaFrameOffsetData


class FigmaVectorPositioning(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["Vector"] = "Vector"
    data: FigmaVectorData


class FigmaPositioningData(
    RootModel[
        FigmaVectorPositioning
        | FigmaFrameOffsetPositioning
        | FigmaRegionPositioning
        | FigmaFrameOffsetRegionPositioning
    ]
):
    root: (
        FigmaVectorPositioning
        | FigmaFrameOffsetPositioning
        | FigmaRegionPositioning
        | FigmaFrameOffsetRegionPositioning
    )


class FigmaFileMetadata(TerseModel):
    name: str | None = None
    folder_name: str | None = None
    url: str | None = None


class FigmaCommentThreadEntryResolvedAt(RootModel[str | None]):
    root: Annotated[str | None, Field(title="FigmaCommentThreadEntryResolvedAt")]


class FigmaCommentThreadEntryParentId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="FigmaCommentThreadEntryParentId")]


class FigmaCommentThreadEntry(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    message: str
    author: FigmaWebhookUser
    created_at: Annotated[str, Field(alias="createdAt")]
    resolved_at: Annotated[
        FigmaCommentThreadEntryResolvedAt | None,
        Field(alias="resolvedAt", title="FigmaCommentThreadEntryResolvedAt"),
    ]
    parent_id: Annotated[
        FigmaCommentThreadEntryParentId | None,
        Field(alias="parentId", title="FigmaCommentThreadEntryParentId"),
    ]
    order_id: Annotated[str | None, Field(alias="orderId")] = None
    is_root: Annotated[bool | None, Field(alias="isRoot")] = None


class FigmaCommentEventData(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    comment_id: Annotated[str, Field(alias="commentId")]
    file_key: Annotated[str, Field(alias="fileKey")]
    file_url: Annotated[str, Field(alias="fileUrl")]
    node_id: Annotated[str | None, Field(alias="nodeId")] = None
    message: str
    author: FigmaWebhookUser
    created_at: Annotated[str, Field(alias="createdAt")]
    resolved: bool | None = None
    thread: list[FigmaCommentThreadEntry] | None = None
    file_metadata: Annotated[FigmaFileMetadata | None, Field(alias="fileMetadata")] = None
    positioning_data: Annotated[FigmaPositioningData | None, Field(alias="positioningData")] = None
    matched_node_ids: Annotated[list[str] | None, Field(alias="matchedNodeIds")] = None
    image_urls: Annotated[FigmaCommentImageUrls | None, Field(alias="imageUrls")] = None


class FigmaEventTypes(StrEnum):
    file_comment = "FILE_COMMENT"


class FigmaWebhookCommentResolvedAt(RootModel[str | None]):
    root: Annotated[str | None, Field(title="FigmaWebhookCommentResolvedAt")]


class FigmaWebhookComment(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    message: str
    client_meta: FigmaClientMeta
    user: FigmaWebhookUser
    created_at: str
    resolved_at: Annotated[
        FigmaWebhookCommentResolvedAt | None,
        Field(title="FigmaWebhookCommentResolvedAt"),
    ]


class FilterResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    is_relevant: Annotated[bool, Field(alias="isRelevant")]
    reason: str
    confidence: float
    step_id: str
    type: Literal["FilterResult"] = "FilterResult"
    timestamp: float


class FinalOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["final_output"] = "final_output"
    final_output: Annotated[str, Field(alias="finalOutput")]


class FormFieldType(StrEnum):
    text = "text"
    password = "password"
    textarea = "textarea"


class FormFieldDefinition(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    type: FormFieldType
    label: str
    placeholder: str | None = None
    required: bool | None = None
    hint: str | None = None


class FunctionCall(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    function_name: str
    result: str
    step_id: str


class GetAgentImprovementsResponseReview(RootModel[AgentReview | None]):
    root: Annotated[AgentReview | None, Field(title="GetAgentImprovementsResponseReview")]


class GetAgentImprovementsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    review: Annotated[
        GetAgentImprovementsResponseReview | None,
        Field(title="GetAgentImprovementsResponseReview"),
    ]
    improvements: list[AgentImprovement]
    improvements_enabled: Annotated[bool, Field(alias="improvementsEnabled")]


class GetGithubRepositoriesForIntegrationRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )


class RepositoryId(RootModel[int]):
    root: Annotated[int, Field(title="RepositoryId")]


class Repository(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    owner: str
    id: Annotated[RepositoryId, Field(title="RepositoryId")]


class GetGithubRepositoriesForIntegrationResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    repositories: list[Repository]


class GetLaunchDarklyFlagDetailsToolInputEnvironmentKey(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional: Specific environment to get details for (if not provided, returns all configured environments).",
            title="GetLaunchDarklyFlagDetailsToolInputEnvironmentKey",
        ),
    ]


class GetLaunchDarklyFlagDetailsToolInputIncludeHistory(RootModel[bool]):
    root: Annotated[
        bool,
        Field(
            description="If true, includes change history for the flag over the specified time window.",
            title="GetLaunchDarklyFlagDetailsToolInputIncludeHistory",
        ),
    ] = False


class GetLaunchDarklyFlagDetailsToolInputBefore(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional: ISO date - only return history entries before this date (only used if includeHistory is true).",
            title="GetLaunchDarklyFlagDetailsToolInputBefore",
        ),
    ]


class GetLaunchDarklyFlagDetailsToolInputAfter(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional: ISO date - only return history entries after this date (only used if includeHistory is true).",
            title="GetLaunchDarklyFlagDetailsToolInputAfter",
        ),
    ]


class GetLaunchDarklyFlagDetailsToolInputHistoryLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Number of history entries to return if includeHistory is true (default: 20, max: 20).",
            title="GetLaunchDarklyFlagDetailsToolInputHistoryLimit",
        ),
    ] = 20


class GetLaunchDarklyFlagDetailsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the LaunchDarkly skill to use.",
        ),
    ]
    project_key: Annotated[str, Field(alias="projectKey", description="The LaunchDarkly project key.")]
    environment_keys: Annotated[
        list[str],
        Field(alias="environmentKeys", description="Array of environment keys to query."),
    ]
    flag_key: Annotated[str, Field(alias="flagKey", description="The flag key to retrieve.")]
    environment_key: Annotated[
        GetLaunchDarklyFlagDetailsToolInputEnvironmentKey | None,
        Field(
            alias="environmentKey",
            description="Optional: Specific environment to get details for (if not provided, returns all configured environments).",
            title="GetLaunchDarklyFlagDetailsToolInputEnvironmentKey",
        ),
    ] = None
    include_history: Annotated[
        GetLaunchDarklyFlagDetailsToolInputIncludeHistory,
        Field(
            alias="includeHistory",
            description="If true, includes change history for the flag over the specified time window.",
            title="GetLaunchDarklyFlagDetailsToolInputIncludeHistory",
            validate_default=True,
        ),
    ]
    before: Annotated[
        GetLaunchDarklyFlagDetailsToolInputBefore | None,
        Field(
            description="Optional: ISO date - only return history entries before this date (only used if includeHistory is true).",
            title="GetLaunchDarklyFlagDetailsToolInputBefore",
        ),
    ] = None
    after: Annotated[
        GetLaunchDarklyFlagDetailsToolInputAfter | None,
        Field(
            description="Optional: ISO date - only return history entries after this date (only used if includeHistory is true).",
            title="GetLaunchDarklyFlagDetailsToolInputAfter",
        ),
    ] = None
    history_limit: Annotated[
        GetLaunchDarklyFlagDetailsToolInputHistoryLimit,
        Field(
            alias="historyLimit",
            description="Number of history entries to return if includeHistory is true (default: 20, max: 20).",
            title="GetLaunchDarklyFlagDetailsToolInputHistoryLimit",
            validate_default=True,
        ),
    ]


class GetLaunchDarklyFlagDetailsInput(RootModel[GetLaunchDarklyFlagDetailsToolInput]):
    root: GetLaunchDarklyFlagDetailsToolInput


class LaunchDarklyHistoryEntryMember(RootModel[dict[str, Any] | None]):
    root: Annotated[dict[str, Any] | None, Field(title="LaunchDarklyHistoryEntryMember")]


class LaunchDarklyHistoryEntry(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    timestamp: str
    kind: str
    key: str
    name: str
    description: str
    member: Annotated[
        LaunchDarklyHistoryEntryMember | None,
        Field(title="LaunchDarklyHistoryEntryMember"),
    ]
    changes: list[dict[str, Any]]


class LaunchDarklyHistoryResultTotalEntries(RootModel[int]):
    root: Annotated[int, Field(title="LaunchDarklyHistoryResultTotalEntries")]


class LaunchDarklyHistoryResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    entries: list[LaunchDarklyHistoryEntry]
    total_entries: Annotated[
        LaunchDarklyHistoryResultTotalEntries,
        Field(alias="totalEntries", title="LaunchDarklyHistoryResultTotalEntries"),
    ]
    url: str


class LaunchDarklyEnvironmentConfigInstanceFallthrough(RootModel[dict[str, Any] | None]):
    root: Annotated[
        dict[str, Any] | None,
        Field(title="LaunchDarklyEnvironmentConfigInstanceFallthrough"),
    ]


class LaunchDarklyEnvironmentConfigInstanceOffVariation(RootModel[int | None]):
    root: Annotated[int | None, Field(title="LaunchDarklyEnvironmentConfigInstanceOffVariation")]


class LaunchDarklyEnvironmentConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    on: bool
    targets: list[dict[str, Any]]
    context_targets: Annotated[list[dict[str, Any]], Field(alias="contextTargets")]
    rules: list[dict[str, Any]]
    fallthrough: Annotated[
        LaunchDarklyEnvironmentConfigInstanceFallthrough | None,
        Field(title="LaunchDarklyEnvironmentConfigInstanceFallthrough"),
    ]
    off_variation: Annotated[
        LaunchDarklyEnvironmentConfigInstanceOffVariation | None,
        Field(
            alias="offVariation",
            title="LaunchDarklyEnvironmentConfigInstanceOffVariation",
        ),
    ]
    prerequisites: list[dict[str, Any]]


class LaunchDarklyFlagMetadataMaintainerId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LaunchDarklyFlagMetadataMaintainerId")]


class LaunchDarklyFlagMetadata(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    key: str
    name: str
    description: str
    kind: str
    variations: list[dict[str, Any]]
    tags: list[str]
    maintainer_id: Annotated[
        LaunchDarklyFlagMetadataMaintainerId | None,
        Field(alias="maintainerId", title="LaunchDarklyFlagMetadataMaintainerId"),
    ]


class GetLaunchDarklyFlagDetailsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    project_key: Annotated[str, Field(alias="projectKey")]
    flag: LaunchDarklyFlagMetadata
    environments: dict[str, LaunchDarklyEnvironmentConfigInstance]
    url: str
    history: LaunchDarklyHistoryResult | None = None
    message: str


class GetPosthogSessionEventsToolInputStartSeconds(RootModel[float | None]):
    root: Annotated[
        float | None,
        Field(
            description="Optional: Start time in seconds from the beginning of the session. If not provided, starts from the beginning.",
            title="GetPosthogSessionEventsToolInputStartSeconds",
        ),
    ]


class GetPosthogSessionEventsToolInputEndSeconds(RootModel[float | None]):
    root: Annotated[
        float | None,
        Field(
            description="Optional: End time in seconds from the beginning of the session. If not provided, goes until the end.",
            title="GetPosthogSessionEventsToolInputEndSeconds",
        ),
    ]


class GetPosthogSessionEventsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the PostHog skill to use.",
        ),
    ]
    project_id: Annotated[str, Field(alias="projectId", description="The PostHog project ID.")]
    session_id: Annotated[
        UUID,
        Field(
            alias="sessionId",
            description="The PostHog session ID (UUID format) to fetch events for. You can get this from searchPosthogSessions.",
            pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$",
        ),
    ]
    start_seconds: Annotated[
        GetPosthogSessionEventsToolInputStartSeconds | None,
        Field(
            alias="startSeconds",
            description="Optional: Start time in seconds from the beginning of the session. If not provided, starts from the beginning.",
            title="GetPosthogSessionEventsToolInputStartSeconds",
        ),
    ] = None
    end_seconds: Annotated[
        GetPosthogSessionEventsToolInputEndSeconds | None,
        Field(
            alias="endSeconds",
            description="Optional: End time in seconds from the beginning of the session. If not provided, goes until the end.",
            title="GetPosthogSessionEventsToolInputEndSeconds",
        ),
    ] = None


class GetPosthogSessionEventsInput(RootModel[GetPosthogSessionEventsToolInput]):
    root: GetPosthogSessionEventsToolInput


class PosthogSessionConsoleLog(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    timestamp: str
    level: str
    message: str


class PosthogSessionEventType(StrEnum):
    click = "click"
    input = "input"
    scroll = "scroll"
    console = "console"
    network_error = "network_error"
    navigation = "navigation"
    custom = "custom"
    page_load = "page_load"
    viewport_resize = "viewport_resize"


class PosthogSessionEvent(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: PosthogSessionEventType
    timestamp: float
    relative_time: Annotated[float, Field(alias="relativeTime")]
    data: dict[str, Any]


class PosthogSessionEventsSummaryTotalRawEvents(RootModel[int]):
    root: Annotated[int, Field(title="PosthogSessionEventsSummaryTotalRawEvents")]


class PosthogSessionEventsSummaryMeaningfulEventsReturned(RootModel[int]):
    root: Annotated[int, Field(title="PosthogSessionEventsSummaryMeaningfulEventsReturned")]


class PosthogSessionEventsSummaryConsoleLogsReturned(RootModel[int]):
    root: Annotated[int, Field(title="PosthogSessionEventsSummaryConsoleLogsReturned")]


class PosthogSessionEventsSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    total_raw_events: Annotated[
        PosthogSessionEventsSummaryTotalRawEvents,
        Field(alias="totalRawEvents", title="PosthogSessionEventsSummaryTotalRawEvents"),
    ]
    meaningful_events_returned: Annotated[
        PosthogSessionEventsSummaryMeaningfulEventsReturned,
        Field(
            alias="meaningfulEventsReturned",
            title="PosthogSessionEventsSummaryMeaningfulEventsReturned",
        ),
    ]
    console_logs_returned: Annotated[
        PosthogSessionEventsSummaryConsoleLogsReturned,
        Field(
            alias="consoleLogsReturned",
            title="PosthogSessionEventsSummaryConsoleLogsReturned",
        ),
    ]


class PosthogSessionEventsTimeWindowEndSeconds(RootModel[float | None]):
    root: Annotated[float | None, Field(title="PosthogSessionEventsTimeWindowEndSeconds")]


class PosthogSessionEventsTimeWindow(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    start_seconds: Annotated[float, Field(alias="startSeconds")]
    end_seconds: Annotated[
        PosthogSessionEventsTimeWindowEndSeconds | None,
        Field(alias="endSeconds", title="PosthogSessionEventsTimeWindowEndSeconds"),
    ]


class GetPosthogSessionEventsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    session_id: Annotated[str, Field(alias="sessionId")]
    session_url: Annotated[str, Field(alias="sessionUrl")]
    start_time: Annotated[str, Field(alias="startTime")]
    duration: float | None = None
    time_window: Annotated[PosthogSessionEventsTimeWindow, Field(alias="timeWindow")]
    summary: PosthogSessionEventsSummary
    events: list[PosthogSessionEvent]
    console_logs: Annotated[list[PosthogSessionConsoleLog], Field(alias="consoleLogs")]
    message: str


class GetToolsThatRequireApprovalsRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    skills: list[ConfigTypeEnum]


class GetWorkOSUserToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the WorkOS skill to use.",
        ),
    ]
    user_id: Annotated[str, Field(alias="userId", description="The WorkOS user ID to look up.")]


class GetWorkOSUserInput(RootModel[GetWorkOSUserToolInput]):
    root: GetWorkOSUserToolInput


class WorkOSUserSummaryFirstName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="WorkOSUserSummaryFirstName")]


class WorkOSUserSummaryLastName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="WorkOSUserSummaryLastName")]


class WorkOSUserSummaryProfilePictureUrl(RootModel[str | None]):
    root: Annotated[str | None, Field(title="WorkOSUserSummaryProfilePictureUrl")]


class WorkOSUserSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    email: str
    email_verified: Annotated[bool, Field(alias="emailVerified")]
    first_name: Annotated[
        WorkOSUserSummaryFirstName | None,
        Field(alias="firstName", title="WorkOSUserSummaryFirstName"),
    ] = None
    last_name: Annotated[
        WorkOSUserSummaryLastName | None,
        Field(alias="lastName", title="WorkOSUserSummaryLastName"),
    ] = None
    profile_picture_url: Annotated[
        WorkOSUserSummaryProfilePictureUrl | None,
        Field(alias="profilePictureUrl", title="WorkOSUserSummaryProfilePictureUrl"),
    ] = None
    created_at: Annotated[str, Field(alias="createdAt")]
    updated_at: Annotated[str, Field(alias="updatedAt")]


class GetWorkOSUserToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    user: WorkOSUserSummary
    message: str


class GitHubCodeGrepResultIndex(RootModel[int]):
    root: Annotated[int, Field(title="GitHubCodeGrepResultIndex")]


class GitHubCodeGrepResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    index: Annotated[GitHubCodeGrepResultIndex, Field(title="GitHubCodeGrepResultIndex")]
    repository: str
    file: str
    url: str
    matches: str


class GitHubCodeSearchResultIndex(RootModel[int]):
    root: Annotated[int, Field(title="GitHubCodeSearchResultIndex")]


class GitHubCodeSearchResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    index: Annotated[GitHubCodeSearchResultIndex, Field(title="GitHubCodeSearchResultIndex")]
    repository: str
    path: str
    url: str
    snippets: str


class GitHubCommitListSummaryTotal(RootModel[int]):
    root: Annotated[int, Field(title="GitHubCommitListSummaryTotal")]


class GitHubCommitListSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    total: Annotated[GitHubCommitListSummaryTotal, Field(title="GitHubCommitListSummaryTotal")]
    by_author: Annotated[dict[str, int], Field(alias="byAuthor")]


class GitHubCommitSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    sha: str
    full_sha: Annotated[str, Field(alias="fullSha")]
    message: str
    full_message: Annotated[str, Field(alias="fullMessage")]
    author: str
    date: str
    url: str


class GitHubDirectoryEntry(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str | None = None
    path: str | None = None
    type: Literal["directory"] = "directory"


class GitHubFileEntrySize(RootModel[int]):
    root: Annotated[int, Field(title="GitHubFileEntrySize")]


class GitHubFileEntry(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str | None = None
    path: str
    type: Literal["file"] = "file"
    size: Annotated[GitHubFileEntrySize | None, Field(title="GitHubFileEntrySize")] = None


class GitHubOtherEntry(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    type: str


class GitHubPaginationPage(RootModel[int]):
    root: Annotated[int, Field(title="GitHubPaginationPage")]


class GitHubPaginationPerPage(RootModel[int]):
    root: Annotated[int, Field(title="GitHubPaginationPerPage")]


class GitHubPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    page: Annotated[GitHubPaginationPage, Field(title="GitHubPaginationPage")]
    per_page: Annotated[GitHubPaginationPerPage, Field(alias="perPage", title="GitHubPaginationPerPage")]
    has_more: Annotated[bool, Field(alias="hasMore")]


class GitHubPullRequestListSummaryTotal(RootModel[int]):
    root: Annotated[int, Field(title="GitHubPullRequestListSummaryTotal")]


class GitHubPullRequestListSummaryMerged(RootModel[int]):
    root: Annotated[int, Field(title="GitHubPullRequestListSummaryMerged")]


class GitHubPullRequestListSummaryOpen(RootModel[int]):
    root: Annotated[int, Field(title="GitHubPullRequestListSummaryOpen")]


class GitHubPullRequestListSummaryClosed(RootModel[int]):
    root: Annotated[int, Field(title="GitHubPullRequestListSummaryClosed")]


class GitHubPullRequestListSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    total: Annotated[
        GitHubPullRequestListSummaryTotal,
        Field(title="GitHubPullRequestListSummaryTotal"),
    ]
    merged: Annotated[
        GitHubPullRequestListSummaryMerged,
        Field(title="GitHubPullRequestListSummaryMerged"),
    ]
    open: Annotated[
        GitHubPullRequestListSummaryOpen,
        Field(title="GitHubPullRequestListSummaryOpen"),
    ]
    closed: Annotated[
        GitHubPullRequestListSummaryClosed,
        Field(title="GitHubPullRequestListSummaryClosed"),
    ]


class GitHubPullRequestRefNumber(RootModel[int]):
    root: Annotated[int, Field(title="GitHubPullRequestRefNumber")]


class GitHubPullRequestRef(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    number: Annotated[GitHubPullRequestRefNumber, Field(title="GitHubPullRequestRefNumber")]
    title: str
    state: str
    merged: bool
    base_branch: Annotated[str, Field(alias="baseBranch")]
    head_branch: Annotated[str, Field(alias="headBranch")]
    url: str


class GitHubPullRequestSummaryNumber(RootModel[int]):
    root: Annotated[int, Field(title="GitHubPullRequestSummaryNumber")]


class GitHubPullRequestSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    number: Annotated[GitHubPullRequestSummaryNumber, Field(title="GitHubPullRequestSummaryNumber")]
    title: str
    description: str
    author: str
    state: str
    merged: bool
    merged_at: Annotated[str | None, Field(alias="mergedAt")] = None
    created_at: Annotated[str, Field(alias="createdAt")]
    closed_at: Annotated[str | None, Field(alias="closedAt")] = None
    labels: list[str]
    base_branch: Annotated[str, Field(alias="baseBranch")]
    head_branch: Annotated[str, Field(alias="headBranch")]
    url: str


class GithubAppInstallationCallbackRequestInstallationId(RootModel[int]):
    root: Annotated[int, Field(title="GithubAppInstallationCallbackRequestInstallationId")]


class GithubAppInstallationCallbackRequestAccountName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="GithubAppInstallationCallbackRequestAccountName")]


class GithubAppInstallationCallbackRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    email: str
    username: str
    installation_id: Annotated[
        GithubAppInstallationCallbackRequestInstallationId,
        Field(
            alias="installationId",
            title="GithubAppInstallationCallbackRequestInstallationId",
        ),
    ]
    account_name: Annotated[
        GithubAppInstallationCallbackRequestAccountName | None,
        Field(alias="accountName", title="GithubAppInstallationCallbackRequestAccountName"),
    ]
    repositories: list[Repository]


class GmailHeader(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    key: str
    value: str


class GmailCreateDraftToolInputBody(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Plain text email body content. Do not include image URLs here — images cannot be embedded in plain text.",
            title="GmailCreateDraftToolInputBody",
        ),
    ]


class GmailCreateDraftToolInputHtmlBody(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='HTML email body content. If provided with body, sends multipart/alternative. NEVER use <img src="https://..."> with remote URLs — they will expire. Images must be passed via image_urls and referenced as <img src="cid:image-1.png">.',
            title="GmailCreateDraftToolInputHtmlBody",
        ),
    ]


class GmailCreateDraftToolInputThreadId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Gmail Thread ID (numeric string from the email event, NOT the Message-ID header). Omit for new drafts.",
            title="GmailCreateDraftToolInputThreadId",
        ),
    ]


class GmailCreateDraftToolInputCc(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="CC recipient email address(es). Multiple addresses can be comma-separated.",
            title="GmailCreateDraftToolInputCc",
        ),
    ]


class GmailCreateDraftToolInputBcc(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="BCC recipient email address(es). Multiple addresses can be comma-separated.",
            title="GmailCreateDraftToolInputBcc",
        ),
    ]


class GmailCreateDraftToolInputImageUrls(RootModel[list[str] | None]):
    root: Annotated[
        list[str] | None,
        Field(
            description='URLs of images to embed in the email. Must be signed URLs from our internal GCS image bucket. Each image is downloaded and base64-encoded as an inline MIME attachment with a Content-ID. Images are assigned sequential filenames: image-1.png, image-2.png, etc. (extension reflects actual MIME type). You MUST reference each one in html_body as <img src="cid:image-1.png">, <img src="cid:image-2.png">, etc. Do NOT put the raw URLs in html_body.',
            title="GmailCreateDraftToolInputImageUrls",
        ),
    ]


class GmailCreateDraftToolInputCustomHeaders(RootModel[list[GmailHeader] | None]):
    root: Annotated[
        list[GmailHeader] | None,
        Field(
            description='Custom email headers as key-value pairs. Useful for adding headers like List-Unsubscribe, List-Unsubscribe-Post, X-Priority, etc. Example: {"List-Unsubscribe": "<mailto:unsubscribe@example.com>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}',
            title="GmailCreateDraftToolInputCustomHeaders",
        ),
    ]


class GmailCreateDraftToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Gmail account to use.",
        ),
    ]
    to: Annotated[
        str,
        Field(description="Recipient email address(es). Multiple addresses can be comma-separated."),
    ]
    subject: Annotated[str, Field(description="Email subject line")]
    body: Annotated[
        GmailCreateDraftToolInputBody | None,
        Field(
            description="Plain text email body content. Do not include image URLs here — images cannot be embedded in plain text.",
            title="GmailCreateDraftToolInputBody",
        ),
    ] = None
    html_body: Annotated[
        GmailCreateDraftToolInputHtmlBody | None,
        Field(
            description='HTML email body content. If provided with body, sends multipart/alternative. NEVER use <img src="https://..."> with remote URLs — they will expire. Images must be passed via image_urls and referenced as <img src="cid:image-1.png">.',
            title="GmailCreateDraftToolInputHtmlBody",
        ),
    ] = None
    thread_id: Annotated[
        GmailCreateDraftToolInputThreadId | None,
        Field(
            description="Gmail Thread ID (numeric string from the email event, NOT the Message-ID header). Omit for new drafts.",
            title="GmailCreateDraftToolInputThreadId",
        ),
    ] = None
    cc: Annotated[
        GmailCreateDraftToolInputCc | None,
        Field(
            description="CC recipient email address(es). Multiple addresses can be comma-separated.",
            title="GmailCreateDraftToolInputCc",
        ),
    ] = None
    bcc: Annotated[
        GmailCreateDraftToolInputBcc | None,
        Field(
            description="BCC recipient email address(es). Multiple addresses can be comma-separated.",
            title="GmailCreateDraftToolInputBcc",
        ),
    ] = None
    image_urls: Annotated[
        GmailCreateDraftToolInputImageUrls | None,
        Field(
            description='URLs of images to embed in the email. Must be signed URLs from our internal GCS image bucket. Each image is downloaded and base64-encoded as an inline MIME attachment with a Content-ID. Images are assigned sequential filenames: image-1.png, image-2.png, etc. (extension reflects actual MIME type). You MUST reference each one in html_body as <img src="cid:image-1.png">, <img src="cid:image-2.png">, etc. Do NOT put the raw URLs in html_body.',
            title="GmailCreateDraftToolInputImageUrls",
        ),
    ] = None
    custom_headers: Annotated[
        GmailCreateDraftToolInputCustomHeaders | None,
        Field(
            description='Custom email headers as key-value pairs. Useful for adding headers like List-Unsubscribe, List-Unsubscribe-Post, X-Priority, etc. Example: {"List-Unsubscribe": "<mailto:unsubscribe@example.com>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}',
            title="GmailCreateDraftToolInputCustomHeaders",
        ),
    ] = None


class GmailCreateDraftInput(RootModel[GmailCreateDraftToolInput]):
    root: GmailCreateDraftToolInput


class GmailCreateDraftToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    draft_id: str
    message_id: str
    thread_id: str
    draft_url: str
    to: str
    subject: str
    summary: str
    is_reply: bool


class GmailDraftSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    draft_id: str
    message_id: str
    thread_id: str
    draft_url: str
    to: str
    subject: str
    summary: str
    is_reply: bool


class GmailSendEmailToolInputBody(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Plain text email body content. Do not include image URLs here — images cannot be embedded in plain text.",
            title="GmailSendEmailToolInputBody",
        ),
    ]


class GmailSendEmailToolInputHtmlBody(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='HTML email body content. If provided with body, sends multipart/alternative. NEVER use <img src="https://..."> with remote URLs — they will expire. Images must be passed via image_urls and referenced as <img src="cid:image-1.png">.',
            title="GmailSendEmailToolInputHtmlBody",
        ),
    ]


class GmailSendEmailToolInputThreadId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Gmail Thread ID (numeric string from the email event, NOT the Message-ID header). Omit for new emails.",
            title="GmailSendEmailToolInputThreadId",
        ),
    ]


class GmailSendEmailToolInputCc(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="CC recipient email address(es). Multiple addresses can be comma-separated.",
            title="GmailSendEmailToolInputCc",
        ),
    ]


class GmailSendEmailToolInputBcc(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="BCC recipient email address(es). Multiple addresses can be comma-separated.",
            title="GmailSendEmailToolInputBcc",
        ),
    ]


class GmailSendEmailToolInputImageUrls(RootModel[list[str] | None]):
    root: Annotated[
        list[str] | None,
        Field(
            description='URLs of images to embed in the email. Must be signed URLs from our internal GCS image bucket. Each image is downloaded and base64-encoded as an inline MIME attachment with a Content-ID. Images are assigned sequential filenames: image-1.png, image-2.png, etc. (extension reflects actual MIME type). You MUST reference each one in html_body as <img src="cid:image-1.png">, <img src="cid:image-2.png">, etc. Do NOT put the raw URLs in html_body.',
            title="GmailSendEmailToolInputImageUrls",
        ),
    ]


class GmailSendEmailToolInputCustomHeaders(RootModel[list[GmailHeader] | None]):
    root: Annotated[
        list[GmailHeader] | None,
        Field(
            description='Custom email headers as key-value pairs. Useful for adding headers like List-Unsubscribe, List-Unsubscribe-Post, X-Priority, etc. Example: {"List-Unsubscribe": "<mailto:unsubscribe@example.com>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}',
            title="GmailSendEmailToolInputCustomHeaders",
        ),
    ]


class GmailSendEmailToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Gmail account to use.",
        ),
    ]
    to: Annotated[
        str,
        Field(description="Recipient email address(es). Multiple addresses can be comma-separated."),
    ]
    subject: Annotated[str, Field(description="Email subject line")]
    body: Annotated[
        GmailSendEmailToolInputBody | None,
        Field(
            description="Plain text email body content. Do not include image URLs here — images cannot be embedded in plain text.",
            title="GmailSendEmailToolInputBody",
        ),
    ] = None
    html_body: Annotated[
        GmailSendEmailToolInputHtmlBody | None,
        Field(
            description='HTML email body content. If provided with body, sends multipart/alternative. NEVER use <img src="https://..."> with remote URLs — they will expire. Images must be passed via image_urls and referenced as <img src="cid:image-1.png">.',
            title="GmailSendEmailToolInputHtmlBody",
        ),
    ] = None
    thread_id: Annotated[
        GmailSendEmailToolInputThreadId | None,
        Field(
            description="Gmail Thread ID (numeric string from the email event, NOT the Message-ID header). Omit for new emails.",
            title="GmailSendEmailToolInputThreadId",
        ),
    ] = None
    cc: Annotated[
        GmailSendEmailToolInputCc | None,
        Field(
            description="CC recipient email address(es). Multiple addresses can be comma-separated.",
            title="GmailSendEmailToolInputCc",
        ),
    ] = None
    bcc: Annotated[
        GmailSendEmailToolInputBcc | None,
        Field(
            description="BCC recipient email address(es). Multiple addresses can be comma-separated.",
            title="GmailSendEmailToolInputBcc",
        ),
    ] = None
    image_urls: Annotated[
        GmailSendEmailToolInputImageUrls | None,
        Field(
            description='URLs of images to embed in the email. Must be signed URLs from our internal GCS image bucket. Each image is downloaded and base64-encoded as an inline MIME attachment with a Content-ID. Images are assigned sequential filenames: image-1.png, image-2.png, etc. (extension reflects actual MIME type). You MUST reference each one in html_body as <img src="cid:image-1.png">, <img src="cid:image-2.png">, etc. Do NOT put the raw URLs in html_body.',
            title="GmailSendEmailToolInputImageUrls",
        ),
    ] = None
    custom_headers: Annotated[
        GmailSendEmailToolInputCustomHeaders | None,
        Field(
            description='Custom email headers as key-value pairs. Useful for adding headers like List-Unsubscribe, List-Unsubscribe-Post, X-Priority, etc. Example: {"List-Unsubscribe": "<mailto:unsubscribe@example.com>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}',
            title="GmailSendEmailToolInputCustomHeaders",
        ),
    ] = None


class GmailSendEmailInput(RootModel[GmailSendEmailToolInput]):
    root: GmailSendEmailToolInput


class GmailSendEmailToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    message_id: str
    thread_id: str
    to: str
    subject: str
    summary: str
    is_reply: bool


class GmailSendSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    message_id: str
    thread_id: str
    to: str
    subject: str
    summary: str
    is_reply: bool


class GrepGitHubCodeToolInputFileExtension(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Filter by file extension (e.g., "ts", "js", "py"). Do not include the dot. Use null to search all file types.',
            title="GrepGitHubCodeToolInputFileExtension",
        ),
    ]


class GrepGitHubCodeToolInputPath(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Filter by directory path (e.g., "src/services" to only search in that directory). Use null to search everywhere.',
            title="GrepGitHubCodeToolInputPath",
        ),
    ]


class GrepGitHubCodeToolInputPerPage(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Number of results to return (default: 20, max: 100)",
            title="GrepGitHubCodeToolInputPerPage",
        ),
    ]


class GrepGitHubCodeToolInputPage1(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            ge=1,
            title="GrepGitHubCodeToolInputPage",
        ),
    ]


class GrepGitHubCodeToolInputPage(RootModel[GrepGitHubCodeToolInputPage1 | None]):
    root: Annotated[
        GrepGitHubCodeToolInputPage1 | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            title="GrepGitHubCodeToolInputPage",
        ),
    ]


class GrepGitHubCodeToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    repository_names: Annotated[
        list[str],
        Field(
            alias="repositoryNames",
            description="Array of repository full names (owner/repo format) to search in.",
        ),
    ]
    pattern: Annotated[
        str,
        Field(
            description='The exact text pattern to search for. For function calls, include the opening parenthesis (e.g., "fetchUser("). For strings, include quotes if needed.'
        ),
    ]
    file_extension: Annotated[
        GrepGitHubCodeToolInputFileExtension | None,
        Field(
            alias="fileExtension",
            description='Filter by file extension (e.g., "ts", "js", "py"). Do not include the dot. Use null to search all file types.',
            title="GrepGitHubCodeToolInputFileExtension",
        ),
    ] = None
    path: Annotated[
        GrepGitHubCodeToolInputPath | None,
        Field(
            description='Filter by directory path (e.g., "src/services" to only search in that directory). Use null to search everywhere.',
            title="GrepGitHubCodeToolInputPath",
        ),
    ] = None
    per_page: Annotated[
        GrepGitHubCodeToolInputPerPage,
        Field(
            alias="perPage",
            description="Number of results to return (default: 20, max: 100)",
            title="GrepGitHubCodeToolInputPerPage",
        ),
    ]
    page: Annotated[
        GrepGitHubCodeToolInputPage | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            title="GrepGitHubCodeToolInputPage",
        ),
    ]


class GrepGitHubCodeInput(RootModel[GrepGitHubCodeToolInput]):
    root: GrepGitHubCodeToolInput


class GrepGitHubCodeToolOutputTotalCount(RootModel[int]):
    root: Annotated[int, Field(title="GrepGitHubCodeToolOutputTotalCount")]


class GrepGitHubCodeToolOutputResultsReturned(RootModel[int]):
    root: Annotated[int, Field(title="GrepGitHubCodeToolOutputResultsReturned")]


class GrepGitHubCodeToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    total_count: Annotated[
        GrepGitHubCodeToolOutputTotalCount,
        Field(alias="totalCount", title="GrepGitHubCodeToolOutputTotalCount"),
    ]
    results_returned: Annotated[
        GrepGitHubCodeToolOutputResultsReturned,
        Field(alias="resultsReturned", title="GrepGitHubCodeToolOutputResultsReturned"),
    ]
    pattern: str
    query: str
    repositories: list[str]
    pagination: GitHubPagination
    results: list[GitHubCodeGrepResult]
    message: str
    tip: str


class ImageEditToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    image_url: Annotated[
        str,
        Field(description="URL of the image to edit. Must be a signed URL from our internal GCS image bucket."),
    ]
    prompt: Annotated[
        str,
        Field(description="Natural language instruction describing how to edit the image."),
    ]


class ImageEditInput(RootModel[ImageEditToolInput]):
    root: ImageEditToolInput


class ImageEditSnippet(Image):
    pass


class ImageEditToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    url: str
    image_url: str
    summary: str
    snippets: list[ImageEditSnippet]


class ImageEditOutput(RootModel[ImageEditToolOutput]):
    root: ImageEditToolOutput


class InstallationType(StrEnum):
    form = "form"
    oauth = "oauth"


class IntegrationFieldsResponseFields(RootModel[list[FormFieldDefinition] | list[ConfigurationFieldDefinition]]):
    root: Annotated[
        list[FormFieldDefinition] | list[ConfigurationFieldDefinition],
        Field(title="IntegrationFieldsResponseFields"),
    ]


class IntegrationFieldsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    installation_type: Annotated[InstallationType, Field(alias="installationType")]
    fields: Annotated[IntegrationFieldsResponseFields, Field(title="IntegrationFieldsResponseFields")]


class JiraAssigneeInput1(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    email: Annotated[str, Field(description="The assignee email")]


class JiraAssigneeInput(RootModel[JiraAssigneeInput1 | None]):
    root: JiraAssigneeInput1 | None


class JiraCreateTicketToolInputDescription(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="The issue description in plain text or markdown format.",
            title="JiraCreateTicketToolInputDescription",
        ),
    ]


class JiraCreateTicketToolInputIssueType(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='The Jira issue type (e.g., "Task", "Bug", "Story", "Epic", "Subtask", "Improvement", "New Feature")',
            title="JiraCreateTicketToolInputIssueType",
        ),
    ] = "Task"


class JiraCreateTicketToolInputPriority(RootModel[int | None]):
    root: Annotated[
        int | None,
        Field(
            description="The priority of the ticket (number, typically 1-5)",
            title="JiraCreateTicketToolInputPriority",
        ),
    ]


class JiraCreateTicketToolInputLabels(RootModel[list[str] | None]):
    root: Annotated[
        list[str] | None,
        Field(
            description="The labels for the ticket (array of label names)",
            title="JiraCreateTicketToolInputLabels",
        ),
    ]


class JiraCreateTicketToolInputDueDate(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='The due date for the ticket in format "yyyy-MM-dd" (e.g., "2024-12-31"). Note: Jira requires the due date format to be yyyy-MM-dd.',
            title="JiraCreateTicketToolInputDueDate",
        ),
    ]


class JiraCreateTicketToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Atlassian/Jira integration to use.",
        ),
    ]
    title: Annotated[str, Field(description="The issue title/summary. This is required.")]
    description: Annotated[
        JiraCreateTicketToolInputDescription | None,
        Field(
            description="The issue description in plain text or markdown format.",
            title="JiraCreateTicketToolInputDescription",
        ),
    ] = None
    project_key: Annotated[
        str,
        Field(
            alias="projectKey",
            description='The Jira project key (e.g., "PROJ", "TEAM"). This is required.',
        ),
    ]
    issue_type: Annotated[
        JiraCreateTicketToolInputIssueType | None,
        Field(
            alias="issueType",
            description='The Jira issue type (e.g., "Task", "Bug", "Story", "Epic", "Subtask", "Improvement", "New Feature")',
            title="JiraCreateTicketToolInputIssueType",
            validate_default=True,
        ),
    ]
    assignee: Annotated[JiraAssigneeInput | None, Field(description="The assignee of the ticket")] = None
    priority: Annotated[
        JiraCreateTicketToolInputPriority | None,
        Field(
            description="The priority of the ticket (number, typically 1-5)",
            title="JiraCreateTicketToolInputPriority",
        ),
    ] = None
    labels: Annotated[
        JiraCreateTicketToolInputLabels | None,
        Field(
            description="The labels for the ticket (array of label names)",
            title="JiraCreateTicketToolInputLabels",
        ),
    ] = None
    due_date: Annotated[
        JiraCreateTicketToolInputDueDate | None,
        Field(
            alias="dueDate",
            description='The due date for the ticket in format "yyyy-MM-dd" (e.g., "2024-12-31"). Note: Jira requires the due date format to be yyyy-MM-dd.',
            title="JiraCreateTicketToolInputDueDate",
        ),
    ] = None


class JiraCreateTicketInput(RootModel[JiraCreateTicketToolInput]):
    root: JiraCreateTicketToolInput


class JiraIssueTypeRef(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str


class JiraIssueProjectRef(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    key: str


class JiraIssueAssignee(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    email: str | None = None


class JiraIssueState(JiraIssueTypeRef):
    pass


class JiraRichDescription(RootModel[str | dict[str, Any]]):
    root: str | dict[str, Any]


class JiraIssueSummaryPriority(RootModel[int]):
    root: Annotated[int, Field(title="JiraIssueSummaryPriority")]


class JiraIssueSummaryAssignee(RootModel[JiraIssueAssignee | None]):
    root: Annotated[JiraIssueAssignee | None, Field(title="JiraIssueSummaryAssignee")]


class JiraIssueSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str | None = None
    key: str
    identifier: str
    title: str | None = None
    description: JiraRichDescription | None = None
    state: JiraIssueState | None = None
    priority: Annotated[JiraIssueSummaryPriority | None, Field(title="JiraIssueSummaryPriority")] = None
    assignee: Annotated[JiraIssueSummaryAssignee | None, Field(title="JiraIssueSummaryAssignee")] = None
    labels: list[str] | None = None
    due_date: Annotated[str | None, Field(alias="dueDate")] = None
    project: JiraIssueProjectRef | None = None
    issue_type: Annotated[JiraIssueTypeRef | None, Field(alias="issueType")] = None
    url: str | None = None
    created_at: Annotated[str | None, Field(alias="createdAt")] = None
    updated_at: Annotated[str | None, Field(alias="updatedAt")] = None


class JiraCreateTicketToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    issue: JiraIssueSummary


class JiraProject(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    key: str
    name: str


class JiraCredentialsValidationResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    valid: bool
    projects: list[JiraProject] | None = None
    error: str | None = None


class JiraResourceProject(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    key: str
    name: str
    project_type_key: Annotated[str, Field(alias="projectTypeKey")]


class JiraResourcesPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    projects: list[JiraResourceProject]
    base_url: Annotated[str, Field(alias="baseUrl")]
    cloud_id: Annotated[str, Field(alias="cloudId")]


class JiraResourcesResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    resources: JiraResourcesPayload


class JiraSearchTicketToolInputJql(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="JQL (Jira Query Language) query to search for issues. If not provided, will search all issues.",
            title="JiraSearchTicketToolInputJql",
        ),
    ]


class JiraSearchTicketToolInputText(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Text to search for in issue titles and descriptions. If provided, will be converted to JQL: text ~ "search term"',
            title="JiraSearchTicketToolInputText",
        ),
    ]


class JiraSearchTicketToolInputProjectKey(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Filter by Jira project key (e.g., "PROJ", "TEAM")',
            title="JiraSearchTicketToolInputProjectKey",
        ),
    ]


class JiraSearchTicketToolInputAssigneeEmail(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Filter by assignee email address",
            title="JiraSearchTicketToolInputAssigneeEmail",
        ),
    ]


class JiraSearchTicketToolInputStatus(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Filter by status name (e.g., "In Progress", "Done", "To Do")',
            title="JiraSearchTicketToolInputStatus",
        ),
    ]


class JiraSearchTicketToolInputLimit(RootModel[int | None]):
    root: Annotated[
        int | None,
        Field(
            description="Maximum number of issues to return. Defaults to 50 if not provided.",
            title="JiraSearchTicketToolInputLimit",
        ),
    ]


class JiraSearchTicketToolInputNextPageToken(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Token from a previous search response to retrieve the next page of results. Use the nextPageToken value from the previous response to paginate through all results.",
            title="JiraSearchTicketToolInputNextPageToken",
        ),
    ]


class JiraSearchTicketToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Atlassian/Jira integration to use.",
        ),
    ]
    jql: Annotated[
        JiraSearchTicketToolInputJql | None,
        Field(
            description="JQL (Jira Query Language) query to search for issues. If not provided, will search all issues.",
            title="JiraSearchTicketToolInputJql",
        ),
    ] = None
    text: Annotated[
        JiraSearchTicketToolInputText | None,
        Field(
            description='Text to search for in issue titles and descriptions. If provided, will be converted to JQL: text ~ "search term"',
            title="JiraSearchTicketToolInputText",
        ),
    ] = None
    project_key: Annotated[
        JiraSearchTicketToolInputProjectKey | None,
        Field(
            alias="projectKey",
            description='Filter by Jira project key (e.g., "PROJ", "TEAM")',
            title="JiraSearchTicketToolInputProjectKey",
        ),
    ] = None
    assignee_email: Annotated[
        JiraSearchTicketToolInputAssigneeEmail | None,
        Field(
            alias="assigneeEmail",
            description="Filter by assignee email address",
            title="JiraSearchTicketToolInputAssigneeEmail",
        ),
    ] = None
    status: Annotated[
        JiraSearchTicketToolInputStatus | None,
        Field(
            description='Filter by status name (e.g., "In Progress", "Done", "To Do")',
            title="JiraSearchTicketToolInputStatus",
        ),
    ] = None
    limit: Annotated[
        JiraSearchTicketToolInputLimit | None,
        Field(
            description="Maximum number of issues to return. Defaults to 50 if not provided.",
            title="JiraSearchTicketToolInputLimit",
        ),
    ] = None
    next_page_token: Annotated[
        JiraSearchTicketToolInputNextPageToken | None,
        Field(
            alias="nextPageToken",
            description="Token from a previous search response to retrieve the next page of results. Use the nextPageToken value from the previous response to paginate through all results.",
            title="JiraSearchTicketToolInputNextPageToken",
        ),
    ] = None


class JiraSearchTicketInput(RootModel[JiraSearchTicketToolInput]):
    root: JiraSearchTicketToolInput


class JiraSearchTicketToolOutputCount(RootModel[int]):
    root: Annotated[int, Field(title="JiraSearchTicketToolOutputCount")]


class JiraSearchTicketToolOutputTotal(RootModel[int]):
    root: Annotated[int, Field(title="JiraSearchTicketToolOutputTotal")]


class JiraSearchTicketToolOutputMaxResults(RootModel[int]):
    root: Annotated[int, Field(title="JiraSearchTicketToolOutputMaxResults")]


class JiraSearchTicketToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    issues: list[JiraIssueSummary]
    count: Annotated[JiraSearchTicketToolOutputCount, Field(title="JiraSearchTicketToolOutputCount")]
    total: Annotated[JiraSearchTicketToolOutputTotal, Field(title="JiraSearchTicketToolOutputTotal")]
    max_results: Annotated[
        JiraSearchTicketToolOutputMaxResults,
        Field(alias="maxResults", title="JiraSearchTicketToolOutputMaxResults"),
    ]
    is_last: Annotated[bool, Field(alias="isLast")]
    next_page_token: Annotated[str | None, Field(alias="nextPageToken")] = None
    jql: str


class JiraUpdateTicketToolInputTitle(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="The issue title/summary.",
            title="JiraUpdateTicketToolInputTitle",
        ),
    ]


class JiraUpdateTicketToolInputDescription(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="The issue description in plain text or markdown format.",
            title="JiraUpdateTicketToolInputDescription",
        ),
    ]


class JiraUpdateTicketToolInputStatus(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='The status name to transition to (e.g., "In Progress", "Done", "To Do").',
            title="JiraUpdateTicketToolInputStatus",
        ),
    ]


class JiraUpdateTicketToolInputPriority(RootModel[int | None]):
    root: Annotated[
        int | None,
        Field(
            description="The priority of the ticket (number, typically 1-5).",
            title="JiraUpdateTicketToolInputPriority",
        ),
    ]


class JiraUpdateTicketToolInputLabels(RootModel[list[str] | None]):
    root: Annotated[
        list[str] | None,
        Field(
            description="The labels for the ticket (array of label names). This replaces all existing labels.",
            title="JiraUpdateTicketToolInputLabels",
        ),
    ]


class JiraUpdateTicketToolInputDueDate(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='The due date for the ticket in format "yyyy-MM-dd" (e.g., "2024-12-31"). Note: Jira requires the due date format to be yyyy-MM-dd. Set to null to remove due date.',
            title="JiraUpdateTicketToolInputDueDate",
        ),
    ]


class JiraUpdateTicketToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Atlassian/Jira integration to use.",
        ),
    ]
    issue_key: Annotated[
        str,
        Field(
            alias="issueKey",
            description='The key of the Jira issue to update (e.g., "PROJ-123"). This is required.',
        ),
    ]
    title: Annotated[
        JiraUpdateTicketToolInputTitle | None,
        Field(
            description="The issue title/summary.",
            title="JiraUpdateTicketToolInputTitle",
        ),
    ] = None
    description: Annotated[
        JiraUpdateTicketToolInputDescription | None,
        Field(
            description="The issue description in plain text or markdown format.",
            title="JiraUpdateTicketToolInputDescription",
        ),
    ] = None
    status: Annotated[
        JiraUpdateTicketToolInputStatus | None,
        Field(
            description='The status name to transition to (e.g., "In Progress", "Done", "To Do").',
            title="JiraUpdateTicketToolInputStatus",
        ),
    ] = None
    assignee: Annotated[
        JiraAssigneeInput | None,
        Field(description="The assignee of the ticket. Set to null to unassign."),
    ] = None
    priority: Annotated[
        JiraUpdateTicketToolInputPriority | None,
        Field(
            description="The priority of the ticket (number, typically 1-5).",
            title="JiraUpdateTicketToolInputPriority",
        ),
    ] = None
    labels: Annotated[
        JiraUpdateTicketToolInputLabels | None,
        Field(
            description="The labels for the ticket (array of label names). This replaces all existing labels.",
            title="JiraUpdateTicketToolInputLabels",
        ),
    ] = None
    due_date: Annotated[
        JiraUpdateTicketToolInputDueDate | None,
        Field(
            alias="dueDate",
            description='The due date for the ticket in format "yyyy-MM-dd" (e.g., "2024-12-31"). Note: Jira requires the due date format to be yyyy-MM-dd. Set to null to remove due date.',
            title="JiraUpdateTicketToolInputDueDate",
        ),
    ] = None


class JiraUpdateTicketInput(RootModel[JiraUpdateTicketToolInput]):
    root: JiraUpdateTicketToolInput


class JiraUpdateTicketToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    issue: JiraIssueSummary
    updated_fields: Annotated[list[str], Field(alias="updatedFields")]


class LaunchDarklyEnvironment(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    key: str
    name: str


class LaunchDarklyEnvironmentsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    environments: list[LaunchDarklyEnvironment]


class LaunchDarklyFlagSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    key: str
    name: str
    description: str
    environments: dict[str, bool]
    url: str
    environment_urls: Annotated[dict[str, str], Field(alias="environmentUrls")]


class LaunchDarklyProject(LaunchDarklyEnvironment):
    pass


class LaunchDarklyProjectsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    projects: list[LaunchDarklyProject]


class LinearAddCommentToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Linear workspace to use.",
        ),
    ]
    issue_id: Annotated[
        str,
        Field(
            alias="issueId",
            description="The ID of the Linear issue to add the comment to. Use linear_search_ticket to find the issue ID.",
        ),
    ]
    body: Annotated[str, Field(description="The comment text to add to the issue.")]


class LinearAddCommentInput(RootModel[LinearAddCommentToolInput]):
    root: LinearAddCommentToolInput


class LinearCommentHandleCreatedAt(RootModel[str | AwareDatetime]):
    root: Annotated[str | AwareDatetime, Field(title="LinearCommentHandleCreatedAt")]


class LinearCommentHandleUpdatedAt(RootModel[str | AwareDatetime]):
    root: Annotated[str | AwareDatetime, Field(title="LinearCommentHandleUpdatedAt")]


class LinearCommentHandle(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    body: str | None = None
    created_at: Annotated[
        LinearCommentHandleCreatedAt | None,
        Field(alias="createdAt", title="LinearCommentHandleCreatedAt"),
    ] = None
    updated_at: Annotated[
        LinearCommentHandleUpdatedAt | None,
        Field(alias="updatedAt", title="LinearCommentHandleUpdatedAt"),
    ] = None


class LinearAddCommentToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    comment: LinearCommentHandle


class LinearCreateTicketPayloadDescription(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearCreateTicketPayloadDescription")]


class LinearCreateTicketPayloadStateId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearCreateTicketPayloadStateId")]


class LinearCreateTicketPayloadPriority(RootModel[int | None]):
    root: Annotated[int | None, Field(title="LinearCreateTicketPayloadPriority")]


class LinearCreateTicketPayloadProjectId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearCreateTicketPayloadProjectId")]


class LinearCreateTicketPayloadLabelIds(RootModel[list[str] | None]):
    root: Annotated[list[str] | None, Field(title="LinearCreateTicketPayloadLabelIds")]


class LinearCreateTicketPayloadAssigneeId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearCreateTicketPayloadAssigneeId")]


class LinearCreateTicketPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    title: str
    team_id: Annotated[str, Field(alias="teamId")]
    description: Annotated[
        LinearCreateTicketPayloadDescription | None,
        Field(title="LinearCreateTicketPayloadDescription"),
    ] = None
    state_id: Annotated[
        LinearCreateTicketPayloadStateId | None,
        Field(alias="stateId", title="LinearCreateTicketPayloadStateId"),
    ] = None
    priority: Annotated[
        LinearCreateTicketPayloadPriority | None,
        Field(title="LinearCreateTicketPayloadPriority"),
    ] = None
    project_id: Annotated[
        LinearCreateTicketPayloadProjectId | None,
        Field(alias="projectId", title="LinearCreateTicketPayloadProjectId"),
    ] = None
    label_ids: Annotated[
        LinearCreateTicketPayloadLabelIds | None,
        Field(alias="labelIds", title="LinearCreateTicketPayloadLabelIds"),
    ] = None
    assignee_id: Annotated[
        LinearCreateTicketPayloadAssigneeId | None,
        Field(alias="assigneeId", title="LinearCreateTicketPayloadAssigneeId"),
    ] = None


class LinearCreateTicketToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Linear workspace to use.",
        ),
    ]
    ticket: LinearCreateTicketPayload


class LinearCreateTicketInput(RootModel[LinearCreateTicketToolInput]):
    root: LinearCreateTicketToolInput


class LinearIssueHandleDescription(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearIssueHandleDescription")]


class LinearIssueHandleCreatedAt(RootModel[str | AwareDatetime]):
    root: Annotated[str | AwareDatetime, Field(title="LinearIssueHandleCreatedAt")]


class LinearIssueHandleUpdatedAt(RootModel[str | AwareDatetime]):
    root: Annotated[str | AwareDatetime, Field(title="LinearIssueHandleUpdatedAt")]


class LinearIssueHandle(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    identifier: str
    title: str
    description: Annotated[LinearIssueHandleDescription | None, Field(title="LinearIssueHandleDescription")] = None
    url: str
    created_at: Annotated[
        LinearIssueHandleCreatedAt | None,
        Field(alias="createdAt", title="LinearIssueHandleCreatedAt"),
    ] = None
    updated_at: Annotated[
        LinearIssueHandleUpdatedAt | None,
        Field(alias="updatedAt", title="LinearIssueHandleUpdatedAt"),
    ] = None


class LinearCreateTicketToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    issue: LinearIssueHandle


class LinearGetLabelsToolInputTeamId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional team ID to limit results to that team's labels.",
            title="LinearGetLabelsToolInputTeamId",
        ),
    ]


class LinearGetLabelsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Linear integration to use.",
        ),
    ]
    team_id: Annotated[
        LinearGetLabelsToolInputTeamId | None,
        Field(
            alias="teamId",
            description="Optional team ID to limit results to that team's labels.",
            title="LinearGetLabelsToolInputTeamId",
        ),
    ] = None


class LinearGetLabelsInput(RootModel[LinearGetLabelsToolInput]):
    root: LinearGetLabelsToolInput


class LinearLabelSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    color: str
    team_id: Annotated[str, Field(alias="teamId")]


class LinearGetLabelsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    labels: list[LinearLabelSummary]


class LinearGetProjectsToolInputTeamId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional team ID to limit results to that team's projects.",
            title="LinearGetProjectsToolInputTeamId",
        ),
    ]


class LinearGetProjectsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Linear integration to use.",
        ),
    ]
    team_id: Annotated[
        LinearGetProjectsToolInputTeamId | None,
        Field(
            alias="teamId",
            description="Optional team ID to limit results to that team's projects.",
            title="LinearGetProjectsToolInputTeamId",
        ),
    ] = None


class LinearGetProjectsInput(RootModel[LinearGetProjectsToolInput]):
    root: LinearGetProjectsToolInput


class LinearProjectSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    description: str | None = None
    team_id: Annotated[str, Field(alias="teamId")]


class LinearGetProjectsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    projects: list[LinearProjectSummary]


class LinearGetStatesToolInputTeamId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional team ID to limit results to that team's states.",
            title="LinearGetStatesToolInputTeamId",
        ),
    ]


class LinearGetStatesToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Linear integration to use.",
        ),
    ]
    team_id: Annotated[
        LinearGetStatesToolInputTeamId | None,
        Field(
            alias="teamId",
            description="Optional team ID to limit results to that team's states.",
            title="LinearGetStatesToolInputTeamId",
        ),
    ] = None


class LinearGetStatesInput(RootModel[LinearGetStatesToolInput]):
    root: LinearGetStatesToolInput


class LinearStateSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    type: str
    color: str
    team_id: Annotated[str, Field(alias="teamId")]


class LinearGetStatesToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    states: list[LinearStateSummary]


class LinearGetTeamsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Linear integration to use.",
        ),
    ]


class LinearGetTeamsInput(RootModel[LinearGetTeamsToolInput]):
    root: LinearGetTeamsToolInput


class LinearTeam(JiraIssueProjectRef):
    pass


class LinearGetTeamsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    teams: list[LinearTeam]


class LinearGetUsersToolInput(LinearGetTeamsToolInput):
    pass


class LinearGetUsersInput(RootModel[LinearGetUsersToolInput]):
    root: LinearGetUsersToolInput


class LinearUserSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    email: str
    avatar_url: Annotated[str | None, Field(alias="avatarUrl")] = None


class LinearGetUsersToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    users: list[LinearUserSummary]


class LinearIssueAssignee(JiraIssueAssignee):
    pass


class LinearIssueProject(JiraIssueTypeRef):
    pass


class LinearIssueDetailDescription(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearIssueDetailDescription")]


class LinearIssueDetailPriority(RootModel[int | None]):
    root: Annotated[int | None, Field(title="LinearIssueDetailPriority")]


class LinearIssueDetailAssignee(RootModel[LinearIssueAssignee | None]):
    root: Annotated[LinearIssueAssignee | None, Field(title="LinearIssueDetailAssignee")]


class LinearIssueDetailCreatedAt(RootModel[str | AwareDatetime]):
    root: Annotated[str | AwareDatetime, Field(title="LinearIssueDetailCreatedAt")]


class LinearIssueDetailUpdatedAt(RootModel[str | AwareDatetime]):
    root: Annotated[str | AwareDatetime, Field(title="LinearIssueDetailUpdatedAt")]


class LinearIssueDetailTeam(RootModel[LinearTeam | None]):
    root: Annotated[LinearTeam | None, Field(title="LinearIssueDetailTeam")]


class LinearIssueDetailProject(RootModel[LinearIssueProject | None]):
    root: Annotated[LinearIssueProject | None, Field(title="LinearIssueDetailProject")]


class LinearIssueDetailDueDate(RootModel[str | AwareDatetime]):
    root: Annotated[str | AwareDatetime, Field(title="LinearIssueDetailDueDate")]


class LinearIssueDetailEstimate(RootModel[float | None]):
    root: Annotated[float | None, Field(title="LinearIssueDetailEstimate")]


class LinearIssueDetail(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    identifier: str
    title: str
    description: Annotated[LinearIssueDetailDescription | None, Field(title="LinearIssueDetailDescription")] = None
    state: str
    priority: Annotated[LinearIssueDetailPriority | None, Field(title="LinearIssueDetailPriority")] = None
    assignee: Annotated[LinearIssueDetailAssignee | None, Field(title="LinearIssueDetailAssignee")]
    url: str
    created_at: Annotated[
        LinearIssueDetailCreatedAt,
        Field(alias="createdAt", title="LinearIssueDetailCreatedAt"),
    ]
    updated_at: Annotated[
        LinearIssueDetailUpdatedAt,
        Field(alias="updatedAt", title="LinearIssueDetailUpdatedAt"),
    ]
    team: Annotated[LinearIssueDetailTeam | None, Field(title="LinearIssueDetailTeam")]
    project: Annotated[LinearIssueDetailProject | None, Field(title="LinearIssueDetailProject")]
    due_date: Annotated[
        LinearIssueDetailDueDate | None,
        Field(alias="dueDate", title="LinearIssueDetailDueDate"),
    ] = None
    estimate: Annotated[LinearIssueDetailEstimate | None, Field(title="LinearIssueDetailEstimate")] = None


class LinearIssueSummaryDescription(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearIssueSummaryDescription")]


class LinearIssueSummaryPriority(RootModel[int | None]):
    root: Annotated[int | None, Field(title="LinearIssueSummaryPriority")]


class LinearIssueSummaryAssignee(RootModel[LinearIssueAssignee | None]):
    root: Annotated[LinearIssueAssignee | None, Field(title="LinearIssueSummaryAssignee")]


class LinearIssueSummaryCreatedAt(RootModel[str | AwareDatetime]):
    root: Annotated[str | AwareDatetime, Field(title="LinearIssueSummaryCreatedAt")]


class LinearIssueSummaryUpdatedAt(RootModel[str | AwareDatetime]):
    root: Annotated[str | AwareDatetime, Field(title="LinearIssueSummaryUpdatedAt")]


class LinearIssueSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    identifier: str
    title: str
    description: Annotated[
        LinearIssueSummaryDescription | None,
        Field(title="LinearIssueSummaryDescription"),
    ] = None
    state: str
    priority: Annotated[LinearIssueSummaryPriority | None, Field(title="LinearIssueSummaryPriority")] = None
    assignee: Annotated[LinearIssueSummaryAssignee | None, Field(title="LinearIssueSummaryAssignee")]
    url: str
    created_at: Annotated[
        LinearIssueSummaryCreatedAt,
        Field(alias="createdAt", title="LinearIssueSummaryCreatedAt"),
    ]
    updated_at: Annotated[
        LinearIssueSummaryUpdatedAt,
        Field(alias="updatedAt", title="LinearIssueSummaryUpdatedAt"),
    ]


class LinearIssueTeam(RootModel[LinearTeam]):
    root: LinearTeam


class LinearReadTicketComment(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    body: str
    author_id: Annotated[str, Field(alias="authorId")]
    created_at: Annotated[str, Field(alias="createdAt")]


class LinearReadTicketToolInputIncludeComments(RootModel[bool | None]):
    root: Annotated[
        bool | None,
        Field(
            description="Whether to include comments. Defaults to true.",
            title="LinearReadTicketToolInputIncludeComments",
        ),
    ]


class LinearReadTicketToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Linear integration to use.",
        ),
    ]
    issue_id: Annotated[
        str,
        Field(
            alias="issueId",
            description="The Linear issue ID (UUID) or identifier (e.g. 'PROJ-123').",
        ),
    ]
    include_comments: Annotated[
        LinearReadTicketToolInputIncludeComments | None,
        Field(
            alias="includeComments",
            description="Whether to include comments. Defaults to true.",
            title="LinearReadTicketToolInputIncludeComments",
        ),
    ] = None


class LinearReadTicketInput(RootModel[LinearReadTicketToolInput]):
    root: LinearReadTicketToolInput


class LinearReadTicketToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    issue: LinearIssueDetail
    comments: list[LinearReadTicketComment] | None = None


class LinearSearchPaginationEndCursor(RootModel[str | None]):
    root: Annotated[str | None, Field(title="LinearSearchPaginationEndCursor")]


class LinearSearchPaginationLimit(RootModel[int | None]):
    root: Annotated[int | None, Field(title="LinearSearchPaginationLimit")]


class LinearSearchPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    has_next_page: Annotated[bool, Field(alias="hasNextPage")]
    end_cursor: Annotated[
        LinearSearchPaginationEndCursor | None,
        Field(alias="endCursor", title="LinearSearchPaginationEndCursor"),
    ]
    limit: Annotated[LinearSearchPaginationLimit | None, Field(title="LinearSearchPaginationLimit")]


class LinearSearchTicketDateFilterField(StrEnum):
    updated_at = "updatedAt"
    created_at = "createdAt"


class LinearSearchTicketToolInputSearchTerm(RootModel[str]):
    root: Annotated[
        str,
        Field(
            description='Plain-text keyword search (matched against titles, descriptions, etc.).\n            Do NOT include operators or field filters. Use dedicated parameters instead.\n            ✓ "block kit"\n            ✗ "team:TER state:Done updated:>2026-02-04 block kit"',
            title="LinearSearchTicketToolInputSearchTerm",
        ),
    ] = ""


class LinearSearchTicketToolInputStateName(StrEnum):
    triage = "Triage"
    backlog = "Backlog"
    todo = "Todo"
    in_progress = "In Progress"
    in_review = "In Review"
    done = "Done"
    canceled = "Canceled"


class LinearSearchTicketToolInputStateNames(RootModel[list[LinearSearchTicketToolInputStateName] | None]):
    root: Annotated[
        list[LinearSearchTicketToolInputStateName] | None,
        Field(
            description="Filter to only include issues with these state names. Available states: Triage, Backlog, Todo, In Progress, In Review, Done, Canceled.",
            title="LinearSearchTicketToolInputStateNames",
        ),
    ]


class LinearSearchTicketToolInputDateFilterField(RootModel[LinearSearchTicketDateFilterField | None]):
    root: Annotated[
        LinearSearchTicketDateFilterField | None,
        Field(
            description="Which date field to filter on. Required if using dateAfter or dateBefore. Options: 'updatedAt' (when issue was last modified) or 'createdAt' (when issue was created).",
            title="LinearSearchTicketToolInputDateFilterField",
        ),
    ]


class LinearSearchTicketToolInputDateAfter(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Filter to only include issues where the dateFilterField is on or after this date. ISO 8601 format (e.g., '2026-01-01' or '2026-01-01T00:00:00Z').",
            title="LinearSearchTicketToolInputDateAfter",
        ),
    ]


class LinearSearchTicketToolInputDateBefore(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Filter to only include issues where the dateFilterField is on or before this date. ISO 8601 format (e.g., '2026-02-01' or '2026-02-01T23:59:59Z').",
            title="LinearSearchTicketToolInputDateBefore",
        ),
    ]


class LinearSearchTicketToolInputLimit(RootModel[int | None]):
    root: Annotated[
        int | None,
        Field(
            description="Maximum number of issues to return. Defaults to 10 if not provided.",
            title="LinearSearchTicketToolInputLimit",
        ),
    ]


class LinearSearchTicketToolInputAfter(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Cursor for pagination. Use the endCursor from the previous response to fetch the next page of results.",
            title="LinearSearchTicketToolInputAfter",
        ),
    ]


class LinearSearchTicketToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Linear integration to use.",
        ),
    ]
    search_term: Annotated[
        LinearSearchTicketToolInputSearchTerm,
        Field(
            alias="searchTerm",
            description='Plain-text keyword search (matched against titles, descriptions, etc.).\n            Do NOT include operators or field filters. Use dedicated parameters instead.\n            ✓ "block kit"\n            ✗ "team:TER state:Done updated:>2026-02-04 block kit"',
            title="LinearSearchTicketToolInputSearchTerm",
            validate_default=True,
        ),
    ]
    state_names: Annotated[
        LinearSearchTicketToolInputStateNames | None,
        Field(
            alias="stateNames",
            description="Filter to only include issues with these state names. Available states: Triage, Backlog, Todo, In Progress, In Review, Done, Canceled.",
            title="LinearSearchTicketToolInputStateNames",
        ),
    ] = None
    date_filter_field: Annotated[
        LinearSearchTicketToolInputDateFilterField | None,
        Field(
            alias="dateFilterField",
            description="Which date field to filter on. Required if using dateAfter or dateBefore. Options: 'updatedAt' (when issue was last modified) or 'createdAt' (when issue was created).",
            title="LinearSearchTicketToolInputDateFilterField",
        ),
    ] = None
    date_after: Annotated[
        LinearSearchTicketToolInputDateAfter | None,
        Field(
            alias="dateAfter",
            description="Filter to only include issues where the dateFilterField is on or after this date. ISO 8601 format (e.g., '2026-01-01' or '2026-01-01T00:00:00Z').",
            title="LinearSearchTicketToolInputDateAfter",
        ),
    ] = None
    date_before: Annotated[
        LinearSearchTicketToolInputDateBefore | None,
        Field(
            alias="dateBefore",
            description="Filter to only include issues where the dateFilterField is on or before this date. ISO 8601 format (e.g., '2026-02-01' or '2026-02-01T23:59:59Z').",
            title="LinearSearchTicketToolInputDateBefore",
        ),
    ] = None
    limit: Annotated[
        LinearSearchTicketToolInputLimit | None,
        Field(
            description="Maximum number of issues to return. Defaults to 10 if not provided.",
            title="LinearSearchTicketToolInputLimit",
        ),
    ] = None
    after: Annotated[
        LinearSearchTicketToolInputAfter | None,
        Field(
            description="Cursor for pagination. Use the endCursor from the previous response to fetch the next page of results.",
            title="LinearSearchTicketToolInputAfter",
        ),
    ] = None


class LinearSearchTicketInput(RootModel[LinearSearchTicketToolInput]):
    root: LinearSearchTicketToolInput


class LinearSearchTicketToolOutputCount(RootModel[int]):
    root: Annotated[int, Field(title="LinearSearchTicketToolOutputCount")]


class LinearSearchTicketToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    issues: list[LinearIssueSummary]
    count: Annotated[
        LinearSearchTicketToolOutputCount,
        Field(title="LinearSearchTicketToolOutputCount"),
    ]
    query: str
    pagination: LinearSearchPagination


class LinearUpdateTicketUpdatesTitle(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="The updated title of the ticket.",
            title="LinearUpdateTicketUpdatesTitle",
        ),
    ]


class LinearUpdateTicketUpdatesDescription(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="The updated description of the ticket.",
            title="LinearUpdateTicketUpdatesDescription",
        ),
    ]


class LinearUpdateTicketUpdatesStateId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="The ID of the state to set. Use linear_get_states to find available states.",
            title="LinearUpdateTicketUpdatesStateId",
        ),
    ]


class LinearUpdateTicketUpdatesPriority(RootModel[int | None]):
    root: Annotated[
        int | None,
        Field(
            description="The priority of the ticket. 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low.",
            title="LinearUpdateTicketUpdatesPriority",
        ),
    ]


class LinearUpdateTicketUpdatesProjectId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="The ID of the project to associate with the ticket. Use linear_get_projects to find available projects.",
            title="LinearUpdateTicketUpdatesProjectId",
        ),
    ]


class LinearUpdateTicketUpdatesLabelIds(RootModel[list[str] | None]):
    root: Annotated[
        list[str] | None,
        Field(
            description="The IDs of labels to add to the ticket. Use linear_get_labels to find available labels.",
            title="LinearUpdateTicketUpdatesLabelIds",
        ),
    ]


class LinearUpdateTicketUpdatesAssigneeId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="The ID of the user to assign the ticket to. Use linear_get_users to find available users and their IDs.",
            title="LinearUpdateTicketUpdatesAssigneeId",
        ),
    ]


class LinearUpdateTicketUpdates(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    title: Annotated[
        LinearUpdateTicketUpdatesTitle | None,
        Field(
            description="The updated title of the ticket.",
            title="LinearUpdateTicketUpdatesTitle",
        ),
    ] = None
    description: Annotated[
        LinearUpdateTicketUpdatesDescription | None,
        Field(
            description="The updated description of the ticket.",
            title="LinearUpdateTicketUpdatesDescription",
        ),
    ] = None
    state_id: Annotated[
        LinearUpdateTicketUpdatesStateId | None,
        Field(
            alias="stateId",
            description="The ID of the state to set. Use linear_get_states to find available states.",
            title="LinearUpdateTicketUpdatesStateId",
        ),
    ] = None
    priority: Annotated[
        LinearUpdateTicketUpdatesPriority | None,
        Field(
            description="The priority of the ticket. 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low.",
            title="LinearUpdateTicketUpdatesPriority",
        ),
    ] = None
    project_id: Annotated[
        LinearUpdateTicketUpdatesProjectId | None,
        Field(
            alias="projectId",
            description="The ID of the project to associate with the ticket. Use linear_get_projects to find available projects.",
            title="LinearUpdateTicketUpdatesProjectId",
        ),
    ] = None
    label_ids: Annotated[
        LinearUpdateTicketUpdatesLabelIds | None,
        Field(
            alias="labelIds",
            description="The IDs of labels to add to the ticket. Use linear_get_labels to find available labels.",
            title="LinearUpdateTicketUpdatesLabelIds",
        ),
    ] = None
    assignee_id: Annotated[
        LinearUpdateTicketUpdatesAssigneeId | None,
        Field(
            alias="assigneeId",
            description="The ID of the user to assign the ticket to. Use linear_get_users to find available users and their IDs.",
            title="LinearUpdateTicketUpdatesAssigneeId",
        ),
    ] = None


class LinearUpdateTicketToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Linear workspace to use.",
        ),
    ]
    issue_id: Annotated[
        str,
        Field(
            alias="issueId",
            description="The ID of the Linear issue to update. Use linear_search_ticket to find the issue ID.",
        ),
    ]
    updates: LinearUpdateTicketUpdates


class LinearUpdateTicketInput(RootModel[LinearUpdateTicketToolInput]):
    root: LinearUpdateTicketToolInput


class LinearUpdateTicketToolOutput(LinearCreateTicketToolOutput):
    pass


class LinearWorkspace(JiraIssueTypeRef):
    pass


class ListGitHubCommitsToolInputSince(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Start of time window (ISO date string, e.g., "2024-01-01" or "2024-01-15T00:00:00Z"). Only commits after this date are included. Use null for no start filter.',
            title="ListGitHubCommitsToolInputSince",
        ),
    ]


class ListGitHubCommitsToolInputUntil(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="End of time window (ISO date string). Only commits before this date are included. Use null for no end filter.",
            title="ListGitHubCommitsToolInputUntil",
        ),
    ]


class ListGitHubCommitsToolInputBranch(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Branch name to list commits from (e.g., "main", "develop"). Use null for the repository\'s default branch.',
            title="ListGitHubCommitsToolInputBranch",
        ),
    ]


class ListGitHubCommitsToolInputPath(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Only include commits that affect this file or directory path (e.g., "src/components" or "package.json"). Use null for all paths.',
            title="ListGitHubCommitsToolInputPath",
        ),
    ]


class ListGitHubCommitsToolInputAuthor(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Filter commits by author (GitHub username or email). Use null for all authors.",
            title="ListGitHubCommitsToolInputAuthor",
        ),
    ]


class ListGitHubCommitsToolInputPerPage(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Number of results to return (default: 30, max: 100)",
            title="ListGitHubCommitsToolInputPerPage",
        ),
    ]


class ListGitHubCommitsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    repository: Annotated[
        str,
        Field(
            description='Repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'
        ),
    ]
    since: Annotated[
        ListGitHubCommitsToolInputSince | None,
        Field(
            description='Start of time window (ISO date string, e.g., "2024-01-01" or "2024-01-15T00:00:00Z"). Only commits after this date are included. Use null for no start filter.',
            title="ListGitHubCommitsToolInputSince",
        ),
    ]
    until: Annotated[
        ListGitHubCommitsToolInputUntil | None,
        Field(
            description="End of time window (ISO date string). Only commits before this date are included. Use null for no end filter.",
            title="ListGitHubCommitsToolInputUntil",
        ),
    ] = None
    branch: Annotated[
        ListGitHubCommitsToolInputBranch | None,
        Field(
            description='Branch name to list commits from (e.g., "main", "develop"). Use null for the repository\'s default branch.',
            title="ListGitHubCommitsToolInputBranch",
        ),
    ] = None
    path: Annotated[
        ListGitHubCommitsToolInputPath | None,
        Field(
            description='Only include commits that affect this file or directory path (e.g., "src/components" or "package.json"). Use null for all paths.',
            title="ListGitHubCommitsToolInputPath",
        ),
    ] = None
    author: Annotated[
        ListGitHubCommitsToolInputAuthor | None,
        Field(
            description="Filter commits by author (GitHub username or email). Use null for all authors.",
            title="ListGitHubCommitsToolInputAuthor",
        ),
    ] = None
    per_page: Annotated[
        ListGitHubCommitsToolInputPerPage,
        Field(
            alias="perPage",
            description="Number of results to return (default: 30, max: 100)",
            title="ListGitHubCommitsToolInputPerPage",
        ),
    ]


class ListGitHubCommitsInput(RootModel[ListGitHubCommitsToolInput]):
    root: ListGitHubCommitsToolInput


class ListGitHubCommitsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    repository: str
    time_window: Annotated[str, Field(alias="timeWindow")]
    filters: str
    summary: GitHubCommitListSummary
    commits: list[GitHubCommitSummary]
    message: str
    tip: str


class ListGitHubDirectoryToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    repository: Annotated[
        str,
        Field(
            description='The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'
        ),
    ]
    path: Annotated[
        str,
        Field(
            description='The directory path to list (e.g., "src/components"). Use empty string "" for root directory.'
        ),
    ]
    recursive: Annotated[
        bool,
        Field(
            description="If true, list all files recursively (can be large for big repos). Use false for single-level listing."
        ),
    ]


class ListGitHubDirectoryInput(RootModel[ListGitHubDirectoryToolInput]):
    root: ListGitHubDirectoryToolInput


class ListGitHubDirectoryToolOutputTotalItems(RootModel[int]):
    root: Annotated[int, Field(title="ListGitHubDirectoryToolOutputTotalItems")]


class ListGitHubDirectoryToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    repository: str
    path: str
    recursive: bool
    total_items: Annotated[
        ListGitHubDirectoryToolOutputTotalItems,
        Field(alias="totalItems", title="ListGitHubDirectoryToolOutputTotalItems"),
    ]
    directories: list[GitHubDirectoryEntry | str]
    files: list[GitHubFileEntry]
    warning: str | None = None
    tip: str | None = None
    truncated: bool | None = None
    other: list[GitHubOtherEntry] | None = None


class State(StrEnum):
    open = "open"
    closed = "closed"
    all = "all"


class ListGitHubPullRequestsToolInputSince(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Start date in YYYY-MM-DD format (e.g., "2024-01-15"). Only PRs updated on or after this date (starting at 00:00:00) are included. Use null for no start filter.',
            title="ListGitHubPullRequestsToolInputSince",
        ),
    ]


class ListGitHubPullRequestsToolInputUntil(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='End date in YYYY-MM-DD format (e.g., "2024-01-15"). Only PRs updated on or before this date (ending at 23:59:59) are included. Use null for no end filter.',
            title="ListGitHubPullRequestsToolInputUntil",
        ),
    ]


class ListGitHubPullRequestsToolInputPerPage(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Number of results to return (default: 20, max: 100)",
            title="ListGitHubPullRequestsToolInputPerPage",
        ),
    ]


class ListGitHubPullRequestsToolInputPage1(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional PRs if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            ge=1,
            title="ListGitHubPullRequestsToolInputPage",
        ),
    ]


class ListGitHubPullRequestsToolInputPage(RootModel[ListGitHubPullRequestsToolInputPage1 | None]):
    root: Annotated[
        ListGitHubPullRequestsToolInputPage1 | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional PRs if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            title="ListGitHubPullRequestsToolInputPage",
        ),
    ]


class ListGitHubPullRequestsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    repository: Annotated[
        str,
        Field(
            description='Repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'
        ),
    ]
    state: Annotated[
        State,
        Field(
            description='Filter by PR state. Use "closed" to see merged PRs, "open" for in-progress, or "all" for both.'
        ),
    ]
    since: Annotated[
        ListGitHubPullRequestsToolInputSince | None,
        Field(
            description='Start date in YYYY-MM-DD format (e.g., "2024-01-15"). Only PRs updated on or after this date (starting at 00:00:00) are included. Use null for no start filter.',
            title="ListGitHubPullRequestsToolInputSince",
        ),
    ]
    until: Annotated[
        ListGitHubPullRequestsToolInputUntil | None,
        Field(
            description='End date in YYYY-MM-DD format (e.g., "2024-01-15"). Only PRs updated on or before this date (ending at 23:59:59) are included. Use null for no end filter.',
            title="ListGitHubPullRequestsToolInputUntil",
        ),
    ]
    per_page: Annotated[
        ListGitHubPullRequestsToolInputPerPage,
        Field(
            alias="perPage",
            description="Number of results to return (default: 20, max: 100)",
            title="ListGitHubPullRequestsToolInputPerPage",
        ),
    ]
    page: Annotated[
        ListGitHubPullRequestsToolInputPage | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional PRs if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            title="ListGitHubPullRequestsToolInputPage",
        ),
    ]


class ListGitHubPullRequestsInput(RootModel[ListGitHubPullRequestsToolInput]):
    root: ListGitHubPullRequestsToolInput


class ListGitHubPullRequestsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    repository: str
    time_window: Annotated[str, Field(alias="timeWindow")]
    summary: GitHubPullRequestListSummary
    pagination: GitHubPagination
    pull_requests: Annotated[list[GitHubPullRequestSummary], Field(alias="pullRequests")]
    message: str


class ListLaunchDarklyFlagsToolInputSummary(RootModel[bool]):
    root: Annotated[
        bool,
        Field(
            description="If true, return only flag key, name, and on/off state per environment. If false, return full flag details.",
            title="ListLaunchDarklyFlagsToolInputSummary",
        ),
    ] = True


class ListLaunchDarklyFlagsToolInputFilter(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional: Filter flags by name/key containing this text.",
            title="ListLaunchDarklyFlagsToolInputFilter",
        ),
    ]


class ListLaunchDarklyFlagsToolInputTags(RootModel[list[str] | None]):
    root: Annotated[
        list[str] | None,
        Field(
            description="Optional: Filter flags by tags.",
            title="ListLaunchDarklyFlagsToolInputTags",
        ),
    ]


class ListLaunchDarklyFlagsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the LaunchDarkly skill to use.",
        ),
    ]
    project_key: Annotated[str, Field(alias="projectKey", description="The LaunchDarkly project key.")]
    environment_keys: Annotated[
        list[str],
        Field(alias="environmentKeys", description="Array of environment keys to query."),
    ]
    summary: Annotated[
        ListLaunchDarklyFlagsToolInputSummary,
        Field(
            description="If true, return only flag key, name, and on/off state per environment. If false, return full flag details.",
            title="ListLaunchDarklyFlagsToolInputSummary",
            validate_default=True,
        ),
    ]
    filter: Annotated[
        ListLaunchDarklyFlagsToolInputFilter | None,
        Field(
            description="Optional: Filter flags by name/key containing this text.",
            title="ListLaunchDarklyFlagsToolInputFilter",
        ),
    ] = None
    tags: Annotated[
        ListLaunchDarklyFlagsToolInputTags | None,
        Field(
            description="Optional: Filter flags by tags.",
            title="ListLaunchDarklyFlagsToolInputTags",
        ),
    ] = None


class ListLaunchDarklyFlagsInput(RootModel[ListLaunchDarklyFlagsToolInput]):
    root: ListLaunchDarklyFlagsToolInput


class ListLaunchDarklyFlagsToolOutputTotalFlags(RootModel[int]):
    root: Annotated[int, Field(title="ListLaunchDarklyFlagsToolOutputTotalFlags")]


class ListLaunchDarklyFlagsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    project_key: Annotated[str, Field(alias="projectKey")]
    total_flags: Annotated[
        ListLaunchDarklyFlagsToolOutputTotalFlags,
        Field(alias="totalFlags", title="ListLaunchDarklyFlagsToolOutputTotalFlags"),
    ]
    flags: list[LaunchDarklyFlagSummary]
    flags_link: Annotated[str, Field(alias="flagsLink")]
    message: str


class ListRumEventsToolInputQuery(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Datadog RUM search query to filter events (e.g., @type:view)",
            title="ListRumEventsToolInputQuery",
        ),
    ]


class ListRumEventsToolInputFrom(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Minimum timestamp (ISO8601 only, e.g., "2020-09-17T11:48:36+01:00")',
            title="ListRumEventsToolInputFrom",
        ),
    ]


class ListRumEventsToolInputTo(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Maximum timestamp (ISO8601 only). Defaults to now if not provided.",
            title="ListRumEventsToolInputTo",
        ),
    ]


class ListRumEventsToolInputLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of RUM events to return (default: 25, max: 1000)",
            title="ListRumEventsToolInputLimit",
        ),
    ] = 25


class ListRumEventsToolInputPageCursor(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Pagination cursor from previous response",
            title="ListRumEventsToolInputPageCursor",
        ),
    ]


class ListRumEventsToolInputSort(StrEnum):
    timestamp = "timestamp"
    field_timestamp = "-timestamp"


class ListRumEventsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Datadog skill to use.",
        ),
    ]
    query: Annotated[
        ListRumEventsToolInputQuery | None,
        Field(
            description="Datadog RUM search query to filter events (e.g., @type:view)",
            title="ListRumEventsToolInputQuery",
        ),
    ] = None
    from_: Annotated[
        ListRumEventsToolInputFrom | None,
        Field(
            alias="from",
            description='Minimum timestamp (ISO8601 only, e.g., "2020-09-17T11:48:36+01:00")',
            title="ListRumEventsToolInputFrom",
        ),
    ] = None
    to: Annotated[
        ListRumEventsToolInputTo | None,
        Field(
            description="Maximum timestamp (ISO8601 only). Defaults to now if not provided.",
            title="ListRumEventsToolInputTo",
        ),
    ] = None
    limit: Annotated[
        ListRumEventsToolInputLimit,
        Field(
            description="Maximum number of RUM events to return (default: 25, max: 1000)",
            title="ListRumEventsToolInputLimit",
            validate_default=True,
        ),
    ]
    page_cursor: Annotated[
        ListRumEventsToolInputPageCursor | None,
        Field(
            alias="pageCursor",
            description="Pagination cursor from previous response",
            title="ListRumEventsToolInputPageCursor",
        ),
    ] = None
    sort: Annotated[
        ListRumEventsToolInputSort,
        Field(
            description='Sort order: "timestamp" (ascending) or "-timestamp" (descending)',
            title="ListRumEventsToolInputSort",
        ),
    ]


class ListRumEventsInput(RootModel[ListRumEventsToolInput]):
    root: ListRumEventsToolInput


class ListRumEventsToolOutputQuery(RootModel[str | None]):
    root: Annotated[str | None, Field(title="ListRumEventsToolOutputQuery")]


class ListRumEventsToolOutputTotalEvents(RootModel[int]):
    root: Annotated[int, Field(title="ListRumEventsToolOutputTotalEvents")]


class ListRumEventsToolOutputWarnings(RootModel[str | None]):
    root: Annotated[str | None, Field(title="ListRumEventsToolOutputWarnings")]


class ListRumEventsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    query: Annotated[ListRumEventsToolOutputQuery | None, Field(title="ListRumEventsToolOutputQuery")]
    total_events: Annotated[
        ListRumEventsToolOutputTotalEvents,
        Field(alias="totalEvents", title="ListRumEventsToolOutputTotalEvents"),
    ]
    events: list[DatadogRumEvent]
    events_by_type: Annotated[dict[str, int], Field(alias="eventsByType")]
    rum_link: Annotated[str, Field(alias="rumLink")]
    pagination: DatadogCursorPagination
    warnings: Annotated[
        ListRumEventsToolOutputWarnings | None,
        Field(title="ListRumEventsToolOutputWarnings"),
    ]
    message: str


class ListWorkOSOrganizationsToolInputLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of organizations to return (default: 20, max: 100).",
            title="ListWorkOSOrganizationsToolInputLimit",
        ),
    ] = 20


class ListWorkOSOrganizationsToolInputAfter(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional pagination cursor. Use the 'after' value from a previous response to get the next page.",
            title="ListWorkOSOrganizationsToolInputAfter",
        ),
    ]


class ListWorkOSOrganizationsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the WorkOS skill to use.",
        ),
    ]
    limit: Annotated[
        ListWorkOSOrganizationsToolInputLimit,
        Field(
            description="Maximum number of organizations to return (default: 20, max: 100).",
            title="ListWorkOSOrganizationsToolInputLimit",
            validate_default=True,
        ),
    ]
    after: Annotated[
        ListWorkOSOrganizationsToolInputAfter | None,
        Field(
            description="Optional pagination cursor. Use the 'after' value from a previous response to get the next page.",
            title="ListWorkOSOrganizationsToolInputAfter",
        ),
    ] = None


class ListWorkOSOrganizationsInput(RootModel[ListWorkOSOrganizationsToolInput]):
    root: ListWorkOSOrganizationsToolInput


class WorkOSPaginationAfter(RootModel[str | None]):
    root: Annotated[str | None, Field(title="WorkOSPaginationAfter")]


class WorkOSPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    has_more: Annotated[bool, Field(alias="hasMore")]
    after: Annotated[WorkOSPaginationAfter | None, Field(title="WorkOSPaginationAfter")] = None


class WorkOSOrganizationSummaryExternalId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="WorkOSOrganizationSummaryExternalId")]


class WorkOSOrganizationSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    external_id: Annotated[
        WorkOSOrganizationSummaryExternalId | None,
        Field(alias="externalId", title="WorkOSOrganizationSummaryExternalId"),
    ] = None
    domains: list[str]
    created_at: Annotated[str, Field(alias="createdAt")]
    updated_at: Annotated[str, Field(alias="updatedAt")]


class ListWorkOSOrganizationsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    organizations: list[WorkOSOrganizationSummary]
    pagination: WorkOSPagination
    message: str


class ListWorkOSUsersToolInputEmail(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional exact email address filter. Omit or pass null to list all users.",
            title="ListWorkOSUsersToolInputEmail",
        ),
    ]


class ListWorkOSUsersToolInputOrganizationId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional WorkOS organization ID filter. Omit or pass null for all organizations.",
            title="ListWorkOSUsersToolInputOrganizationId",
        ),
    ]


class ListWorkOSUsersToolInputLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of users to return (default: 20, max: 100).",
            title="ListWorkOSUsersToolInputLimit",
        ),
    ] = 20


class ListWorkOSUsersToolInputAfter(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional pagination cursor. Use the 'after' value from a previous response to get the next page.",
            title="ListWorkOSUsersToolInputAfter",
        ),
    ]


class ListWorkOSUsersToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the WorkOS skill to use.",
        ),
    ]
    email: Annotated[
        ListWorkOSUsersToolInputEmail | None,
        Field(
            description="Optional exact email address filter. Omit or pass null to list all users.",
            title="ListWorkOSUsersToolInputEmail",
        ),
    ] = None
    organization_id: Annotated[
        ListWorkOSUsersToolInputOrganizationId | None,
        Field(
            alias="organizationId",
            description="Optional WorkOS organization ID filter. Omit or pass null for all organizations.",
            title="ListWorkOSUsersToolInputOrganizationId",
        ),
    ] = None
    limit: Annotated[
        ListWorkOSUsersToolInputLimit,
        Field(
            description="Maximum number of users to return (default: 20, max: 100).",
            title="ListWorkOSUsersToolInputLimit",
            validate_default=True,
        ),
    ]
    after: Annotated[
        ListWorkOSUsersToolInputAfter | None,
        Field(
            description="Optional pagination cursor. Use the 'after' value from a previous response to get the next page.",
            title="ListWorkOSUsersToolInputAfter",
        ),
    ] = None


class ListWorkOSUsersInput(RootModel[ListWorkOSUsersToolInput]):
    root: ListWorkOSUsersToolInput


class ListWorkOSUsersToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    users: list[WorkOSUserSummary]
    pagination: WorkOSPagination
    message: str


class LogoParams(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    organization_id: Annotated[str, Field(alias="organizationId")]


class LogoUploadUrlQuery(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    content_type: Annotated[str, Field(alias="contentType")]


class ManualTriggerParams(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    input_id: Annotated[str, Field(alias="inputId")]


class ManualTriggerRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    context: str | None = None


class ModelEventChatSnippet(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["Snippet"] = "Snippet"
    timestamp: float
    snippet: ChatSnippet


class Thinking(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    step_id: str
    type: Literal["Thinking"] = "Thinking"
    timestamp: float


class UserMessage(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["UserMessage"] = "UserMessage"
    message: str
    step_id: str
    client_turn_id: str
    timestamp: float


class NaturalStop(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    step_id: str
    type: Literal["NaturalStop"] = "NaturalStop"
    timestamp: float


class RunError(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["RunError"] = "RunError"
    error: str
    code: str | None = None
    timestamp: float


class TextDelta(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    delta: str
    step_id: str
    type: Literal["TextDelta"] = "TextDelta"
    timestamp: float


class SharedErrorContext(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    error: Any


class ToolCallExecutionStatus(StrEnum):
    completed = "completed"
    incomplete = "incomplete"
    failed = "failed"
    unknown = "unknown"


class ToolCallComplete(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    tool_name: str
    timestamp: float
    status: ToolCallExecutionStatus
    step_id: str
    type: Literal["ToolCallComplete"] = "ToolCallComplete"
    changed_items: list[ChangedItem]
    integration: str
    url: str | None = None
    result: str | None = None
    error_context: Annotated[SharedErrorContext | None, Field(alias="errorContext")] = None


class ToolCall(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    summary: str
    step_id: str
    type: Literal["ToolCall"] = "ToolCall"
    parameters: str
    integration: str
    timestamp: float


class ToolCallGenerating(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    tool_name: str
    step_id: str
    type: Literal["ToolCallGenerating"] = "ToolCallGenerating"
    timestamp: float


class ToolApprovalRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    step_id: str
    type: Literal["ToolApprovalRequest"] = "ToolApprovalRequest"
    name: str
    arguments: str
    timestamp: float


class ToolApprovalResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    step_id: str
    type: Literal["ToolApprovalResponse"] = "ToolApprovalResponse"
    approved: bool
    rejection_reason: str | None = None
    timestamp: float


class ModelEvent(
    RootModel[
        ToolApprovalResponse
        | ToolApprovalRequest
        | ToolCallGenerating
        | ToolCall
        | ToolCallComplete
        | TextDelta
        | RunError
        | Cancelled
        | NaturalStop
        | FilterResult
        | UserMessage
        | Thinking
        | ModelEventChatSnippet
    ]
):
    root: (
        ToolApprovalResponse
        | ToolApprovalRequest
        | ToolCallGenerating
        | ToolCall
        | ToolCallComplete
        | TextDelta
        | RunError
        | Cancelled
        | NaturalStop
        | FilterResult
        | UserMessage
        | Thinking
        | ModelEventChatSnippet
    )


class SendModelRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["SendModelRequest"] = "SendModelRequest"
    user_message: str
    timezone: str
    ui_state: str | None = None
    client_turn_id: str
    template_id: str | None = None


class ModelRequest(RootModel[SendModelRequest | ToolApprovalResponse]):
    root: SendModelRequest | ToolApprovalResponse


class NotionCreateOrUpdateDatabaseRowToolInputPageId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="The ID of the row to update (from notion_query_database). MUST be null to create a new row. Provide a valid page ID to update an existing row.",
            title="NotionCreateOrUpdateDatabaseRowToolInputPageId",
        ),
    ]


class NotionCreateOrUpdateDatabaseRowToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Notion workspace to use.",
        ),
    ]
    database_id: Annotated[
        str,
        Field(alias="databaseId", description="The Notion database ID (data source ID)."),
    ]
    page_id: Annotated[
        NotionCreateOrUpdateDatabaseRowToolInputPageId | None,
        Field(
            description="The ID of the row to update (from notion_query_database). MUST be null to create a new row. Provide a valid page ID to update an existing row.",
            title="NotionCreateOrUpdateDatabaseRowToolInputPageId",
        ),
    ]
    properties_json: Annotated[
        str,
        Field(
            description='JSON string with property names and Notion-formatted values. Example: "{\\"Name\\": {\\"title\\": [{\\"text\\": {\\"content\\": \\"New Item\\"}}]}, \\"Status\\": {\\"select\\": {\\"name\\": \\"In Progress\\"}}}"'
        ),
    ]


class NotionCreateOrUpdateDatabaseRowInput(RootModel[NotionCreateOrUpdateDatabaseRowToolInput]):
    root: NotionCreateOrUpdateDatabaseRowToolInput


class Action1(StrEnum):
    created = "created"
    updated = "updated"


class NotionDatabaseRowMutationResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    action: Action1
    page_id: str
    url: str | None = None


class NotionCreateOrUpdateDatabaseRowToolOutput(RootModel[NotionDatabaseRowMutationResult]):
    root: NotionDatabaseRowMutationResult


class NotionCreateOrUpdatePageToolInputPageId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="ID of an existing page to update. Omit or null to create a new subpage under parentPageId.",
            title="NotionCreateOrUpdatePageToolInputPageId",
        ),
    ]


class NotionCreateOrUpdatePageToolInputParentPageId(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Required for create: the allowed page ID under which to create the new subpage (from the Notion config list). Ignored when page_id is provided for update.",
            title="NotionCreateOrUpdatePageToolInputParentPageId",
        ),
    ]


class NotionCreateOrUpdatePageToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Notion workspace to use.",
        ),
    ]
    page_id: Annotated[
        NotionCreateOrUpdatePageToolInputPageId | None,
        Field(
            description="ID of an existing page to update. Omit or null to create a new subpage under parentPageId.",
            title="NotionCreateOrUpdatePageToolInputPageId",
        ),
    ] = None
    parent_page_id: Annotated[
        NotionCreateOrUpdatePageToolInputParentPageId | None,
        Field(
            alias="parentPageId",
            description="Required for create: the allowed page ID under which to create the new subpage (from the Notion config list). Ignored when page_id is provided for update.",
            title="NotionCreateOrUpdatePageToolInputParentPageId",
        ),
    ] = None
    title: Annotated[str, Field(description="The page title (used for both create and update).")]


class NotionCreateOrUpdatePageInput(RootModel[NotionCreateOrUpdatePageToolInput]):
    root: NotionCreateOrUpdatePageToolInput


class NotionCreateOrUpdatePageToolOutput(NotionCreateOrUpdateDatabaseRowToolOutput):
    pass


class NotionPageParent(RootModel[dict[str, Any]]):
    root: dict[str, Any]


class NotionFileReference(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    type: str
    file: str | None = None
    external: str | None = None


class NotionUserReference(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str | None = None
    object: str | None = None


class NotionDateReferenceEnd(RootModel[str | None]):
    root: Annotated[str | None, Field(title="NotionDateReferenceEnd")]


class NotionDateReferenceTimeZone(RootModel[str | None]):
    root: Annotated[str | None, Field(title="NotionDateReferenceTimeZone")]


class NotionDateReference(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    start: str | None = None
    end: Annotated[NotionDateReferenceEnd | None, Field(title="NotionDateReferenceEnd")] = None
    time_zone: Annotated[NotionDateReferenceTimeZone | None, Field(title="NotionDateReferenceTimeZone")] = None


class NotionReadablePropertyValue(
    RootModel[
        str
        | float
        | bool
        | list[str]
        | NotionDateReference
        | NotionUserReference
        | list[NotionUserReference]
        | list[NotionFileReference]
        | NotionPageParent
        | None
    ]
):
    root: (
        str
        | float
        | bool
        | list[str]
        | NotionDateReference
        | NotionUserReference
        | list[NotionUserReference]
        | list[NotionFileReference]
        | NotionPageParent
        | None
    )


class NotionDatabaseQueryPage(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    page_id: str
    properties: dict[str, NotionReadablePropertyValue | None]
    url: str | None = None
    created_time: str | None = None
    last_edited_time: str | None = None


class NotionFetchRelatedEventsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Notion workspace to use.",
        ),
    ]
    page_id: Annotated[
        str,
        Field(
            alias="pageId",
            description="The Notion page ID (not used directly, but required for consistency).",
        ),
    ]
    block_id: Annotated[str, Field(description="The Notion block ID to fetch related events for")]


class NotionFetchRelatedEventsInput(RootModel[NotionFetchRelatedEventsToolInput]):
    root: NotionFetchRelatedEventsToolInput


class NotionFetchRelatedEventsToolOutputEventsCount(RootModel[int]):
    root: Annotated[int, Field(title="NotionFetchRelatedEventsToolOutputEventsCount")]


class NotionFetchRelatedEventsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    events_count: Annotated[
        NotionFetchRelatedEventsToolOutputEventsCount,
        Field(title="NotionFetchRelatedEventsToolOutputEventsCount"),
    ]
    events: str | None = None
    message: str


class NotionGetSchemaToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Notion workspace to use.",
        ),
    ]
    database_id: Annotated[
        str,
        Field(
            alias="databaseId",
            description="The Notion database ID (data source ID) to get the schema for.",
        ),
    ]


class NotionGetSchemaInput(RootModel[NotionGetSchemaToolInput]):
    root: NotionGetSchemaToolInput


class NotionSchemaProperty(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: str
    id: str
    options: list[str] | None = None
    format_example: str | None = None


class NotionGetSchemaToolOutputPropertyCount(RootModel[int]):
    root: Annotated[int, Field(title="NotionGetSchemaToolOutputPropertyCount")]


class NotionGetSchemaToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    data_source_id: str
    database_name: str
    schema_: Annotated[dict[str, NotionSchemaProperty], Field(alias="schema")]
    property_count: Annotated[
        NotionGetSchemaToolOutputPropertyCount,
        Field(title="NotionGetSchemaToolOutputPropertyCount"),
    ]


class NotionListUsersToolInputQuery(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional search query to filter users by name. Case-insensitive partial match.",
            title="NotionListUsersToolInputQuery",
        ),
    ]


class NotionListUsersToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Notion workspace to use.",
        ),
    ]
    query: Annotated[
        NotionListUsersToolInputQuery | None,
        Field(
            description="Optional search query to filter users by name. Case-insensitive partial match.",
            title="NotionListUsersToolInputQuery",
        ),
    ] = None


class NotionListUsersInput(RootModel[NotionListUsersToolInput]):
    root: NotionListUsersToolInput


class NotionWorkspaceUser(JiraIssueAssignee):
    pass


class NotionListUsersToolOutputCount(RootModel[int]):
    root: Annotated[int, Field(title="NotionListUsersToolOutputCount")]


class NotionListUsersToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    users: list[NotionWorkspaceUser]
    count: Annotated[NotionListUsersToolOutputCount, Field(title="NotionListUsersToolOutputCount")]


class NotionLooseObject(RootModel[NotionPageParent]):
    root: NotionPageParent


class NotionModifyBlocksAppendResultBlocksCount(RootModel[int]):
    root: Annotated[int, Field(title="NotionModifyBlocksAppendResultBlocksCount")]


class NotionModifyBlocksAppendResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    operation: Literal["append"] = "append"
    actions: list[RunHistoryAction]
    block_ids: list[str]
    blocks_count: Annotated[
        NotionModifyBlocksAppendResultBlocksCount,
        Field(title="NotionModifyBlocksAppendResultBlocksCount"),
    ]


class NotionModifyBlocksAppendSuccessBlocksCount(RootModel[int]):
    root: Annotated[int, Field(title="NotionModifyBlocksAppendSuccessBlocksCount")]


class NotionModifyBlocksAppendSuccess(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    operation: Literal["append"] = "append"
    block_ids: list[str]
    blocks_count: Annotated[
        NotionModifyBlocksAppendSuccessBlocksCount,
        Field(title="NotionModifyBlocksAppendSuccessBlocksCount"),
    ]


class NotionModifyBlocksDeleteResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    operation: Literal["delete"] = "delete"
    actions: list[RunHistoryAction]
    block_id: str


class NotionModifyBlocksUpdateResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    operation: Literal["update"] = "update"
    actions: list[RunHistoryAction]
    block_id: str


class NotionModifyBlocksOperationResult(
    RootModel[NotionModifyBlocksAppendResult | NotionModifyBlocksUpdateResult | NotionModifyBlocksDeleteResult]
):
    root: NotionModifyBlocksAppendResult | NotionModifyBlocksUpdateResult | NotionModifyBlocksDeleteResult


class NotionModifyBlocksBatchSuccessTotalOperations(RootModel[int]):
    root: Annotated[int, Field(title="NotionModifyBlocksBatchSuccessTotalOperations")]


class NotionModifyBlocksBatchSuccess(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    operations: list[NotionModifyBlocksOperationResult]
    block_ids: list[str]
    total_operations: Annotated[
        NotionModifyBlocksBatchSuccessTotalOperations,
        Field(title="NotionModifyBlocksBatchSuccessTotalOperations"),
    ]


class NotionModifyBlocksFailureFailedAtIndex(RootModel[int]):
    root: Annotated[int, Field(title="NotionModifyBlocksFailureFailedAtIndex")]


class NotionModifyBlocksFailureTotalOperations(RootModel[int]):
    root: Annotated[int, Field(title="NotionModifyBlocksFailureTotalOperations")]


class NotionModifyBlocksFailure(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[False] = False
    actions: list[RunHistoryAction] | None = None
    error: str
    block_ids: list[str]
    operations: list[NotionModifyBlocksOperationResult] | None = None
    failed_at_index: Annotated[
        NotionModifyBlocksFailureFailedAtIndex | None,
        Field(title="NotionModifyBlocksFailureFailedAtIndex"),
    ] = None
    total_operations: Annotated[
        NotionModifyBlocksFailureTotalOperations | None,
        Field(title="NotionModifyBlocksFailureTotalOperations"),
    ] = None
    hint: str | None = None
    retry_instructions: str | None = None


class NotionModifyBlocksToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Notion workspace to use.",
        ),
    ]
    page_id: Annotated[str, Field(alias="pageId", description="The Notion page ID to modify.")]
    operation_json: Annotated[
        str,
        Field(
            description='JSON string: a single operation object OR an array of operation objects (executed in order).\nEach operation: operation ("append"|"update"|"delete"); for append: blocks (array), optional parent_block_id, optional after_block_id; for update: block_id, block; for delete: block_id.\nAppend with after_block_id inserts after that block; omit for end of page/parent.'
        ),
    ]


class NotionModifyBlocksInput(RootModel[NotionModifyBlocksToolInput]):
    root: NotionModifyBlocksToolInput


class Operation(StrEnum):
    update = "update"
    delete = "delete"


class NotionModifyBlocksSingleBlockSuccess(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    operation: Operation
    block_id: str


class NotionModifyBlocksSuccess(
    RootModel[NotionModifyBlocksAppendSuccess | NotionModifyBlocksSingleBlockSuccess | NotionModifyBlocksBatchSuccess]
):
    root: NotionModifyBlocksAppendSuccess | NotionModifyBlocksSingleBlockSuccess | NotionModifyBlocksBatchSuccess


class NotionModifyBlocksToolOutput(RootModel[NotionModifyBlocksSuccess | NotionModifyBlocksFailure]):
    root: NotionModifyBlocksSuccess | NotionModifyBlocksFailure


class NotionPageBlockTableWidth(RootModel[int]):
    root: Annotated[int, Field(title="NotionPageBlockTableWidth")]


class NotionPageBlock(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    type: str
    object: str
    created_time: str | None = None
    last_edited_time: str | None = None
    created_by: NotionUserReference | None = None
    last_edited_by: NotionUserReference | None = None
    has_children: bool | None = None
    archived: bool | None = None
    content: str | None = None
    rich_text: list[NotionPageParent] | None = None
    checked: bool | None = None
    language: str | None = None
    icon: NotionPageParent | None = None
    table_width: Annotated[NotionPageBlockTableWidth | None, Field(title="NotionPageBlockTableWidth")] = None
    has_column_header: bool | None = None
    has_row_header: bool | None = None
    caption: str | None = None
    file: str | None = None
    external: str | None = None
    url: str | None = None
    page_id: str | None = None
    database_id: str | None = None
    children: list[NotionPageBlock] | None = None


class NotionPageQueryMetadataPublicUrl(RootModel[str | None]):
    root: Annotated[str | None, Field(title="NotionPageQueryMetadataPublicUrl")]


class NotionPageQueryMetadataIcon(RootModel[NotionPageParent | None]):
    root: Annotated[NotionPageParent | None, Field(title="NotionPageQueryMetadataIcon")]


class NotionPageQueryMetadataCover(RootModel[NotionPageParent | None]):
    root: Annotated[NotionPageParent | None, Field(title="NotionPageQueryMetadataCover")]


class NotionPageQueryMetadata(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    page_id: str
    object: str
    url: str | None = None
    public_url: Annotated[
        NotionPageQueryMetadataPublicUrl | None,
        Field(title="NotionPageQueryMetadataPublicUrl"),
    ] = None
    created_time: str | None = None
    last_edited_time: str | None = None
    archived: bool | None = None
    icon: Annotated[NotionPageQueryMetadataIcon | None, Field(title="NotionPageQueryMetadataIcon")] = None
    cover: Annotated[NotionPageQueryMetadataCover | None, Field(title="NotionPageQueryMetadataCover")] = None
    parent: NotionPageParent | None = None
    created_by: NotionUserReference | None = None
    last_edited_by: NotionUserReference | None = None
    in_trash: bool | None = None


class NotionQueryDatabaseFailure(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[False] = False
    actions: list[RunHistoryAction] | None = None
    pages: list[NotionDatabaseQueryPage]
    total_returned: Literal[0] = 0
    has_more: Literal[False] = False
    next_cursor: None
    error: str
    hint: str


class NotionQueryDatabaseToolInputFilterProperties(RootModel[list[str] | None]):
    root: Annotated[
        list[str] | None,
        Field(
            description="Array of property names or IDs to include in results. Only these properties will be returned, improving performance. Use property names from the database schema.",
            title="NotionQueryDatabaseToolInputFilterProperties",
        ),
    ]


class NotionQueryDatabaseToolInputFilter(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='JSON string with filter object to query pages matching specific criteria. Supports complex filtering with AND/OR logic, property filters, and timestamp filters.\n\nBASIC STRUCTURE:\n- Property filter: { "property": "Property Name", "type": { "condition": value } }\n- Timestamp filter: { "timestamp": "created_time" | "last_edited_time", "created_time" | "last_edited_time": { "condition": value } }\n- Compound filter: { "and": [...] } or { "or": [...] } to combine multiple filters (nesting supported up to 2 levels)\n\nPROPERTY FILTER TYPES AND CONDITIONS:\n\n1. CHECKBOX: { "property": "Name", "checkbox": { "equals": true|false } | { "does_not_equal": true|false } }\n\n2. DATE: { "property": "Name", "date": { \n"after": "2021-05-10" | "2021-05-10T12:00:00" | "2021-10-15T12:00:00-07:00",\n"before": "2021-05-10",\n"equals": "2021-05-10",\n"on_or_after": "2021-05-10",\n"on_or_before": "2021-05-10",\n"is_empty": true,\n"is_not_empty": true,\n"past_week": {},\n"past_month": {},\n"past_year": {},\n"next_week": {},\n"next_month": {},\n"next_year": {},\n"this_week": {}\n} }\n\n3. FILES: { "property": "Name", "files": { "is_empty": true } | { "is_not_empty": true } }\n\n4. FORMULA: { "property": "Name", "formula": { \n"checkbox": { checkbox conditions },\n"date": { date conditions },\n"number": { number conditions },\n"string": { rich_text conditions }\n} }\n\n5. MULTI_SELECT: { "property": "Name", "multi_select": { \n"contains": "Value",\n"does_not_contain": "Value",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n6. NUMBER: { "property": "Name", "number": { \n"equals": 42,\n"does_not_equal": 42,\n"greater_than": 42,\n"less_than": 42,\n"greater_than_or_equal_to": 42,\n"less_than_or_equal_to": 42,\n"is_empty": true,\n"is_not_empty": true\n} }\n\n7. PEOPLE (also for created_by, last_edited_by): { "property": "Name", "people": { \n"contains": "uuid-v4",\n"does_not_contain": "uuid-v4",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n8. RELATION: { "property": "Name", "relation": { \n"contains": "uuid-v4",\n"does_not_contain": "uuid-v4",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n9. RICH_TEXT (also title): { "property": "Name", "rich_text": { \n"contains": "string",\n"does_not_contain": "string",\n"does_not_equal": "string",\n"ends_with": "string",\n"equals": "string",\n"is_empty": true,\n"is_not_empty": true,\n"starts_with": "string"\n} }\n\n10. ROLLUP: { "property": "Name", "rollup": { \n"any": { filter condition },\n"every": { filter condition },\n"none": { filter condition },\n"date": { date conditions },\n"number": { number conditions }\n} }\n\n11. SELECT: { "property": "Name", "select": { \n"equals": "Value",\n"does_not_equal": "Value",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n12. STATUS: { "property": "Name", "status": { \n"equals": "Value",\n"does_not_equal": "Value",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n13. TIMESTAMP: { "timestamp": "created_time" | "last_edited_time", "created_time" | "last_edited_time": { \nsame conditions as DATE filter (after, before, equals, on_or_after, on_or_before, is_empty, is_not_empty, past_week, past_month, past_year, next_week, next_month, next_year, this_week)\n} }\nNOTE: Do NOT include "property" field for timestamp filters.\n\n14. VERIFICATION: { "property": "Name", "verification": { "status": "verified" | "expired" | "none" } }\n\n15. UNIQUE_ID: { "property": "Name", "unique_id": { \n"equals": 42,\n"does_not_equal": 42,\n"greater_than": 42,\n"less_than": 42,\n"greater_than_or_equal_to": 42,\n"less_than_or_equal_to": 42\n} }\n\nCOMPOUND FILTERS:\n- AND: { "and": [filter1, filter2, ...] } - all conditions must match\n- OR: { "or": [filter1, filter2, ...] } - any condition can match\n- Nesting: Can nest AND/OR up to 2 levels deep\n\nEXAMPLES:\n- Simple: "{\\"property\\": \\"Task completed\\", \\"checkbox\\": {\\"equals\\": true}}"\n- Compound: "{\\"and\\": [{\\"property\\": \\"Done\\", \\"checkbox\\": {\\"equals\\": true}}, {\\"or\\": [{\\"property\\": \\"Tags\\", \\"multi_select\\": {\\"contains\\": \\"A\\"}}, {\\"property\\": \\"Tags\\", \\"multi_select\\": {\\"contains\\": \\"B\\"}}]}]}"\n- Timestamp: "{\\"timestamp\\": \\"created_time\\", \\"created_time\\": {\\"on_or_after\\": \\"2023-02-08\\"}}"',
            title="NotionQueryDatabaseToolInputFilter",
        ),
    ]


class NotionQueryDatabaseToolInputPageSize1(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Number of results per page (1-100). Default returns all results. Use pagination for large databases.",
            ge=1,
            le=100,
            title="NotionQueryDatabaseToolInputPageSize",
        ),
    ]


class NotionQueryDatabaseToolInputPageSize(RootModel[NotionQueryDatabaseToolInputPageSize1 | None]):
    root: Annotated[
        NotionQueryDatabaseToolInputPageSize1 | None,
        Field(
            description="Number of results per page (1-100). Default returns all results. Use pagination for large databases.",
            title="NotionQueryDatabaseToolInputPageSize",
        ),
    ]


class NotionQueryDatabaseToolInputStartCursor(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Cursor from previous response to fetch next page. Use next_cursor from response when has_more is true.",
            title="NotionQueryDatabaseToolInputStartCursor",
        ),
    ]


class NotionQueryDatabaseToolInputResultType1(StrEnum):
    page = "page"
    data_source = "data_source"


class NotionQueryDatabaseToolInputResultType(RootModel[NotionQueryDatabaseToolInputResultType1 | None]):
    root: Annotated[
        NotionQueryDatabaseToolInputResultType1 | None,
        Field(
            description="Filter results to only pages or data sources. Only relevant for wiki databases.",
            title="NotionQueryDatabaseToolInputResultType",
        ),
    ]


class NotionQueryDatabaseToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Notion workspace to use.",
        ),
    ]
    database_id: Annotated[
        str,
        Field(
            alias="databaseId",
            description="The Notion database ID (data source ID) to query.",
        ),
    ]
    filter_properties: Annotated[
        NotionQueryDatabaseToolInputFilterProperties | None,
        Field(
            description="Array of property names or IDs to include in results. Only these properties will be returned, improving performance. Use property names from the database schema.",
            title="NotionQueryDatabaseToolInputFilterProperties",
        ),
    ] = None
    filter: Annotated[
        NotionQueryDatabaseToolInputFilter | None,
        Field(
            description='JSON string with filter object to query pages matching specific criteria. Supports complex filtering with AND/OR logic, property filters, and timestamp filters.\n\nBASIC STRUCTURE:\n- Property filter: { "property": "Property Name", "type": { "condition": value } }\n- Timestamp filter: { "timestamp": "created_time" | "last_edited_time", "created_time" | "last_edited_time": { "condition": value } }\n- Compound filter: { "and": [...] } or { "or": [...] } to combine multiple filters (nesting supported up to 2 levels)\n\nPROPERTY FILTER TYPES AND CONDITIONS:\n\n1. CHECKBOX: { "property": "Name", "checkbox": { "equals": true|false } | { "does_not_equal": true|false } }\n\n2. DATE: { "property": "Name", "date": { \n"after": "2021-05-10" | "2021-05-10T12:00:00" | "2021-10-15T12:00:00-07:00",\n"before": "2021-05-10",\n"equals": "2021-05-10",\n"on_or_after": "2021-05-10",\n"on_or_before": "2021-05-10",\n"is_empty": true,\n"is_not_empty": true,\n"past_week": {},\n"past_month": {},\n"past_year": {},\n"next_week": {},\n"next_month": {},\n"next_year": {},\n"this_week": {}\n} }\n\n3. FILES: { "property": "Name", "files": { "is_empty": true } | { "is_not_empty": true } }\n\n4. FORMULA: { "property": "Name", "formula": { \n"checkbox": { checkbox conditions },\n"date": { date conditions },\n"number": { number conditions },\n"string": { rich_text conditions }\n} }\n\n5. MULTI_SELECT: { "property": "Name", "multi_select": { \n"contains": "Value",\n"does_not_contain": "Value",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n6. NUMBER: { "property": "Name", "number": { \n"equals": 42,\n"does_not_equal": 42,\n"greater_than": 42,\n"less_than": 42,\n"greater_than_or_equal_to": 42,\n"less_than_or_equal_to": 42,\n"is_empty": true,\n"is_not_empty": true\n} }\n\n7. PEOPLE (also for created_by, last_edited_by): { "property": "Name", "people": { \n"contains": "uuid-v4",\n"does_not_contain": "uuid-v4",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n8. RELATION: { "property": "Name", "relation": { \n"contains": "uuid-v4",\n"does_not_contain": "uuid-v4",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n9. RICH_TEXT (also title): { "property": "Name", "rich_text": { \n"contains": "string",\n"does_not_contain": "string",\n"does_not_equal": "string",\n"ends_with": "string",\n"equals": "string",\n"is_empty": true,\n"is_not_empty": true,\n"starts_with": "string"\n} }\n\n10. ROLLUP: { "property": "Name", "rollup": { \n"any": { filter condition },\n"every": { filter condition },\n"none": { filter condition },\n"date": { date conditions },\n"number": { number conditions }\n} }\n\n11. SELECT: { "property": "Name", "select": { \n"equals": "Value",\n"does_not_equal": "Value",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n12. STATUS: { "property": "Name", "status": { \n"equals": "Value",\n"does_not_equal": "Value",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n13. TIMESTAMP: { "timestamp": "created_time" | "last_edited_time", "created_time" | "last_edited_time": { \nsame conditions as DATE filter (after, before, equals, on_or_after, on_or_before, is_empty, is_not_empty, past_week, past_month, past_year, next_week, next_month, next_year, this_week)\n} }\nNOTE: Do NOT include "property" field for timestamp filters.\n\n14. VERIFICATION: { "property": "Name", "verification": { "status": "verified" | "expired" | "none" } }\n\n15. UNIQUE_ID: { "property": "Name", "unique_id": { \n"equals": 42,\n"does_not_equal": 42,\n"greater_than": 42,\n"less_than": 42,\n"greater_than_or_equal_to": 42,\n"less_than_or_equal_to": 42\n} }\n\nCOMPOUND FILTERS:\n- AND: { "and": [filter1, filter2, ...] } - all conditions must match\n- OR: { "or": [filter1, filter2, ...] } - any condition can match\n- Nesting: Can nest AND/OR up to 2 levels deep\n\nEXAMPLES:\n- Simple: "{\\"property\\": \\"Task completed\\", \\"checkbox\\": {\\"equals\\": true}}"\n- Compound: "{\\"and\\": [{\\"property\\": \\"Done\\", \\"checkbox\\": {\\"equals\\": true}}, {\\"or\\": [{\\"property\\": \\"Tags\\", \\"multi_select\\": {\\"contains\\": \\"A\\"}}, {\\"property\\": \\"Tags\\", \\"multi_select\\": {\\"contains\\": \\"B\\"}}]}]}"\n- Timestamp: "{\\"timestamp\\": \\"created_time\\", \\"created_time\\": {\\"on_or_after\\": \\"2023-02-08\\"}}"',
            title="NotionQueryDatabaseToolInputFilter",
        ),
    ] = None
    page_size: Annotated[
        NotionQueryDatabaseToolInputPageSize | None,
        Field(
            description="Number of results per page (1-100). Default returns all results. Use pagination for large databases.",
            title="NotionQueryDatabaseToolInputPageSize",
        ),
    ] = None
    start_cursor: Annotated[
        NotionQueryDatabaseToolInputStartCursor | None,
        Field(
            description="Cursor from previous response to fetch next page. Use next_cursor from response when has_more is true.",
            title="NotionQueryDatabaseToolInputStartCursor",
        ),
    ] = None
    result_type: Annotated[
        NotionQueryDatabaseToolInputResultType | None,
        Field(
            description="Filter results to only pages or data sources. Only relevant for wiki databases.",
            title="NotionQueryDatabaseToolInputResultType",
        ),
    ] = None


class NotionQueryDatabaseInput(RootModel[NotionQueryDatabaseToolInput]):
    root: NotionQueryDatabaseToolInput


class NotionQueryDatabaseSuccessTotalReturned(RootModel[int]):
    root: Annotated[int, Field(title="NotionQueryDatabaseSuccessTotalReturned")]


class NotionQueryDatabaseSuccessNextCursor(RootModel[str | None]):
    root: Annotated[str | None, Field(title="NotionQueryDatabaseSuccessNextCursor")]


class NotionQueryDatabaseSuccess(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    pages: list[NotionDatabaseQueryPage]
    total_returned: Annotated[
        NotionQueryDatabaseSuccessTotalReturned,
        Field(title="NotionQueryDatabaseSuccessTotalReturned"),
    ]
    has_more: bool
    next_cursor: Annotated[
        NotionQueryDatabaseSuccessNextCursor | None,
        Field(title="NotionQueryDatabaseSuccessNextCursor"),
    ]


class NotionQueryDatabaseToolOutput(RootModel[NotionQueryDatabaseSuccess | NotionQueryDatabaseFailure]):
    root: NotionQueryDatabaseSuccess | NotionQueryDatabaseFailure


class NotionQueryPageToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Notion workspace to use.",
        ),
    ]
    page_id: Annotated[str, Field(alias="pageId", description="The Notion page ID to query.")]


class NotionQueryPageInput(RootModel[NotionQueryPageToolInput]):
    root: NotionQueryPageToolInput


class NotionQueryPageToolOutputPublicUrl(RootModel[str | None]):
    root: Annotated[str | None, Field(title="NotionQueryPageToolOutputPublicUrl")]


class NotionQueryPageToolOutputIcon(RootModel[NotionPageParent | None]):
    root: Annotated[NotionPageParent | None, Field(title="NotionQueryPageToolOutputIcon")]


class NotionQueryPageToolOutputCover(RootModel[NotionPageParent | None]):
    root: Annotated[NotionPageParent | None, Field(title="NotionQueryPageToolOutputCover")]


class NotionQueryPageToolOutputBlocksCount(RootModel[int]):
    root: Annotated[int, Field(title="NotionQueryPageToolOutputBlocksCount")]


class NotionResourceType(StrEnum):
    database = "database"
    page = "page"


class NotionResource(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    title: str
    url: str
    type: NotionResourceType


class NotionResourcesResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    resources: list[NotionResource]


class OauthInstallationDetails(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    oauth_url: Annotated[str, Field(alias="oauthUrl")]


class OrganizationCreateRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    first_name: Annotated[str | None, Field(alias="firstName")] = None
    last_name: Annotated[str | None, Field(alias="lastName")] = None


class OrganizationSwitchRequest(LogoParams):
    pass


class OrganizationUpdateRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str


class PartialSdkAgentRunEventPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[IntegrationTypeEnum | None, Field(alias="integrationType")] = None
    formatted_content: Annotated[str | None, Field(alias="formattedContent")] = None
    debug_log: Annotated[str | None, Field(alias="debugLog")] = None


class PosthogEventCountCount(RootModel[int]):
    root: Annotated[int, Field(title="PosthogEventCountCount")]


class PosthogEventCount(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    event_name: Annotated[str, Field(alias="eventName")]
    count: Annotated[PosthogEventCountCount, Field(title="PosthogEventCountCount")]


class PosthogEventSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    event: str
    timestamp: str | None = None
    distinct_id: Annotated[str | None, Field(alias="distinctId")] = None
    url: str | None = None


class PosthogLogEntry(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    timestamp: str | None = None
    level: str
    message: str
    service: str
    attributes: dict[str, Any]


class PosthogOffsetPaginationLimit(RootModel[int]):
    root: Annotated[int, Field(title="PosthogOffsetPaginationLimit")]


class PosthogOffsetPaginationOffset(RootModel[int]):
    root: Annotated[int, Field(title="PosthogOffsetPaginationOffset")]


class PosthogOffsetPaginationNextOffset(RootModel[int | None]):
    root: Annotated[int | None, Field(title="PosthogOffsetPaginationNextOffset")]


class PosthogOffsetPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    limit: Annotated[PosthogOffsetPaginationLimit, Field(title="PosthogOffsetPaginationLimit")]
    offset: Annotated[PosthogOffsetPaginationOffset, Field(title="PosthogOffsetPaginationOffset")]
    has_more: Annotated[bool, Field(alias="hasMore")]
    next_offset: Annotated[
        PosthogOffsetPaginationNextOffset | None,
        Field(alias="nextOffset", title="PosthogOffsetPaginationNextOffset"),
    ]
    showing: str


class PosthogProject(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    organization_id: str | None = None


class PosthogProjectsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    projects: list[PosthogProject]


class PosthogPropertyFilterOperator(StrEnum):
    exact = "exact"
    is_not = "is_not"
    icontains = "icontains"
    not_icontains = "not_icontains"
    gt = "gt"
    lt = "lt"
    gte = "gte"
    lte = "lte"


class PosthogPropertyFilterValue(RootModel[str | float | bool]):
    root: str | float | bool


class PosthogPropertyFilter(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    key: Annotated[str, Field(description="Property key to filter on")]
    value: Annotated[str | float | bool, Field(description="Property value to match")]
    operator: Annotated[PosthogPropertyFilterOperator, Field(description="Comparison operator")]


class PosthogSearchSessionsPaginationLimit(RootModel[int]):
    root: Annotated[int, Field(title="PosthogSearchSessionsPaginationLimit")]


class PosthogSearchSessionsPaginationOffset(RootModel[int]):
    root: Annotated[int, Field(title="PosthogSearchSessionsPaginationOffset")]


class PosthogSearchSessionsPaginationNextOffset(RootModel[int | None]):
    root: Annotated[int | None, Field(title="PosthogSearchSessionsPaginationNextOffset")]


class PosthogSearchSessionsPaginationPreviousOffset(RootModel[int | None]):
    root: Annotated[int | None, Field(title="PosthogSearchSessionsPaginationPreviousOffset")]


class PosthogSearchSessionsPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    limit: Annotated[
        PosthogSearchSessionsPaginationLimit,
        Field(title="PosthogSearchSessionsPaginationLimit"),
    ]
    offset: Annotated[
        PosthogSearchSessionsPaginationOffset,
        Field(title="PosthogSearchSessionsPaginationOffset"),
    ]
    has_next: Annotated[bool, Field(alias="hasNext")]
    has_previous: Annotated[bool, Field(alias="hasPrevious")]
    next_offset: Annotated[
        PosthogSearchSessionsPaginationNextOffset | None,
        Field(alias="nextOffset", title="PosthogSearchSessionsPaginationNextOffset"),
    ]
    previous_offset: Annotated[
        PosthogSearchSessionsPaginationPreviousOffset | None,
        Field(
            alias="previousOffset",
            title="PosthogSearchSessionsPaginationPreviousOffset",
        ),
    ]


class PosthogSessionSummaryEventsCount(RootModel[int]):
    root: Annotated[int, Field(title="PosthogSessionSummaryEventsCount")]


class PosthogSessionSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    start_time: Annotated[str | None, Field(alias="startTime")] = None
    end_time: Annotated[str | None, Field(alias="endTime")] = None
    duration: float | None = None
    events_count: Annotated[
        PosthogSessionSummaryEventsCount,
        Field(alias="eventsCount", title="PosthogSessionSummaryEventsCount"),
    ]
    session_url: Annotated[str, Field(alias="sessionUrl")]
    person_id: Annotated[str, Field(alias="personId")]
    distinct_id: Annotated[str, Field(alias="distinctId")]


class PosthogSearchSessionsFoundTotalSessions(RootModel[int]):
    root: Annotated[int, Field(title="PosthogSearchSessionsFoundTotalSessions")]


class PosthogSearchSessionsFound(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    user_email: Annotated[str, Field(alias="userEmail")]
    project_id: Annotated[str, Field(alias="projectId")]
    person_found: Annotated[Literal[True], Field(alias="personFound")] = True
    person_id: Annotated[str, Field(alias="personId")]
    distinct_id: Annotated[str, Field(alias="distinctId")]
    total_sessions: Annotated[
        PosthogSearchSessionsFoundTotalSessions,
        Field(alias="totalSessions", title="PosthogSearchSessionsFoundTotalSessions"),
    ]
    sessions: list[PosthogSessionSummary]
    sessions_link: Annotated[str, Field(alias="sessionsLink")]
    pagination: PosthogSearchSessionsPagination
    message: str


class PosthogSearchSessionsNotFound(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    user_email: Annotated[str, Field(alias="userEmail")]
    project_id: Annotated[str, Field(alias="projectId")]
    person_found: Annotated[Literal[False], Field(alias="personFound")] = False
    sessions: Annotated[list[PosthogSessionSummary], Field(max_length=0, min_length=0)]
    total_sessions: Annotated[Literal[0], Field(alias="totalSessions")] = 0
    message: str


class PosthogSeverityLevel(StrEnum):
    error = "error"
    warn = "warn"
    info = "info"
    debug = "debug"


class ReadGitHubFileToolInputStartLine(RootModel[int | None]):
    root: Annotated[
        int | None,
        Field(
            description="Start reading from this line number (1-indexed). Use with endLine for partial file reads. Use null to start from beginning.",
            title="ReadGitHubFileToolInputStartLine",
        ),
    ]


class ReadGitHubFileToolInputEndLine(RootModel[int | None]):
    root: Annotated[
        int | None,
        Field(
            description="Stop reading at this line number (1-indexed, inclusive). Use with startLine for partial file reads. Use null to read to end.",
            title="ReadGitHubFileToolInputEndLine",
        ),
    ]


class ReadGitHubFileToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    repository: Annotated[
        str,
        Field(
            description='The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'
        ),
    ]
    path: Annotated[
        str,
        Field(description='The file path within the repository (e.g., "src/components/Button.tsx" or "README.md")'),
    ]
    start_line: Annotated[
        ReadGitHubFileToolInputStartLine | None,
        Field(
            alias="startLine",
            description="Start reading from this line number (1-indexed). Use with endLine for partial file reads. Use null to start from beginning.",
            title="ReadGitHubFileToolInputStartLine",
        ),
    ] = None
    end_line: Annotated[
        ReadGitHubFileToolInputEndLine | None,
        Field(
            alias="endLine",
            description="Stop reading at this line number (1-indexed, inclusive). Use with startLine for partial file reads. Use null to read to end.",
            title="ReadGitHubFileToolInputEndLine",
        ),
    ] = None


class ReadGitHubFileInput(RootModel[ReadGitHubFileToolInput]):
    root: ReadGitHubFileToolInput


class ReadGitHubFileToolOutputTotalLines(RootModel[int]):
    root: Annotated[int, Field(title="ReadGitHubFileToolOutputTotalLines")]


class ReadGitHubFileToolOutputSize(RootModel[int]):
    root: Annotated[int, Field(title="ReadGitHubFileToolOutputSize")]


class ReadGitHubFileToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    repository: str
    path: str
    url: str
    total_lines: Annotated[
        ReadGitHubFileToolOutputTotalLines,
        Field(alias="totalLines", title="ReadGitHubFileToolOutputTotalLines"),
    ]
    displayed_lines: Annotated[str, Field(alias="displayedLines")]
    size: Annotated[ReadGitHubFileToolOutputSize, Field(title="ReadGitHubFileToolOutputSize")]
    content: str
    warning: str | None = None


class RecentAction(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    action: str
    integration: IntegrationTypeEnum
    target: str
    details: str
    url: str | None = None
    timestamp: str
    agent_name: Annotated[str, Field(alias="agentName")]
    type: RunHistoryActionType


class RecentAgentNotificationSettings(RootModel[AgentNotificationSettings | None]):
    root: Annotated[AgentNotificationSettings | None, Field(title="RecentAgentNotificationSettings")]


class RecentAgentToolApprovals(RootModel[list[str] | None]):
    root: Annotated[list[str] | None, Field(title="RecentAgentToolApprovals")]


class RecentAgentSource(RootModel[AgentSource1 | None]):
    root: Annotated[AgentSource1 | None, Field(title="RecentAgentSource")]


class RecentAgentLastEventProcessedAt(RootModel[str | None]):
    root: Annotated[str | None, Field(title="RecentAgentLastEventProcessedAt")]


class RecentAgent(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    is_active: Annotated[bool, Field(alias="isActive")]
    require_approval: Annotated[bool, Field(alias="requireApproval")]
    prompt: AgentPrompt
    triggers: list[AgentTrigger]
    outputs: list[AgentOutput]
    created_by_user_id: Annotated[str, Field(alias="createdByUserId")]
    notification_settings: Annotated[
        RecentAgentNotificationSettings | None,
        Field(alias="notificationSettings", title="RecentAgentNotificationSettings"),
    ]
    tool_approvals: Annotated[
        RecentAgentToolApprovals | None,
        Field(alias="toolApprovals", title="RecentAgentToolApprovals"),
    ]
    updated_at: Annotated[str, Field(alias="updatedAt")]
    source: Annotated[RecentAgentSource | None, Field(title="RecentAgentSource")]
    last_event_processed_at: Annotated[
        RecentAgentLastEventProcessedAt | None,
        Field(alias="lastEventProcessedAt", title="RecentAgentLastEventProcessedAt"),
    ]


class Role(StrEnum):
    admin = "admin"
    user = "user"


class RunHistoryDecisionAction(StrEnum):
    processed = "processed"
    skipped = "skipped"


class RunHistoryDecision(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    action: RunHistoryDecisionAction
    reasoning: str


class RunHistoryStatus(StrEnum):
    success = "success"
    failed = "failed"
    cancelled = "cancelled"
    skipped = "skipped"
    in_progress = "in_progress"
    awaiting_approval = "awaiting_approval"


class RunHistoryTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    event: str
    integration: IntegrationTypeEnum
    source: str
    title: str | None = None
    subheader: str | None = None
    url: str | None = None


class RunHistoryRecord(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    agent_id: Annotated[str, Field(alias="agentId")]
    timestamp: str
    trigger: RunHistoryTrigger
    filtered: bool
    decision: RunHistoryDecision
    actions: list[RunHistoryAction] | None = None
    status: RunHistoryStatus
    is_manually_triggered: Annotated[bool, Field(alias="isManuallyTriggered")]


class RunHistoryRecordWithAgent(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    agent_id: Annotated[str, Field(alias="agentId")]
    timestamp: str
    trigger: RunHistoryTrigger
    filtered: bool
    decision: RunHistoryDecision
    actions: list[RunHistoryAction] | None = None
    status: RunHistoryStatus
    is_manually_triggered: Annotated[bool, Field(alias="isManuallyTriggered")]
    agent_name: Annotated[str, Field(alias="agentName")]


class RunStarted(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["run_started"] = "run_started"
    run_id: Annotated[str, Field(alias="runId")]


class SandboxStage(StrEnum):
    downloading_source = "downloading_source"
    booting = "booting"
    installing_dependencies = "installing_dependencies"
    installing_cli = "installing_cli"
    running = "running"


class SdkAgentRunEventPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[IntegrationTypeEnum, Field(alias="integrationType")]
    formatted_content: Annotated[str, Field(alias="formattedContent")]
    debug_log: Annotated[str, Field(alias="debugLog")]


class SdkAgentRunNormalizedRequestOptionsMaxTurns(RootModel[int]):
    root: Annotated[int, Field(title="SdkAgentRunNormalizedRequestOptionsMaxTurns")]


class SdkAgentRunNormalizedRequestOptions(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    max_turns: Annotated[
        SdkAgentRunNormalizedRequestOptionsMaxTurns,
        Field(alias="maxTurns", title="SdkAgentRunNormalizedRequestOptionsMaxTurns"),
    ]
    require_approval: Annotated[bool, Field(alias="requireApproval")]


class SdkAgentRunNormalizedRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    prompt: str
    event: SdkAgentRunEventPayload
    skills: list[ConfigData]
    tool_approvals: Annotated[list[str], Field(alias="toolApprovals")]
    options: SdkAgentRunNormalizedRequestOptions


class SdkAgentRunOptionsPayloadMaxTurns(RootModel[int]):
    root: Annotated[int, Field(title="SdkAgentRunOptionsPayloadMaxTurns")]


class SdkAgentRunOptionsPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    max_turns: Annotated[
        SdkAgentRunOptionsPayloadMaxTurns | None,
        Field(alias="maxTurns", title="SdkAgentRunOptionsPayloadMaxTurns"),
    ] = None
    require_approval: Annotated[bool | None, Field(alias="requireApproval")] = None


class SdkAgentRunRequestBody(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    prompt: str | None = None
    event: PartialSdkAgentRunEventPayload | None = None
    skills: list[ConfigData] | None = None
    options: SdkAgentRunOptionsPayload | None = None
    tool_approvals: Annotated[list[str] | None, Field(alias="toolApprovals")] = None


class SdkAgentRunResponseContract(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    response_mode: Annotated[Literal["streaming"], Field(alias="responseMode")] = "streaming"
    supports_interruptions: Annotated[bool, Field(alias="supportsInterruptions")]


class SdkAgentRunResponseBody(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    error: str | None = None
    details: list[str] | None = None
    contract: SdkAgentRunResponseContract | None = None
    normalized_request: Annotated[SdkAgentRunNormalizedRequest | None, Field(alias="normalizedRequest")] = None


class ToolApprovalRequestedPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    step_id: Annotated[str, Field(alias="stepId")]
    tool_name: Annotated[str, Field(alias="toolName")]
    arguments: str


class ToolApprovalRequested(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["tool_approval_requested"] = "tool_approval_requested"
    tool_approval_requested: Annotated[ToolApprovalRequestedPayload, Field(alias="toolApprovalRequested")]


class ToolCallCompleted(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["tool_call_completed"] = "tool_call_completed"
    tool_call_completed: Annotated[str, Field(alias="toolCallCompleted")]


class ToolCallStarted(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["tool_call_started"] = "tool_call_started"
    tool_call_started: Annotated[str, Field(alias="toolCallStarted")]


class ToolCallParams(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["tool_call_params"] = "tool_call_params"
    tool_call_params: Annotated[str, Field(alias="toolCallParams")]


class Text(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["text"] = "text"
    text: str


class SdkAgentStreamEvent(
    RootModel[
        RunStarted
        | Text
        | FinalOutput
        | ToolCallParams
        | ToolCallStarted
        | ToolCallCompleted
        | ToolApprovalRequested
        | Action
        | Error
        | Done
    ]
):
    root: (
        RunStarted
        | Text
        | FinalOutput
        | ToolCallParams
        | ToolCallStarted
        | ToolCallCompleted
        | ToolApprovalRequested
        | Action
        | Error
        | Done
    )


class SdkApprovalDecisionRequestBody(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    run_id: Annotated[str, Field(alias="runId")]
    step_id: Annotated[str, Field(alias="stepId")]
    approved: bool


class SdkDeployJob(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    job_name: Annotated[str, Field(alias="jobName")]
    triggers: list[ConfigData]
    outputs: list[ConfigData]
    tool_approvals: Annotated[list[str], Field(alias="toolApprovals")]
    webhook_url: Annotated[str | None, Field(alias="webhookURL")] = None


class SdkDeployRemoved(JiraIssueTypeRef):
    pass


class SdkDeployRequestBody(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    jobs: list[SdkDeployJob]
    source_zip_base64: Annotated[str, Field(alias="sourceZipBase64")]


class SdkDeployResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    job_name: Annotated[str, Field(alias="jobName")]
    automation_id: Annotated[str, Field(alias="automationId")]
    is_update: Annotated[bool, Field(alias="isUpdate")]


class SdkDeployResponseBody(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    results: list[SdkDeployResult]
    removed: list[SdkDeployRemoved]
    error: str | None = None
    details: str | None = None


class TriggerPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[IntegrationTypeEnum, Field(alias="integrationType")]
    config: ConfigData


class SdkSampleEventsRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    triggers: Annotated[list[TriggerPayload], Field(min_length=1)]


class SdkToolExecuteRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    tool_name: Annotated[str, Field(alias="toolName")]
    params: dict[str, Any] | None = None


class SearchDatadogLogsToolInputDefaultIndexes(RootModel[list[str] | None]):
    root: Annotated[
        list[str] | None,
        Field(
            description='Default log indexes to search (e.g., ["main"]). Falls back to ["main"] if not provided.',
            title="SearchDatadogLogsToolInputDefaultIndexes",
        ),
    ]


class SearchDatadogLogsToolInputQuery(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Datadog log search query (e.g., service:web AND @status:error)",
            title="SearchDatadogLogsToolInputQuery",
        ),
    ]


class SearchDatadogLogsToolInputIndexes(RootModel[list[str] | None]):
    root: Annotated[
        list[str] | None,
        Field(
            description='Log indexes to search (e.g., ["main"]). Defaults to defaultIndexes if not provided.',
            title="SearchDatadogLogsToolInputIndexes",
        ),
    ]


class SearchDatadogLogsToolInputFrom(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Start time (ISO8601 or relative like "now-1h")',
            title="SearchDatadogLogsToolInputFrom",
        ),
    ]


class SearchDatadogLogsToolInputTo(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="End time (ISO8601). Defaults to now if not provided.",
            title="SearchDatadogLogsToolInputTo",
        ),
    ]


class SearchDatadogLogsToolInputLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of log entries to return (default: 50)",
            title="SearchDatadogLogsToolInputLimit",
        ),
    ] = 50


class SearchDatadogLogsToolInputCursor(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Pagination cursor from previous response",
            title="SearchDatadogLogsToolInputCursor",
        ),
    ]


class SearchDatadogLogsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Datadog skill to use.",
        ),
    ]
    default_indexes: Annotated[
        SearchDatadogLogsToolInputDefaultIndexes | None,
        Field(
            alias="defaultIndexes",
            description='Default log indexes to search (e.g., ["main"]). Falls back to ["main"] if not provided.',
            title="SearchDatadogLogsToolInputDefaultIndexes",
        ),
    ] = None
    query: Annotated[
        SearchDatadogLogsToolInputQuery | None,
        Field(
            description="Datadog log search query (e.g., service:web AND @status:error)",
            title="SearchDatadogLogsToolInputQuery",
        ),
    ] = None
    indexes: Annotated[
        SearchDatadogLogsToolInputIndexes | None,
        Field(
            description='Log indexes to search (e.g., ["main"]). Defaults to defaultIndexes if not provided.',
            title="SearchDatadogLogsToolInputIndexes",
        ),
    ] = None
    from_: Annotated[
        SearchDatadogLogsToolInputFrom | None,
        Field(
            alias="from",
            description='Start time (ISO8601 or relative like "now-1h")',
            title="SearchDatadogLogsToolInputFrom",
        ),
    ] = None
    to: Annotated[
        SearchDatadogLogsToolInputTo | None,
        Field(
            description="End time (ISO8601). Defaults to now if not provided.",
            title="SearchDatadogLogsToolInputTo",
        ),
    ] = None
    limit: Annotated[
        SearchDatadogLogsToolInputLimit,
        Field(
            description="Maximum number of log entries to return (default: 50)",
            title="SearchDatadogLogsToolInputLimit",
            validate_default=True,
        ),
    ]
    cursor: Annotated[
        SearchDatadogLogsToolInputCursor | None,
        Field(
            description="Pagination cursor from previous response",
            title="SearchDatadogLogsToolInputCursor",
        ),
    ] = None
    sort: Annotated[
        ListRumEventsToolInputSort,
        Field(
            description='Sort order: "timestamp" (ascending) or "-timestamp" (descending)',
            title="SearchDatadogLogsToolInputSort",
        ),
    ]


class SearchDatadogLogsInput(RootModel[SearchDatadogLogsToolInput]):
    root: SearchDatadogLogsToolInput


class SearchDatadogLogsToolOutputQuery(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SearchDatadogLogsToolOutputQuery")]


class SearchDatadogLogsToolOutputTotalLogs(RootModel[int]):
    root: Annotated[int, Field(title="SearchDatadogLogsToolOutputTotalLogs")]


class SearchDatadogLogsToolOutputWarnings(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SearchDatadogLogsToolOutputWarnings")]


class SearchDatadogLogsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    query: Annotated[
        SearchDatadogLogsToolOutputQuery | None,
        Field(title="SearchDatadogLogsToolOutputQuery"),
    ]
    indexes: list[str]
    total_logs: Annotated[
        SearchDatadogLogsToolOutputTotalLogs,
        Field(alias="totalLogs", title="SearchDatadogLogsToolOutputTotalLogs"),
    ]
    logs: list[DatadogLogEntry]
    logs_link: Annotated[str, Field(alias="logsLink")]
    pagination: DatadogCursorPagination
    warnings: Annotated[
        SearchDatadogLogsToolOutputWarnings | None,
        Field(title="SearchDatadogLogsToolOutputWarnings"),
    ]
    message: str


class SearchGitHubCodeToolInputLanguage(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Filter by programming language (e.g., "typescript", "python", "javascript"). Use null to search all languages.',
            title="SearchGitHubCodeToolInputLanguage",
        ),
    ]


class SearchGitHubCodeToolInputFilename(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Filter by filename pattern (e.g., "*.test.ts" for test files, "*.config.*" for config files). Use null to search all files.',
            title="SearchGitHubCodeToolInputFilename",
        ),
    ]


class SearchGitHubCodeToolInputPath(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Filter by path (e.g., "src/components" to only search in that directory). Use null to search everywhere.',
            title="SearchGitHubCodeToolInputPath",
        ),
    ]


class SearchGitHubCodeToolInputPerPage(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Number of results to return (default: 10, max: 100)",
            title="SearchGitHubCodeToolInputPerPage",
        ),
    ]


class SearchGitHubCodeToolInputPage1(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            ge=1,
            title="SearchGitHubCodeToolInputPage",
        ),
    ]


class SearchGitHubCodeToolInputPage(RootModel[SearchGitHubCodeToolInputPage1 | None]):
    root: Annotated[
        SearchGitHubCodeToolInputPage1 | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            title="SearchGitHubCodeToolInputPage",
        ),
    ]


class SearchGitHubCodeToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    repository_names: Annotated[
        list[str],
        Field(
            alias="repositoryNames",
            description="Array of repository full names (owner/repo format) to search in.",
        ),
    ]
    query: Annotated[
        str,
        Field(
            description='The search query. Use natural language or code-specific terms. Examples: "authentication middleware", "class UserRepository", "handleSubmit form validation"'
        ),
    ]
    language: Annotated[
        SearchGitHubCodeToolInputLanguage | None,
        Field(
            description='Filter by programming language (e.g., "typescript", "python", "javascript"). Use null to search all languages.',
            title="SearchGitHubCodeToolInputLanguage",
        ),
    ] = None
    filename: Annotated[
        SearchGitHubCodeToolInputFilename | None,
        Field(
            description='Filter by filename pattern (e.g., "*.test.ts" for test files, "*.config.*" for config files). Use null to search all files.',
            title="SearchGitHubCodeToolInputFilename",
        ),
    ] = None
    path: Annotated[
        SearchGitHubCodeToolInputPath | None,
        Field(
            description='Filter by path (e.g., "src/components" to only search in that directory). Use null to search everywhere.',
            title="SearchGitHubCodeToolInputPath",
        ),
    ] = None
    per_page: Annotated[
        SearchGitHubCodeToolInputPerPage,
        Field(
            alias="perPage",
            description="Number of results to return (default: 10, max: 100)",
            title="SearchGitHubCodeToolInputPerPage",
        ),
    ]
    page: Annotated[
        SearchGitHubCodeToolInputPage | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            title="SearchGitHubCodeToolInputPage",
        ),
    ]


class SearchGitHubCodeInput(RootModel[SearchGitHubCodeToolInput]):
    root: SearchGitHubCodeToolInput


class SearchGitHubCodeToolOutputTotalCount(RootModel[int]):
    root: Annotated[int, Field(title="SearchGitHubCodeToolOutputTotalCount")]


class SearchGitHubCodeToolOutputResultsReturned(RootModel[int]):
    root: Annotated[int, Field(title="SearchGitHubCodeToolOutputResultsReturned")]


class SearchGitHubCodeToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    total_count: Annotated[
        SearchGitHubCodeToolOutputTotalCount,
        Field(alias="totalCount", title="SearchGitHubCodeToolOutputTotalCount"),
    ]
    results_returned: Annotated[
        SearchGitHubCodeToolOutputResultsReturned,
        Field(alias="resultsReturned", title="SearchGitHubCodeToolOutputResultsReturned"),
    ]
    query: str
    repositories: list[str]
    pagination: GitHubPagination
    results: list[GitHubCodeSearchResult]
    message: str
    tip: str


class SearchPosthogEventsCountSummaryTotalEventTypes(RootModel[int]):
    root: Annotated[int, Field(title="SearchPosthogEventsCountSummaryTotalEventTypes")]


class SearchPosthogEventsCountSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    count_by_event_name_only: Annotated[Literal[True], Field(alias="countByEventNameOnly")] = True
    custom_events_only: Annotated[bool, Field(alias="customEventsOnly")]
    event_counts: Annotated[list[PosthogEventCount], Field(alias="eventCounts")]
    total_event_types: Annotated[
        SearchPosthogEventsCountSummaryTotalEventTypes,
        Field(
            alias="totalEventTypes",
            title="SearchPosthogEventsCountSummaryTotalEventTypes",
        ),
    ]
    events_link: Annotated[str, Field(alias="eventsLink")]
    message: str


class SearchPosthogEventsEventListUserEmail(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SearchPosthogEventsEventListUserEmail")]


class SearchPosthogEventsEventListEventName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SearchPosthogEventsEventListEventName")]


class SearchPosthogEventsEventListTotalEvents(RootModel[int]):
    root: Annotated[int, Field(title="SearchPosthogEventsEventListTotalEvents")]


class SearchPosthogEventsEventList(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    user_email: Annotated[
        SearchPosthogEventsEventListUserEmail | None,
        Field(alias="userEmail", title="SearchPosthogEventsEventListUserEmail"),
    ]
    event_name: Annotated[
        SearchPosthogEventsEventListEventName | None,
        Field(alias="eventName", title="SearchPosthogEventsEventListEventName"),
    ]
    project_id: Annotated[str, Field(alias="projectId")]
    total_events: Annotated[
        SearchPosthogEventsEventListTotalEvents,
        Field(alias="totalEvents", title="SearchPosthogEventsEventListTotalEvents"),
    ]
    events: list[PosthogEventSummary]
    events_link: Annotated[str, Field(alias="eventsLink")]
    pagination: PosthogOffsetPagination
    message: str


class SearchPosthogEventsToolInputCountByEventNameOnly(RootModel[bool]):
    root: Annotated[
        bool,
        Field(
            description="If true (default), returns only event names and their counts. If false, returns full event list (larger response).",
            title="SearchPosthogEventsToolInputCountByEventNameOnly",
        ),
    ] = True


class SearchPosthogEventsToolInputCustomEventsOnly(RootModel[bool]):
    root: Annotated[
        bool,
        Field(
            description="If true (default), only include custom events (exclude PostHog built-in events whose names start with $, e.g. $pageview, $autocapture). If false, include all events. Use true to get counts for events the project actually tracks (works for any user's project).",
            title="SearchPosthogEventsToolInputCustomEventsOnly",
        ),
    ] = True


class SearchPosthogEventsToolInputUserEmail(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Optional: User email to filter events by (e.g., "user@example.com").',
            title="SearchPosthogEventsToolInputUserEmail",
        ),
    ]


class SearchPosthogEventsToolInputEventName(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Optional: Specific event name to filter by (e.g., "$pageview", "button_clicked", "form_submitted").',
            title="SearchPosthogEventsToolInputEventName",
        ),
    ]


class SearchPosthogEventsToolInputPropertyFilters(RootModel[list[PosthogPropertyFilter] | None]):
    root: Annotated[
        list[PosthogPropertyFilter] | None,
        Field(
            description="Optional: Array of property filters to apply. Each filter has a key, value, and operator.",
            title="SearchPosthogEventsToolInputPropertyFilters",
        ),
    ]


class SearchPosthogEventsToolInputLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of events to return when countByEventNameOnly is false (default: 50, max: 100). Ignored when countByEventNameOnly is true.",
            title="SearchPosthogEventsToolInputLimit",
        ),
    ] = 50


class SearchPosthogEventsToolInputOffset(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Offset for pagination when countByEventNameOnly is false (default: 0). Ignored when countByEventNameOnly is true.",
            title="SearchPosthogEventsToolInputOffset",
        ),
    ] = 0


class SearchPosthogEventsToolInputLast7Days(RootModel[bool]):
    root: Annotated[
        bool,
        Field(
            description="If true and dateFrom is not provided, filters events from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.",
            title="SearchPosthogEventsToolInputLast7Days",
        ),
    ] = False


class SearchPosthogEventsToolInputDateFrom(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Start date for filtering. MUST be formatted as "YYYY-MM-DD HH:mm:ss" in UTC (e.g. "2026-02-06 14:00:00"). Do NOT use ISO format with T/Z (e.g. 2026-02-07T22:52:34Z) and do NOT use relative strings like "-7d". If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.',
            title="SearchPosthogEventsToolInputDateFrom",
        ),
    ]


class SearchPosthogEventsToolInputDateTo(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='End date for filtering. MUST be formatted as "YYYY-MM-DD HH:mm:ss" in UTC (e.g. "2026-02-07 14:00:00"). Do NOT use ISO format with T/Z and do NOT use relative strings like "now". If not provided, defaults to now.',
            title="SearchPosthogEventsToolInputDateTo",
        ),
    ]


class SearchPosthogEventsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the PostHog skill to use.",
        ),
    ]
    project_id: Annotated[str, Field(alias="projectId", description="The PostHog project ID.")]
    count_by_event_name_only: Annotated[
        SearchPosthogEventsToolInputCountByEventNameOnly,
        Field(
            alias="countByEventNameOnly",
            description="If true (default), returns only event names and their counts. If false, returns full event list (larger response).",
            title="SearchPosthogEventsToolInputCountByEventNameOnly",
            validate_default=True,
        ),
    ]
    custom_events_only: Annotated[
        SearchPosthogEventsToolInputCustomEventsOnly,
        Field(
            alias="customEventsOnly",
            description="If true (default), only include custom events (exclude PostHog built-in events whose names start with $, e.g. $pageview, $autocapture). If false, include all events. Use true to get counts for events the project actually tracks (works for any user's project).",
            title="SearchPosthogEventsToolInputCustomEventsOnly",
            validate_default=True,
        ),
    ]
    user_email: Annotated[
        SearchPosthogEventsToolInputUserEmail | None,
        Field(
            alias="userEmail",
            description='Optional: User email to filter events by (e.g., "user@example.com").',
            title="SearchPosthogEventsToolInputUserEmail",
        ),
    ] = None
    event_name: Annotated[
        SearchPosthogEventsToolInputEventName | None,
        Field(
            alias="eventName",
            description='Optional: Specific event name to filter by (e.g., "$pageview", "button_clicked", "form_submitted").',
            title="SearchPosthogEventsToolInputEventName",
        ),
    ] = None
    property_filters: Annotated[
        SearchPosthogEventsToolInputPropertyFilters | None,
        Field(
            alias="propertyFilters",
            description="Optional: Array of property filters to apply. Each filter has a key, value, and operator.",
            title="SearchPosthogEventsToolInputPropertyFilters",
        ),
    ] = None
    limit: Annotated[
        SearchPosthogEventsToolInputLimit,
        Field(
            description="Maximum number of events to return when countByEventNameOnly is false (default: 50, max: 100). Ignored when countByEventNameOnly is true.",
            title="SearchPosthogEventsToolInputLimit",
            validate_default=True,
        ),
    ]
    offset: Annotated[
        SearchPosthogEventsToolInputOffset,
        Field(
            description="Offset for pagination when countByEventNameOnly is false (default: 0). Ignored when countByEventNameOnly is true.",
            title="SearchPosthogEventsToolInputOffset",
            validate_default=True,
        ),
    ]
    last7_days: Annotated[
        SearchPosthogEventsToolInputLast7Days,
        Field(
            alias="last7Days",
            description="If true and dateFrom is not provided, filters events from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.",
            title="SearchPosthogEventsToolInputLast7Days",
            validate_default=True,
        ),
    ]
    date_from: Annotated[
        SearchPosthogEventsToolInputDateFrom | None,
        Field(
            alias="dateFrom",
            description='Start date for filtering. MUST be formatted as "YYYY-MM-DD HH:mm:ss" in UTC (e.g. "2026-02-06 14:00:00"). Do NOT use ISO format with T/Z (e.g. 2026-02-07T22:52:34Z) and do NOT use relative strings like "-7d". If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.',
            title="SearchPosthogEventsToolInputDateFrom",
        ),
    ]
    date_to: Annotated[
        SearchPosthogEventsToolInputDateTo | None,
        Field(
            alias="dateTo",
            description='End date for filtering. MUST be formatted as "YYYY-MM-DD HH:mm:ss" in UTC (e.g. "2026-02-07 14:00:00"). Do NOT use ISO format with T/Z and do NOT use relative strings like "now". If not provided, defaults to now.',
            title="SearchPosthogEventsToolInputDateTo",
        ),
    ]


class SearchPosthogEventsInput(RootModel[SearchPosthogEventsToolInput]):
    root: SearchPosthogEventsToolInput


class SearchPosthogEventsToolOutput(RootModel[SearchPosthogEventsCountSummary | SearchPosthogEventsEventList]):
    root: SearchPosthogEventsCountSummary | SearchPosthogEventsEventList


class SearchPosthogLogsToolInputUserEmail(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Optional: User email to filter logs by (e.g., "user@example.com").',
            title="SearchPosthogLogsToolInputUserEmail",
        ),
    ]


class SearchPosthogLogsToolInputSeverityLevels(RootModel[list[PosthogSeverityLevel] | None]):
    root: Annotated[
        list[PosthogSeverityLevel] | None,
        Field(
            description='Optional: Array of log severity levels to filter by (e.g., ["error", "warn"]). If not provided, all severity levels are included.',
            title="SearchPosthogLogsToolInputSeverityLevels",
        ),
    ]


class SearchPosthogLogsToolInputMessageSearch(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional: Text to search for within log messages. Searches are case-insensitive and match partial text.",
            title="SearchPosthogLogsToolInputMessageSearch",
        ),
    ]


class SearchPosthogLogsToolInputLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of log entries to return (default: 50, max: 250)",
            title="SearchPosthogLogsToolInputLimit",
        ),
    ] = 50


class SearchPosthogLogsToolInputOffset(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Offset for pagination (default: 0). Use with limit to page through results. For example, offset=0 gets logs 1-50, offset=50 gets logs 51-100, etc.",
            title="SearchPosthogLogsToolInputOffset",
        ),
    ] = 0


class SearchPosthogLogsToolInputLast7Days(RootModel[bool]):
    root: Annotated[
        bool,
        Field(
            description="If true and dateFrom is not provided, filters logs from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.",
            title="SearchPosthogLogsToolInputLast7Days",
        ),
    ] = False


class SearchPosthogLogsToolInputDateFrom(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.',
            title="SearchPosthogLogsToolInputDateFrom",
        ),
    ]


class SearchPosthogLogsToolInputDateTo(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.',
            title="SearchPosthogLogsToolInputDateTo",
        ),
    ]


class SearchPosthogLogsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the PostHog skill to use.",
        ),
    ]
    project_id: Annotated[str, Field(alias="projectId", description="The PostHog project ID.")]
    user_email: Annotated[
        SearchPosthogLogsToolInputUserEmail | None,
        Field(
            alias="userEmail",
            description='Optional: User email to filter logs by (e.g., "user@example.com").',
            title="SearchPosthogLogsToolInputUserEmail",
        ),
    ] = None
    severity_levels: Annotated[
        SearchPosthogLogsToolInputSeverityLevels | None,
        Field(
            alias="severityLevels",
            description='Optional: Array of log severity levels to filter by (e.g., ["error", "warn"]). If not provided, all severity levels are included.',
            title="SearchPosthogLogsToolInputSeverityLevels",
        ),
    ]
    message_search: Annotated[
        SearchPosthogLogsToolInputMessageSearch | None,
        Field(
            alias="messageSearch",
            description="Optional: Text to search for within log messages. Searches are case-insensitive and match partial text.",
            title="SearchPosthogLogsToolInputMessageSearch",
        ),
    ] = None
    limit: Annotated[
        SearchPosthogLogsToolInputLimit,
        Field(
            description="Maximum number of log entries to return (default: 50, max: 250)",
            title="SearchPosthogLogsToolInputLimit",
            validate_default=True,
        ),
    ]
    offset: Annotated[
        SearchPosthogLogsToolInputOffset,
        Field(
            description="Offset for pagination (default: 0). Use with limit to page through results. For example, offset=0 gets logs 1-50, offset=50 gets logs 51-100, etc.",
            title="SearchPosthogLogsToolInputOffset",
            validate_default=True,
        ),
    ]
    last7_days: Annotated[
        SearchPosthogLogsToolInputLast7Days,
        Field(
            alias="last7Days",
            description="If true and dateFrom is not provided, filters logs from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.",
            title="SearchPosthogLogsToolInputLast7Days",
            validate_default=True,
        ),
    ]
    date_from: Annotated[
        SearchPosthogLogsToolInputDateFrom | None,
        Field(
            alias="dateFrom",
            description='Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.',
            title="SearchPosthogLogsToolInputDateFrom",
        ),
    ]
    date_to: Annotated[
        SearchPosthogLogsToolInputDateTo | None,
        Field(
            alias="dateTo",
            description='End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.',
            title="SearchPosthogLogsToolInputDateTo",
        ),
    ] = None


class SearchPosthogLogsInput(RootModel[SearchPosthogLogsToolInput]):
    root: SearchPosthogLogsToolInput


class SearchPosthogLogsToolOutputUserEmail(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SearchPosthogLogsToolOutputUserEmail")]


class SearchPosthogLogsToolOutputSeverityLevels(RootModel[list[PosthogSeverityLevel] | None]):
    root: Annotated[
        list[PosthogSeverityLevel] | None,
        Field(title="SearchPosthogLogsToolOutputSeverityLevels"),
    ]


class SearchPosthogLogsToolOutputMessageSearch(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SearchPosthogLogsToolOutputMessageSearch")]


class SearchPosthogLogsToolOutputTotalLogs(RootModel[int]):
    root: Annotated[int, Field(title="SearchPosthogLogsToolOutputTotalLogs")]


class SearchPosthogLogsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    user_email: Annotated[
        SearchPosthogLogsToolOutputUserEmail | None,
        Field(alias="userEmail", title="SearchPosthogLogsToolOutputUserEmail"),
    ]
    severity_levels: Annotated[
        SearchPosthogLogsToolOutputSeverityLevels | None,
        Field(alias="severityLevels", title="SearchPosthogLogsToolOutputSeverityLevels"),
    ]
    message_search: Annotated[
        SearchPosthogLogsToolOutputMessageSearch | None,
        Field(alias="messageSearch", title="SearchPosthogLogsToolOutputMessageSearch"),
    ]
    project_id: Annotated[str, Field(alias="projectId")]
    total_logs: Annotated[
        SearchPosthogLogsToolOutputTotalLogs,
        Field(alias="totalLogs", title="SearchPosthogLogsToolOutputTotalLogs"),
    ]
    logs: list[PosthogLogEntry]
    logs_link: Annotated[str, Field(alias="logsLink")]
    pagination: PosthogOffsetPagination
    message: str


class SearchPosthogSessionsToolInputLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of session recordings to return (default: 10, max: 100)",
            title="SearchPosthogSessionsToolInputLimit",
        ),
    ] = 10


class SearchPosthogSessionsToolInputOffset(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Offset for pagination (default: 0)",
            title="SearchPosthogSessionsToolInputOffset",
        ),
    ] = 0


class SearchPosthogSessionsToolInputLast7Days(RootModel[bool]):
    root: Annotated[
        bool,
        Field(
            description="If true and dateFrom is not provided, filters session recordings from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.",
            title="SearchPosthogSessionsToolInputLast7Days",
        ),
    ] = False


class SearchPosthogSessionsToolInputDateFrom(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.',
            title="SearchPosthogSessionsToolInputDateFrom",
        ),
    ]


class SearchPosthogSessionsToolInputDateTo(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.',
            title="SearchPosthogSessionsToolInputDateTo",
        ),
    ]


class SearchPosthogSessionsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the PostHog skill to use.",
        ),
    ]
    project_id: Annotated[str, Field(alias="projectId", description="The PostHog project ID.")]
    user_email: Annotated[
        str,
        Field(
            alias="userEmail",
            description="The email address of the user to query session recordings for. Must be a valid email address.",
        ),
    ]
    limit: Annotated[
        SearchPosthogSessionsToolInputLimit,
        Field(
            description="Maximum number of session recordings to return (default: 10, max: 100)",
            title="SearchPosthogSessionsToolInputLimit",
            validate_default=True,
        ),
    ]
    offset: Annotated[
        SearchPosthogSessionsToolInputOffset,
        Field(
            description="Offset for pagination (default: 0)",
            title="SearchPosthogSessionsToolInputOffset",
            validate_default=True,
        ),
    ]
    last7_days: Annotated[
        SearchPosthogSessionsToolInputLast7Days,
        Field(
            alias="last7Days",
            description="If true and dateFrom is not provided, filters session recordings from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.",
            title="SearchPosthogSessionsToolInputLast7Days",
            validate_default=True,
        ),
    ]
    date_from: Annotated[
        SearchPosthogSessionsToolInputDateFrom | None,
        Field(
            alias="dateFrom",
            description='Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.',
            title="SearchPosthogSessionsToolInputDateFrom",
        ),
    ]
    date_to: Annotated[
        SearchPosthogSessionsToolInputDateTo | None,
        Field(
            alias="dateTo",
            description='End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.',
            title="SearchPosthogSessionsToolInputDateTo",
        ),
    ] = None


class SearchPosthogSessionsInput(RootModel[SearchPosthogSessionsToolInput]):
    root: SearchPosthogSessionsToolInput


class SearchPosthogSessionsToolOutput(RootModel[PosthogSearchSessionsFound | PosthogSearchSessionsNotFound]):
    root: PosthogSearchSessionsFound | PosthogSearchSessionsNotFound


class SearchRumEventsToolInputQuery(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Datadog RUM search query (e.g., @type:error AND @error.source:network)",
            title="SearchRumEventsToolInputQuery",
        ),
    ]


class SearchRumEventsToolInputTo(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='End time (ISO8601). Defaults to "now" if not provided.',
            title="SearchRumEventsToolInputTo",
        ),
    ]


class SearchRumEventsToolInputLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of RUM events to return (default: 25, max: 1000)",
            title="SearchRumEventsToolInputLimit",
        ),
    ] = 25


class SearchRumEventsToolInputPageCursor(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Pagination cursor from previous response",
            title="SearchRumEventsToolInputPageCursor",
        ),
    ]


class SearchRumEventsToolInputTimezone(RootModel[str]):
    root: Annotated[
        str,
        Field(
            description='Timezone for time-based queries (default: "GMT")',
            title="SearchRumEventsToolInputTimezone",
        ),
    ] = "GMT"


class SearchRumEventsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Datadog skill to use.",
        ),
    ]
    query: Annotated[
        SearchRumEventsToolInputQuery | None,
        Field(
            description="Datadog RUM search query (e.g., @type:error AND @error.source:network)",
            title="SearchRumEventsToolInputQuery",
        ),
    ] = None
    from_: Annotated[
        str,
        Field(alias="from", description='Start time (ISO8601 or relative like "now-15m")'),
    ]
    to: Annotated[
        SearchRumEventsToolInputTo | None,
        Field(
            description='End time (ISO8601). Defaults to "now" if not provided.',
            title="SearchRumEventsToolInputTo",
        ),
    ] = None
    limit: Annotated[
        SearchRumEventsToolInputLimit,
        Field(
            description="Maximum number of RUM events to return (default: 25, max: 1000)",
            title="SearchRumEventsToolInputLimit",
            validate_default=True,
        ),
    ]
    page_cursor: Annotated[
        SearchRumEventsToolInputPageCursor | None,
        Field(
            alias="pageCursor",
            description="Pagination cursor from previous response",
            title="SearchRumEventsToolInputPageCursor",
        ),
    ] = None
    sort: Annotated[
        ListRumEventsToolInputSort,
        Field(
            description='Sort order: "timestamp" (ascending) or "-timestamp" (descending)',
            title="SearchRumEventsToolInputSort",
        ),
    ]
    timezone: Annotated[
        SearchRumEventsToolInputTimezone,
        Field(
            description='Timezone for time-based queries (default: "GMT")',
            title="SearchRumEventsToolInputTimezone",
            validate_default=True,
        ),
    ]


class SearchRumEventsInput(RootModel[SearchRumEventsToolInput]):
    root: SearchRumEventsToolInput


class SearchRumEventsToolOutputQuery(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SearchRumEventsToolOutputQuery")]


class SearchRumEventsToolOutputTotalEvents(RootModel[int]):
    root: Annotated[int, Field(title="SearchRumEventsToolOutputTotalEvents")]


class SearchRumEventsToolOutputWarnings(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SearchRumEventsToolOutputWarnings")]


class SearchRumEventsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    query: Annotated[
        SearchRumEventsToolOutputQuery | None,
        Field(title="SearchRumEventsToolOutputQuery"),
    ]
    total_events: Annotated[
        SearchRumEventsToolOutputTotalEvents,
        Field(alias="totalEvents", title="SearchRumEventsToolOutputTotalEvents"),
    ]
    events: list[DatadogRumEvent]
    events_by_type: Annotated[dict[str, int], Field(alias="eventsByType")]
    rum_link: Annotated[str, Field(alias="rumLink")]
    pagination: DatadogCursorPagination
    warnings: Annotated[
        SearchRumEventsToolOutputWarnings | None,
        Field(title="SearchRumEventsToolOutputWarnings"),
    ]
    message: str


class SerializedEvent(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[IntegrationTypeEnum, Field(alias="integrationType")]
    event_type: Annotated[str | None, Field(alias="eventType")] = None
    formatted_content: Annotated[str, Field(alias="formattedContent")]
    debug_log: Annotated[str, Field(alias="debugLog")]
    metadata: dict[str, Any] | None = None


class SlackChannelListItem(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str | None = None
    name: str
    is_private: Annotated[bool, Field(alias="isPrivate")]
    is_im: Annotated[bool, Field(alias="isIm")]
    is_mpim: Annotated[bool, Field(alias="isMpim")]
    user_id: Annotated[str | None, Field(alias="userId")] = None


class SlackChannel(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    is_private: Annotated[bool, Field(alias="isPrivate")]
    is_archived: Annotated[bool, Field(alias="isArchived")]
    is_mpim: Annotated[bool, Field(alias="isMPIM")]


class SlackChannelType(StrEnum):
    channel = "channel"
    group = "group"
    mpim = "mpim"
    im = "im"


class SlackChannelsResponseSelectedChannelId(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SlackChannelsResponseSelectedChannelId")]


class SlackChannelsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    channels: list[SlackChannel]
    selected_channel_id: Annotated[
        SlackChannelsResponseSelectedChannelId | None,
        Field(alias="selectedChannelId", title="SlackChannelsResponseSelectedChannelId"),
    ]


class SlackConversationMessage(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    user_id: Annotated[str | None, Field(alias="userId")] = None
    user_name: Annotated[str | None, Field(alias="userName")] = None
    text: str
    timestamp: str | None = None
    thread_ts: Annotated[str | None, Field(alias="threadTs")] = None


class SlackListChannelsTypes(StrEnum):
    public = "public"
    private = "private"
    im = "im"
    mpim = "mpim"
    all = "all"


class SlackListChannelsToolInputTypes(RootModel[SlackListChannelsTypes | None]):
    root: Annotated[
        SlackListChannelsTypes | None,
        Field(
            description="Filter by type: public (public channels), private (private channels), im (DMs), mpim (group DMs), or all. Defaults to all.",
            title="SlackListChannelsToolInputTypes",
        ),
    ]


class SlackListChannelsToolInputLimit1(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of conversations to return.",
            ge=1,
            le=500,
            title="SlackListChannelsToolInputLimit",
        ),
    ] = 100


class SlackListChannelsToolInputLimit(RootModel[SlackListChannelsToolInputLimit1 | None]):
    root: Annotated[
        SlackListChannelsToolInputLimit1 | None,
        Field(
            description="Maximum number of conversations to return.",
            title="SlackListChannelsToolInputLimit",
            validate_default=True,
        ),
    ] = 100


class SlackListChannelsToolInputCursor(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Pagination cursor from a previous response (nextCursor). Omit on first call.",
            title="SlackListChannelsToolInputCursor",
        ),
    ]


class SlackListChannelsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Slack workspace (user_slack_integrations id).",
        ),
    ]
    types: Annotated[
        SlackListChannelsToolInputTypes | None,
        Field(
            description="Filter by type: public (public channels), private (private channels), im (DMs), mpim (group DMs), or all. Defaults to all.",
            title="SlackListChannelsToolInputTypes",
        ),
    ] = None
    limit: Annotated[
        SlackListChannelsToolInputLimit | None,
        Field(
            description="Maximum number of conversations to return.",
            title="SlackListChannelsToolInputLimit",
            validate_default=True,
        ),
    ]
    cursor: Annotated[
        SlackListChannelsToolInputCursor | None,
        Field(
            description="Pagination cursor from a previous response (nextCursor). Omit on first call.",
            title="SlackListChannelsToolInputCursor",
        ),
    ] = None


class SlackListChannelsInput(RootModel[SlackListChannelsToolInput]):
    root: SlackListChannelsToolInput


class SlackListChannelsToolOutputCount(RootModel[int]):
    root: Annotated[int, Field(title="SlackListChannelsToolOutputCount")]


class SlackListChannelsToolOutputNextCursor(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SlackListChannelsToolOutputNextCursor")]


class SlackListChannelsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    channels: list[SlackChannelListItem]
    count: Annotated[
        SlackListChannelsToolOutputCount,
        Field(title="SlackListChannelsToolOutputCount"),
    ]
    next_cursor: Annotated[
        SlackListChannelsToolOutputNextCursor | None,
        Field(alias="nextCursor", title="SlackListChannelsToolOutputNextCursor"),
    ]
    has_more: Annotated[bool, Field(alias="hasMore")]


class SlackListUsersToolInputQuery(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Optional search query to filter users by name. Case-insensitive partial match.",
            title="SlackListUsersToolInputQuery",
        ),
    ]


class SlackListUsersToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Slack workspace (user_slack_integrations id).",
        ),
    ]
    query: Annotated[
        SlackListUsersToolInputQuery | None,
        Field(
            description="Optional search query to filter users by name. Case-insensitive partial match.",
            title="SlackListUsersToolInputQuery",
        ),
    ] = None


class SlackListUsersInput(RootModel[SlackListUsersToolInput]):
    root: SlackListUsersToolInput


class SlackUserSummary(JiraIssueTypeRef):
    pass


class SlackListUsersToolOutputCount(RootModel[int]):
    root: Annotated[int, Field(title="SlackListUsersToolOutputCount")]


class SlackListUsersToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    users: list[SlackUserSummary]
    count: Annotated[SlackListUsersToolOutputCount, Field(title="SlackListUsersToolOutputCount")]


class SlackReadConversationToolInputLimit1(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Maximum number of messages to return.",
            ge=1,
            le=200,
            title="SlackReadConversationToolInputLimit",
        ),
    ] = 50


class SlackReadConversationToolInputLimit(RootModel[SlackReadConversationToolInputLimit1 | None]):
    root: Annotated[
        SlackReadConversationToolInputLimit1 | None,
        Field(
            description="Maximum number of messages to return.",
            title="SlackReadConversationToolInputLimit",
            validate_default=True,
        ),
    ] = 50


class SlackReadConversationToolInputCursor(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Pagination cursor from a previous response (nextCursor). Omit on first call.",
            title="SlackReadConversationToolInputCursor",
        ),
    ]


class SlackReadConversationToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Slack workspace (user_slack_integrations id).",
        ),
    ]
    channel_id: Annotated[
        str,
        Field(
            alias="channelId",
            description="The Slack channel ID to read (from slack_list_channels).",
        ),
    ]
    limit: Annotated[
        SlackReadConversationToolInputLimit | None,
        Field(
            description="Maximum number of messages to return.",
            title="SlackReadConversationToolInputLimit",
            validate_default=True,
        ),
    ]
    cursor: Annotated[
        SlackReadConversationToolInputCursor | None,
        Field(
            description="Pagination cursor from a previous response (nextCursor). Omit on first call.",
            title="SlackReadConversationToolInputCursor",
        ),
    ] = None


class SlackReadConversationInput(RootModel[SlackReadConversationToolInput]):
    root: SlackReadConversationToolInput


class SlackReadConversationToolOutputCount(RootModel[int]):
    root: Annotated[int, Field(title="SlackReadConversationToolOutputCount")]


class SlackReadConversationToolOutputNextCursor(RootModel[str | None]):
    root: Annotated[str | None, Field(title="SlackReadConversationToolOutputNextCursor")]


class SlackReadConversationToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    channel_id: Annotated[str, Field(alias="channelId")]
    channel_name: Annotated[str | None, Field(alias="channelName")] = None
    messages: list[SlackConversationMessage]
    count: Annotated[
        SlackReadConversationToolOutputCount,
        Field(title="SlackReadConversationToolOutputCount"),
    ]
    has_more: Annotated[bool, Field(alias="hasMore")]
    next_cursor: Annotated[
        SlackReadConversationToolOutputNextCursor | None,
        Field(alias="nextCursor", title="SlackReadConversationToolOutputNextCursor"),
    ]


class SlackSendMessageToolInputThreadTs(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Thread timestamp to reply to existing thread. If sending a message to a thread, this should be the timestamp of the thread to reply to. If sending an unthreaded message, this should be set to null.",
            title="SlackSendMessageToolInputThreadTs",
        ),
    ]


class SlackSendMessageToolInputBlocks(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description="Block Kit JSON array string for interactive messages with buttons, structured layouts",
            title="SlackSendMessageToolInputBlocks",
        ),
    ]


class SlackSendMessageToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Slack workspace to use.",
        ),
    ]
    channel_id: Annotated[
        str,
        Field(
            alias="channelId",
            description="Slack channel or DM channel ID from the configured output destinations.",
        ),
    ]
    message: Annotated[
        str,
        Field(description="Message content (mrkdwn). Used as fallback for Block Kit or main message."),
    ]
    thread_ts: Annotated[
        SlackSendMessageToolInputThreadTs | None,
        Field(
            description="Thread timestamp to reply to existing thread. If sending a message to a thread, this should be the timestamp of the thread to reply to. If sending an unthreaded message, this should be set to null.",
            title="SlackSendMessageToolInputThreadTs",
        ),
    ] = None
    blocks: Annotated[
        SlackSendMessageToolInputBlocks | None,
        Field(
            description="Block Kit JSON array string for interactive messages with buttons, structured layouts",
            title="SlackSendMessageToolInputBlocks",
        ),
    ] = None


class SlackSendMessageInput(RootModel[SlackSendMessageToolInput]):
    root: SlackSendMessageToolInput


class SlackSendMessageToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    message_ts: str | None = None
    channel: str
    thread_ts: str | None = None
    summary: str
    has_blocks: bool


class SlackUsersResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    users: list[SlackUserSummary]


class SnowflakeExecuteQueryToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Snowflake connection to use.",
        ),
    ]
    query: Annotated[
        str,
        Field(description="The SQL query to execute. Should be a read-only SELECT statement."),
    ]


class SnowflakeExecuteQueryInput(RootModel[SnowflakeExecuteQueryToolInput]):
    root: SnowflakeExecuteQueryToolInput


class SnowflakeQueryRow(NotionPageParent):
    pass


class SnowflakeExecuteQueryToolOutputRowCount(RootModel[int]):
    root: Annotated[int, Field(title="SnowflakeExecuteQueryToolOutputRowCount")]


class SnowflakeExecuteQueryToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    rows: list[SnowflakeQueryRow]
    columns: list[str]
    row_count: Annotated[
        SnowflakeExecuteQueryToolOutputRowCount,
        Field(alias="rowCount", title="SnowflakeExecuteQueryToolOutputRowCount"),
    ]


class SnowflakeExplainQueryToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[
        str,
        Field(
            alias="integrationId",
            description="The integration ID of the Snowflake connection to use.",
        ),
    ]
    query: Annotated[str, Field(description="The SQL query to explain.")]


class SnowflakeExplainQueryInput(RootModel[SnowflakeExplainQueryToolInput]):
    root: SnowflakeExplainQueryToolInput


class SnowflakeExplainQueryToolOutputRowCount(RootModel[int]):
    root: Annotated[int, Field(title="SnowflakeExplainQueryToolOutputRowCount")]


class SnowflakeExplainQueryToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    explain_plan: Annotated[list[SnowflakeQueryRow], Field(alias="explainPlan")]
    columns: list[str]
    row_count: Annotated[
        SnowflakeExplainQueryToolOutputRowCount,
        Field(alias="rowCount", title="SnowflakeExplainQueryToolOutputRowCount"),
    ]


class StatsInterval(StrEnum):
    field_1h = "1h"
    field_24h = "24h"
    field_7d = "7d"
    field_1mo = "1mo"
    field_3mo = "3mo"
    field_1y = "1y"


class StatsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    total_events_processed: Annotated[float, Field(alias="totalEventsProcessed")]
    total_events_processed_change: Annotated[str, Field(alias="totalEventsProcessedChange")]
    actions_taken: Annotated[float, Field(alias="actionsTaken")]
    actions_taken_change: Annotated[str, Field(alias="actionsTakenChange")]
    number_of_agents: Annotated[float, Field(alias="numberOfAgents")]
    number_of_agents_change: Annotated[str, Field(alias="numberOfAgentsChange")]
    daily_events: Annotated[list[DailyEventCount], Field(alias="dailyEvents")]
    recent_actions: Annotated[list[RecentAction], Field(alias="recentActions")]
    recent_runs: Annotated[list[RunHistoryRecordWithAgent], Field(alias="recentRuns")]
    timezone: str
    agent_activity: Annotated[list[AgentActivityItem], Field(alias="agentActivity")]
    status_breakdown: Annotated[list[CountByString], Field(alias="statusBreakdown")]
    trigger_integrations: Annotated[list[CountByString], Field(alias="triggerIntegrations")]
    action_integrations: Annotated[list[CountByString], Field(alias="actionIntegrations")]
    action_types: Annotated[list[CountByString], Field(alias="actionTypes")]


class SummarizeGitHubPullRequestDiffToolInputPullNumber(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="The pull request number (e.g., 123 for PR #123)",
            title="SummarizeGitHubPullRequestDiffToolInputPullNumber",
        ),
    ]


class SummarizeGitHubPullRequestDiffToolInputPage1(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional files if a PR has more than 100 files. Use null for page 1. Must be a positive integer >= 1.",
            ge=1,
            title="SummarizeGitHubPullRequestDiffToolInputPage",
        ),
    ]


class SummarizeGitHubPullRequestDiffToolInputPage(RootModel[SummarizeGitHubPullRequestDiffToolInputPage1 | None]):
    root: Annotated[
        SummarizeGitHubPullRequestDiffToolInputPage1 | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional files if a PR has more than 100 files. Use null for page 1. Must be a positive integer >= 1.",
            title="SummarizeGitHubPullRequestDiffToolInputPage",
        ),
    ]


class SummarizeGitHubPullRequestDiffToolInputContext(RootModel[str | None]):
    root: Annotated[
        str | None,
        Field(
            description='Optional high-level context about what you\'re looking for in this PR. This helps the sub-agent focus its analysis. For example: "I need to understand the authentication changes" or "Focus on database migration changes". Use null if no specific context.',
            title="SummarizeGitHubPullRequestDiffToolInputContext",
        ),
    ]


class SummarizeGitHubPullRequestDiffToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    repository: Annotated[
        str,
        Field(
            description='The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'
        ),
    ]
    pull_number: Annotated[
        SummarizeGitHubPullRequestDiffToolInputPullNumber,
        Field(
            alias="pullNumber",
            description="The pull request number (e.g., 123 for PR #123)",
            title="SummarizeGitHubPullRequestDiffToolInputPullNumber",
        ),
    ]
    page: Annotated[
        SummarizeGitHubPullRequestDiffToolInputPage | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional files if a PR has more than 100 files. Use null for page 1. Must be a positive integer >= 1.",
            title="SummarizeGitHubPullRequestDiffToolInputPage",
        ),
    ]
    context: Annotated[
        SummarizeGitHubPullRequestDiffToolInputContext | None,
        Field(
            description='Optional high-level context about what you\'re looking for in this PR. This helps the sub-agent focus its analysis. For example: "I need to understand the authentication changes" or "Focus on database migration changes". Use null if no specific context.',
            title="SummarizeGitHubPullRequestDiffToolInputContext",
        ),
    ]


class SummarizeGitHubPullRequestDiffInput(RootModel[SummarizeGitHubPullRequestDiffToolInput]):
    root: SummarizeGitHubPullRequestDiffToolInput


class SummarizeGitHubPullRequestDiffToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    repository: str
    pull_request: Annotated[GitHubPullRequestRef, Field(alias="pullRequest")]
    summary: dict[str, Any]
    pagination: GitHubPagination
    analysis: str
    message: str


class TerseAgentMessageEventPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    run_id: str
    automation_id: str
    organization_id: str


class TerseAgentMessageMetadata(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    event_type: Literal["terse_agent_message"] = "terse_agent_message"
    event_payload: TerseAgentMessageEventPayload


class ToggleImprovementsEnabledRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    enabled: bool


class ToggleImprovementsEnabledResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    improvements_enabled: Annotated[bool, Field(alias="improvementsEnabled")]


class ToolOutputBase(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None


class ToolOutputFailure(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[False] = False
    actions: list[RunHistoryAction] | None = None


class ToolOutputSuccess(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None


class TransientAgentOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    config: ConfigData | None = None
    config_type: Annotated[ConfigTypeEnum, Field(alias="configType")]


class TransientAgentTrigger(TransientAgentOutput):
    pass


class TriggerWithEventParams(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    automation_id: Annotated[str, Field(alias="automationId")]


class TriggerWithEventRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    event: SerializedEvent


class UpdateNotificationDestinationRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
        regex_engine="python-re",
    )
    type: NotificationDestinationType | None = None
    email: Annotated[
        EmailStr | None,
        Field(
            pattern="^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"
        ),
    ] = None
    integration_id: Annotated[str | None, Field(alias="integrationId")] = None
    slack_channel_id: Annotated[str | None, Field(alias="slackChannelId")] = None
    slack_channel_name: Annotated[str | None, Field(alias="slackChannelName")] = None
    slack_user_id: Annotated[str | None, Field(alias="slackUserId")] = None
    slack_user_name: Annotated[str | None, Field(alias="slackUserName")] = None
    is_active: Annotated[bool | None, Field(alias="isActive")] = None


class UseConfluenceResourcesReturnBase(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    resources: list[ConfluencePage]
    response: ConfluenceResourcesResponse | None = None
    is_loading: Annotated[bool, Field(alias="isLoading")]
    is_error: Annotated[bool, Field(alias="isError")]
    error: Any
    is_validating: Annotated[bool, Field(alias="isValidating")]


class UserNoOrganizationFirstName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="UserNoOrganizationFirstName")]


class UserNoOrganizationLastName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="UserNoOrganizationLastName")]


class UserNoOrganization(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    workos_id: Annotated[str, Field(alias="workosId")]
    email: str
    display_name: Annotated[str, Field(alias="displayName")]
    first_name: Annotated[
        UserNoOrganizationFirstName | None,
        Field(alias="firstName", title="UserNoOrganizationFirstName"),
    ]
    last_name: Annotated[
        UserNoOrganizationLastName | None,
        Field(alias="lastName", title="UserNoOrganizationLastName"),
    ]
    display_photo_url: Annotated[str, Field(alias="displayPhotoUrl")]


class UserFirstName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="UserFirstName")]


class UserLastName(RootModel[str | None]):
    root: Annotated[str | None, Field(title="UserLastName")]


class User(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    workos_id: Annotated[str, Field(alias="workosId")]
    organization_id: Annotated[str, Field(alias="organizationId")]
    organization_name: Annotated[str, Field(alias="organizationName")]
    email: str
    display_name: Annotated[str, Field(alias="displayName")]
    first_name: Annotated[UserFirstName | None, Field(alias="firstName", title="UserFirstName")]
    last_name: Annotated[UserLastName | None, Field(alias="lastName", title="UserLastName")]
    display_photo_url: Annotated[str, Field(alias="displayPhotoUrl")]
    roles: list[Role]


class WebExtractToolInputUrls(RootModel[str | list[str]]):
    root: Annotated[
        str | list[str],
        Field(
            description="URL or list of URLs to extract content from",
            title="WebExtractToolInputUrls",
        ),
    ]


class WebExtractToolInputExtractDepth1(StrEnum):
    basic = "basic"
    advanced = "advanced"


class WebExtractToolInputExtractDepth(RootModel[WebExtractToolInputExtractDepth1 | None]):
    root: Annotated[
        WebExtractToolInputExtractDepth1 | None,
        Field(
            description="'advanced' handles JavaScript-heavy pages but is slower",
            title="WebExtractToolInputExtractDepth",
        ),
    ]


class WebExtractToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    urls: Annotated[
        WebExtractToolInputUrls,
        Field(
            description="URL or list of URLs to extract content from",
            title="WebExtractToolInputUrls",
        ),
    ]
    extract_depth: Annotated[
        WebExtractToolInputExtractDepth | None,
        Field(
            description="'advanced' handles JavaScript-heavy pages but is slower",
            title="WebExtractToolInputExtractDepth",
        ),
    ]


class WebExtractInput(RootModel[WebExtractToolInput]):
    root: WebExtractToolInput


class WebExtractResultItem(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    url: str
    raw_content: str


class WebExtractToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    results: list[WebExtractResultItem]
    failed_results: Any


class WebExtractOutput(RootModel[WebExtractToolOutput]):
    root: WebExtractToolOutput


class WebResearchToolInputModel1(StrEnum):
    mini = "mini"
    pro = "pro"
    auto = "auto"


class WebResearchToolInputModel(RootModel[WebResearchToolInputModel1 | None]):
    root: Annotated[
        WebResearchToolInputModel1 | None,
        Field(
            description="'mini' for quick focused research, 'pro' for comprehensive multi-angle research, 'auto' picks automatically",
            title="WebResearchToolInputModel",
        ),
    ]


class WebResearchToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    input: Annotated[str, Field(description="The research question or topic to investigate")]
    model: Annotated[
        WebResearchToolInputModel | None,
        Field(
            description="'mini' for quick focused research, 'pro' for comprehensive multi-angle research, 'auto' picks automatically",
            title="WebResearchToolInputModel",
        ),
    ]


class WebResearchInput(RootModel[WebResearchToolInput]):
    root: WebResearchToolInput


class WebResearchSource(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    title: str
    url: str


class WebResearchToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryAction] | None = None
    status: Literal["completed"] = "completed"
    request_id: str
    content: str | None = None
    sources: list[WebResearchSource] | None = None


class WebResearchOutput(RootModel[WebResearchToolOutput]):
    root: WebResearchToolOutput


class WebSearchResultItem(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    title: str
    url: str
    content: str
    score: float


class WebSearchToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    query: str
    answer: str | None = None
    results: list[WebSearchResultItem]


class WebSearchOutput(RootModel[WebSearchToolOutput]):
    root: WebSearchToolOutput


class WebSearchToolInputMaxResults1(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Number of results to return (default 5)",
            ge=1,
            le=10,
            title="WebSearchToolInputMaxResults",
        ),
    ]


class WebSearchToolInputMaxResults(RootModel[WebSearchToolInputMaxResults1 | None]):
    root: Annotated[
        WebSearchToolInputMaxResults1 | None,
        Field(
            description="Number of results to return (default 5)",
            title="WebSearchToolInputMaxResults",
        ),
    ]


class WebSearchToolInputSearchDepth(RootModel[WebExtractToolInputExtractDepth1 | None]):
    root: Annotated[
        WebExtractToolInputExtractDepth1 | None,
        Field(
            description="'basic' is faster, 'advanced' is more thorough (default 'basic')",
            title="WebSearchToolInputSearchDepth",
        ),
    ]


class WebSearchToolInputIncludeAnswer(RootModel[bool | None]):
    root: Annotated[
        bool | None,
        Field(
            description="Include an LLM-generated answer summarizing the results (default false)",
            title="WebSearchToolInputIncludeAnswer",
        ),
    ]


class WebSearchToolInputTopic1(StrEnum):
    general = "general"
    news = "news"


class WebSearchToolInputTopic(RootModel[WebSearchToolInputTopic1 | None]):
    root: Annotated[
        WebSearchToolInputTopic1 | None,
        Field(
            description="'news' for recent news articles, 'general' for all web content (default 'general')",
            title="WebSearchToolInputTopic",
        ),
    ]


class WebSearchToolInputTimeRange1(StrEnum):
    day = "day"
    week = "week"
    month = "month"
    year = "year"


class WebSearchToolInputTimeRange(RootModel[WebSearchToolInputTimeRange1 | None]):
    root: Annotated[
        WebSearchToolInputTimeRange1 | None,
        Field(description="Filter results by recency", title="WebSearchToolInputTimeRange"),
    ]


class WebSearchToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    query: Annotated[str, Field(description="The search query")]
    max_results: Annotated[
        WebSearchToolInputMaxResults | None,
        Field(
            description="Number of results to return (default 5)",
            title="WebSearchToolInputMaxResults",
        ),
    ]
    search_depth: Annotated[
        WebSearchToolInputSearchDepth | None,
        Field(
            description="'basic' is faster, 'advanced' is more thorough (default 'basic')",
            title="WebSearchToolInputSearchDepth",
        ),
    ]
    include_answer: Annotated[
        WebSearchToolInputIncludeAnswer | None,
        Field(
            description="Include an LLM-generated answer summarizing the results (default false)",
            title="WebSearchToolInputIncludeAnswer",
        ),
    ]
    topic: Annotated[
        WebSearchToolInputTopic | None,
        Field(
            description="'news' for recent news articles, 'general' for all web content (default 'general')",
            title="WebSearchToolInputTopic",
        ),
    ]
    time_range: Annotated[
        WebSearchToolInputTimeRange | None,
        Field(description="Filter results by recency", title="WebSearchToolInputTimeRange"),
    ]


class WebhookWorkOSTriggerParams(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]


class WorkosWebhookSecretUpdateRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    webhook_secret: Annotated[str, Field(alias="webhookSecret")]
    state: str | None = None


class FieldSchema0(Model):
    pass


class NotionQueryPageToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    page_id: str
    object: str
    url: str | None = None
    public_url: Annotated[
        NotionQueryPageToolOutputPublicUrl | None,
        Field(title="NotionQueryPageToolOutputPublicUrl"),
    ] = None
    created_time: str | None = None
    last_edited_time: str | None = None
    archived: bool | None = None
    icon: Annotated[
        NotionQueryPageToolOutputIcon | None,
        Field(title="NotionQueryPageToolOutputIcon"),
    ] = None
    cover: Annotated[
        NotionQueryPageToolOutputCover | None,
        Field(title="NotionQueryPageToolOutputCover"),
    ] = None
    parent: NotionPageParent | None = None
    created_by: NotionUserReference | None = None
    last_edited_by: NotionUserReference | None = None
    in_trash: bool | None = None
    success: Literal[True] = True
    actions: list[RunHistoryAction] | None = None
    properties: dict[str, NotionReadablePropertyValue | None]
    properties_raw: dict[str, Any] | None = None
    blocks: list[FieldSchema0]
    blocks_count: Annotated[
        NotionQueryPageToolOutputBlocksCount,
        Field(title="NotionQueryPageToolOutputBlocksCount"),
    ]


NotionPageBlock.model_rebuild()
