# AUTO-GENERATED - DO NOT EDIT. Run 'pnpm run generate:python-types' to regenerate.
# ruff: noqa: E501

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import AwareDatetime, ConfigDict, Discriminator, EmailStr, Field, RootModel

from terse_sdk.types._base import TerseModel


class Model(RootModel[Any]):
    root: Any


class AttioIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    workspace_name: Annotated[str | None, Field(alias="workspaceName")] = None


class AttioOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["attio"], Field(alias="integrationType")] = "attio"
    config_type: Annotated[Literal["attio_output"], Field(alias="configType")] = "attio_output"
    object_slug: Annotated[str | None, Field(alias="objectSlug")]


class ConfigTypeEnum(StrEnum):
    gmail = "gmail"
    gmail_output = "gmail_output"
    gmail_draft_output = "gmail_draft_output"
    slack = "slack"
    slack_output = "slack_output"
    notion = "notion"
    linear_input = "linear_input"
    linear_output = "linear_output"
    github = "github"
    posthog = "POSTHOG"
    datadog = "DATADOG"
    time_trigger = "time_trigger"
    launchdarkly = "launchdarkly"
    terse = "terse"
    workos_input = "workos_input"
    workos_output = "workos_output"
    attio_output = "attio_output"
    snowflake_output = "snowflake_output"
    webhook_input = "webhook_input"


class IntegrationTypeEnum(StrEnum):
    github = "github"
    gmail = "gmail"
    linear = "linear"
    slack = "slack"
    notion = "notion"
    terse = "terse"
    posthog = "posthog"
    datadog = "datadog"
    cron_job = "cron_job"
    launchdarkly = "launchdarkly"
    workos = "workos"
    attio = "attio"
    snowflake = "snowflake"
    webhook = "webhook"


class ConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[IntegrationTypeEnum, Field(alias="integrationType")]
    config_type: Annotated[ConfigTypeEnum, Field(alias="configType")]


class DatadogConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["datadog"], Field(alias="integrationType")] = "datadog"
    config_type: Annotated[Literal["DATADOG"], Field(alias="configType")] = "DATADOG"
    default_indexes: Annotated[list[str], Field(alias="defaultIndexes")]


class DatadogIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    region: str


class GitHubEventType(StrEnum):
    push = "push"
    pull_request_opened = "pull_request.opened"
    pull_request_merged = "pull_request.merged"
    pull_request_closed = "pull_request.closed"
    pull_request_synchronize = "pull_request.synchronize"


class GitHubConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["github"], Field(alias="integrationType")] = "github"
    config_type: Annotated[Literal["github"], Field(alias="configType")] = "github"
    repository_ids: Annotated[list[int], Field(alias="repositoryIds")]
    event_types: Annotated[list[GitHubEventType] | None, Field(alias="eventTypes")]


class GitHubSkillConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["github"], Field(alias="integrationType")] = "github"
    config_type: Annotated[Literal["github"], Field(alias="configType")] = "github"
    repository_ids: Annotated[list[int], Field(alias="repositoryIds")]


class GithubIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    installation_id: int
    account_name: str | None = None


class FileDiff(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    filename: str
    diff: str


class Commit(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    sha: str
    message: str | None = None
    name: str
    file_diffs: Annotated[list[FileDiff], Field(alias="fileDiffs")]


class PullRequestUser(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    login: str
    email: str | None = None


class PullRequestRef(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    ref: str
    sha: str


class PullRequestState(StrEnum):
    open = "open"
    closed = "closed"


class PullRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    number: float
    title: str
    body: str | None = None
    state: PullRequestState
    merged: bool
    head: PullRequestRef
    base: PullRequestRef
    user: PullRequestUser
    author: PullRequestUser | None = None
    url: str | None = None


class Sender(PullRequestUser):
    pass


class GithubRepository(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: float
    name: str
    owner: str
    default_branch: Annotated[str, Field(alias="defaultBranch")]


class GithubPRClosedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["github"], Field(alias="integrationType")] = "github"
    username: str
    installation_id: Annotated[float, Field(alias="installationId")]
    repository_name: Annotated[str, Field(alias="repositoryName")]
    repository: GithubRepository
    sender: Sender
    pull_request: Annotated[PullRequest, Field(alias="pullRequest")]
    branch: str | None = None
    commits: list[Commit]
    event_type: Annotated[Literal["pull_request.closed"], Field(alias="eventType")] = "pull_request.closed"


class GithubPRMergedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["github"], Field(alias="integrationType")] = "github"
    username: str
    installation_id: Annotated[float, Field(alias="installationId")]
    repository_name: Annotated[str, Field(alias="repositoryName")]
    repository: GithubRepository
    sender: Sender
    pull_request: Annotated[PullRequest, Field(alias="pullRequest")]
    branch: str | None = None
    commits: list[Commit]
    event_type: Annotated[Literal["pull_request.merged"], Field(alias="eventType")] = "pull_request.merged"


class GithubPROpenedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["github"], Field(alias="integrationType")] = "github"
    username: str
    installation_id: Annotated[float, Field(alias="installationId")]
    repository_name: Annotated[str, Field(alias="repositoryName")]
    repository: GithubRepository
    sender: Sender
    pull_request: Annotated[PullRequest, Field(alias="pullRequest")]
    branch: str | None = None
    commits: list[Commit]
    event_type: Annotated[Literal["pull_request.opened"], Field(alias="eventType")] = "pull_request.opened"


class GithubPRSynchronizedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["github"], Field(alias="integrationType")] = "github"
    username: str
    installation_id: Annotated[float, Field(alias="installationId")]
    repository_name: Annotated[str, Field(alias="repositoryName")]
    repository: GithubRepository
    sender: Sender
    pull_request: Annotated[PullRequest, Field(alias="pullRequest")]
    branch: str | None = None
    commits: list[Commit]
    event_type: Annotated[Literal["pull_request.synchronize"], Field(alias="eventType")] = "pull_request.synchronize"


class GithubPRTrigger(
    RootModel[GithubPROpenedTrigger | GithubPRSynchronizedTrigger | GithubPRClosedTrigger | GithubPRMergedTrigger]
):
    root: GithubPROpenedTrigger | GithubPRSynchronizedTrigger | GithubPRClosedTrigger | GithubPRMergedTrigger


class GithubPushTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["github"], Field(alias="integrationType")] = "github"
    username: str
    installation_id: Annotated[float, Field(alias="installationId")]
    repository_name: Annotated[str, Field(alias="repositoryName")]
    repository: GithubRepository
    sender: Sender
    event_type: Annotated[Literal["push"], Field(alias="eventType")] = "push"
    branch: str
    commits: list[Commit]
    pull_request: Annotated[Any | None, Field(alias="pullRequest")] = None


class GithubTrigger(
    RootModel[
        Annotated[
            GithubPushTrigger
            | GithubPROpenedTrigger
            | GithubPRSynchronizedTrigger
            | GithubPRClosedTrigger
            | GithubPRMergedTrigger,
            Discriminator("event_type"),
        ]
    ]
):
    root: Annotated[
        GithubPushTrigger
        | GithubPROpenedTrigger
        | GithubPRSynchronizedTrigger
        | GithubPRClosedTrigger
        | GithubPRMergedTrigger,
        Discriminator("event_type"),
    ]


class GmailEventType(StrEnum):
    email_received = "email.received"


class GmailConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["gmail"], Field(alias="integrationType")] = "gmail"
    config_type: Annotated[Literal["gmail"], Field(alias="configType")] = "gmail"
    event_types: Annotated[list[GmailEventType] | None, Field(alias="eventTypes")]


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


class GmailParsedAttachment(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    attachment_id: Annotated[str, Field(alias="attachmentId")]
    filename: str
    mime_type: Annotated[str, Field(alias="mimeType")]
    content_id: Annotated[str | None, Field(alias="contentId")] = None
    is_inline: Annotated[bool, Field(alias="isInline")]


class IntegrationInstance(TerseModel):
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


class LinearInputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["linear"], Field(alias="integrationType")] = "linear"
    config_type: Annotated[Literal["linear_input"], Field(alias="configType")] = "linear_input"
    team_id: Annotated[str | None, Field(alias="teamId")]
    project_id: Annotated[str | None, Field(alias="projectId")]
    event_types: Annotated[list[LinearEventType] | None, Field(alias="eventTypes")]


class LinearIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    workspace_name: Annotated[str, Field(alias="workspaceName")]


class LinearOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["linear"], Field(alias="integrationType")] = "linear"
    config_type: Annotated[Literal["linear_output"], Field(alias="configType")] = "linear_output"
    team_id: Annotated[str | None, Field(alias="teamId")]
    team_name: Annotated[str | None, Field(alias="teamName")]
    project_id: Annotated[str | None, Field(alias="projectId")]


class LinearWebhookAction(StrEnum):
    create = "create"
    update = "update"
    remove = "remove"


class LinearWebhookActor(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    email: str
    url: str
    type: str


class LinearWebhookAssignee(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str


class LinearWebhookCommentData(TerseModel):
    id: str
    body: str | None = None
    issue_id: Annotated[str | None, Field(alias="issueId")] = None


class LinearWebhookTeam(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    key: str
    name: str


class LinearWebhookState(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    color: str
    name: str
    type: str


class LinearWebhookData(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    created_at: Annotated[str, Field(alias="createdAt")]
    updated_at: Annotated[str, Field(alias="updatedAt")]
    number: float
    title: str
    priority: float
    sort_order: Annotated[float, Field(alias="sortOrder")]
    priority_sort_order: Annotated[float, Field(alias="prioritySortOrder")]
    sla_type: Annotated[str, Field(alias="slaType")]
    added_to_team_at: Annotated[str, Field(alias="addedToTeamAt")]
    trashed: bool
    label_ids: Annotated[list[str], Field(alias="labelIds")]
    team_id: Annotated[str, Field(alias="teamId")]
    previous_identifiers: Annotated[list[str], Field(alias="previousIdentifiers")]
    state_id: Annotated[str, Field(alias="stateId")]
    reaction_data: Annotated[list[Any], Field(alias="reactionData")]
    priority_label: Annotated[str, Field(alias="priorityLabel")]
    bot_actor: Annotated[str | None, Field(alias="botActor")] = None
    identifier: str
    url: str
    subscriber_ids: Annotated[list[str], Field(alias="subscriberIds")]
    state: LinearWebhookState
    team: LinearWebhookTeam
    labels: list[Any]
    description: str | None = None
    description_data: Annotated[str | None, Field(alias="descriptionData")] = None
    assignee: LinearWebhookAssignee | None = None
    project_id: Annotated[str | None, Field(alias="projectId")] = None


class LinearWebhookType(RootModel[Literal["Issue"] | Literal["Comment"] | Literal["Project"] | str]):
    root: Literal["Issue"] | Literal["Comment"] | Literal["Project"] | str


class NotionConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["notion"], Field(alias="integrationType")] = "notion"
    config_type: Annotated[Literal["notion"], Field(alias="configType")] = "notion"
    database_ids: Annotated[list[str], Field(alias="databaseIds")]
    database_names: Annotated[list[str], Field(alias="databaseNames")]
    page_ids: Annotated[list[str], Field(alias="pageIds")]
    page_names: Annotated[list[str], Field(alias="pageNames")]


class NotionIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    workspace_id: Annotated[str | None, Field(alias="workspaceId")] = None
    workspace_name: Annotated[str | None, Field(alias="workspaceName")] = None


class PosthogConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["posthog"], Field(alias="integrationType")] = "posthog"
    config_type: Annotated[Literal["POSTHOG"], Field(alias="configType")] = "POSTHOG"
    project_id: Annotated[str, Field(alias="projectId")]
    project_name: Annotated[str | None, Field(alias="projectName")]


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


class SlackConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["slack"], Field(alias="integrationType")] = "slack"
    config_type: Annotated[Literal["slack"], Field(alias="configType")] = "slack"
    channel_id: Annotated[str | None, Field(alias="channelId")]
    channel_name: Annotated[str | None, Field(alias="channelName")]
    listen_to_user_dms: Annotated[bool, Field(alias="listenToUserDms")]
    user_ids: Annotated[list[str] | None, Field(alias="userIds")]
    event_types: Annotated[list[SlackEventType] | None, Field(alias="eventTypes")]


class SlackIntegrationInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    team_id: Annotated[str | None, Field(alias="teamId")] = None
    team_name: Annotated[str | None, Field(alias="teamName")] = None
    is_bot_user: Annotated[bool | None, Field(alias="isBotUser")] = None


class SlackOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["slack"], Field(alias="integrationType")] = "slack"
    config_type: Annotated[Literal["slack_output"], Field(alias="configType")] = "slack_output"
    channel_id: Annotated[str | None, Field(alias="channelId")]
    channel_name: Annotated[str | None, Field(alias="channelName")]
    user_ids: Annotated[list[str] | None, Field(alias="userIds")]
    user_names: Annotated[list[str] | None, Field(alias="userNames")]
    listen_to_user_dms: Annotated[bool, Field(alias="listenToUserDms")]


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


class ManualSampleTriggerType(RootModel[Literal["manual_sample"]]):
    root: Literal["manual_sample"] = "manual_sample"


class ManualSampleTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[IntegrationTypeEnum, Field(alias="integrationType")]
    event_type: Annotated[ManualSampleTriggerType, Field(alias="eventType")]


class CronTriggerType(RootModel[Literal["cron"]]):
    root: Literal["cron"] = "cron"


class CronTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["cron_job"], Field(alias="integrationType")] = "cron_job"
    event_type: Annotated[CronTriggerType, Field(alias="eventType")]
    input_id: Annotated[str, Field(alias="inputId")]
    is_manual_trigger: Annotated[bool | None, Field(alias="isManualTrigger")] = None
    manual_context: Annotated[str | None, Field(alias="manualContext")] = None


class WebhookTriggerType(RootModel[Literal["webhook"]]):
    root: Literal["webhook"] = "webhook"


class WebhookTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["webhook"], Field(alias="integrationType")] = "webhook"
    event_type: Annotated[WebhookTriggerType, Field(alias="eventType")]
    body: Any
    headers: dict[str, str]
    method: str


class WorkOSTriggerOrganization(LinearWebhookAssignee):
    pass


class WorkOSOrganizationTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["organization.created"], Field(alias="eventType")] = "organization.created"
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    organization: WorkOSTriggerOrganization


class WorkOSTriggerUser(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    email: str
    first_name: Annotated[str | None, Field(alias="firstName")] = None
    last_name: Annotated[str | None, Field(alias="lastName")] = None
    email_verified: Annotated[bool, Field(alias="emailVerified")]
    profile_picture_url: Annotated[str | None, Field(alias="profilePictureUrl")] = None


class WorkOSTriggerInvitation(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    email: str
    organization_id: Annotated[str, Field(alias="organizationId")]
    inviter_email: Annotated[str | None, Field(alias="inviterEmail")] = None
    state: str
    accepted_at: Annotated[str | None, Field(alias="acceptedAt")] = None


class WorkOSInvitationRevokedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["invitation.revoked"], Field(alias="eventType")] = "invitation.revoked"
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    invitation: WorkOSTriggerInvitation
    user: WorkOSTriggerUser | None = None


class WorkOSInvitationResentTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["invitation.resent"], Field(alias="eventType")] = "invitation.resent"
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    invitation: WorkOSTriggerInvitation
    user: WorkOSTriggerUser | None = None


class WorkOSInvitationAcceptedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["invitation.accepted"], Field(alias="eventType")] = "invitation.accepted"
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    invitation: WorkOSTriggerInvitation
    user: WorkOSTriggerUser | None = None


class WorkOSInvitationCreatedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["invitation.created"], Field(alias="eventType")] = "invitation.created"
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    invitation: WorkOSTriggerInvitation
    user: WorkOSTriggerUser | None = None


class WorkOSTriggerMembershipRole(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    slug: str


class WorkOSTriggerMembership(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    user_id: Annotated[str, Field(alias="userId")]
    organization_id: Annotated[str, Field(alias="organizationId")]
    role: WorkOSTriggerMembershipRole
    status: str


class WorkOSOrganizationMembershipDeletedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["organization_membership.deleted"], Field(alias="eventType")] = (
        "organization_membership.deleted"
    )
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    membership: WorkOSTriggerMembership


class WorkOSOrganizationMembershipUpdatedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["organization_membership.updated"], Field(alias="eventType")] = (
        "organization_membership.updated"
    )
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    membership: WorkOSTriggerMembership


class WorkOSOrganizationMembershipCreatedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["organization_membership.created"], Field(alias="eventType")] = (
        "organization_membership.created"
    )
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    membership: WorkOSTriggerMembership


class WorkOSUserDeletedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["user.deleted"], Field(alias="eventType")] = "user.deleted"
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    user: WorkOSTriggerUser


class WorkOSUserUpdatedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["user.updated"], Field(alias="eventType")] = "user.updated"
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    user: WorkOSTriggerUser


class WorkOSUserCreatedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    event_type: Annotated[Literal["user.created"], Field(alias="eventType")] = "user.created"
    event_id: Annotated[str, Field(alias="eventId")]
    created_at: Annotated[str, Field(alias="createdAt")]
    user: WorkOSTriggerUser


class WorkOSTrigger(
    RootModel[
        Annotated[
            WorkOSUserCreatedTrigger
            | WorkOSUserUpdatedTrigger
            | WorkOSUserDeletedTrigger
            | WorkOSOrganizationMembershipCreatedTrigger
            | WorkOSOrganizationMembershipUpdatedTrigger
            | WorkOSOrganizationMembershipDeletedTrigger
            | WorkOSInvitationCreatedTrigger
            | WorkOSInvitationAcceptedTrigger
            | WorkOSInvitationResentTrigger
            | WorkOSInvitationRevokedTrigger
            | WorkOSOrganizationTrigger,
            Discriminator("event_type"),
        ]
    ]
):
    root: Annotated[
        WorkOSUserCreatedTrigger
        | WorkOSUserUpdatedTrigger
        | WorkOSUserDeletedTrigger
        | WorkOSOrganizationMembershipCreatedTrigger
        | WorkOSOrganizationMembershipUpdatedTrigger
        | WorkOSOrganizationMembershipDeletedTrigger
        | WorkOSInvitationCreatedTrigger
        | WorkOSInvitationAcceptedTrigger
        | WorkOSInvitationResentTrigger
        | WorkOSInvitationRevokedTrigger
        | WorkOSOrganizationTrigger,
        Discriminator("event_type"),
    ]


class LinearCommentCreatedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["linear"], Field(alias="integrationType")] = "linear"
    action: Literal["create"] = "create"
    actor: LinearWebhookActor
    created_at: Annotated[str, Field(alias="createdAt")]
    url: str | None = None
    organization_id: Annotated[str, Field(alias="organizationId")]
    webhook_timestamp: Annotated[float, Field(alias="webhookTimestamp")]
    webhook_id: Annotated[str, Field(alias="webhookId")]
    event_type: Annotated[Literal["comment.created"], Field(alias="eventType")] = "comment.created"
    type: Literal["Comment"] = "Comment"
    data: LinearWebhookCommentData


class LinearIssueUpdatedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["linear"], Field(alias="integrationType")] = "linear"
    action: Literal["update"] = "update"
    actor: LinearWebhookActor
    created_at: Annotated[str, Field(alias="createdAt")]
    url: str | None = None
    organization_id: Annotated[str, Field(alias="organizationId")]
    webhook_timestamp: Annotated[float, Field(alias="webhookTimestamp")]
    webhook_id: Annotated[str, Field(alias="webhookId")]
    event_type: Annotated[Literal["issue.updated"], Field(alias="eventType")] = "issue.updated"
    type: Literal["Issue"] = "Issue"
    data: LinearWebhookData


class LinearIssueCreatedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["linear"], Field(alias="integrationType")] = "linear"
    action: Literal["create"] = "create"
    actor: LinearWebhookActor
    created_at: Annotated[str, Field(alias="createdAt")]
    url: str | None = None
    organization_id: Annotated[str, Field(alias="organizationId")]
    webhook_timestamp: Annotated[float, Field(alias="webhookTimestamp")]
    webhook_id: Annotated[str, Field(alias="webhookId")]
    event_type: Annotated[Literal["issue.created"], Field(alias="eventType")] = "issue.created"
    type: Literal["Issue"] = "Issue"
    data: LinearWebhookData


class LinearTrigger(
    RootModel[
        Annotated[
            LinearIssueCreatedTrigger | LinearIssueUpdatedTrigger | LinearCommentCreatedTrigger,
            Discriminator("event_type"),
        ]
    ]
):
    root: Annotated[
        LinearIssueCreatedTrigger | LinearIssueUpdatedTrigger | LinearCommentCreatedTrigger,
        Discriminator("event_type"),
    ]


class GmailTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["gmail"], Field(alias="integrationType")] = "gmail"
    event_type: Annotated[GmailEventType, Field(alias="eventType")]
    id: str
    thread_id: Annotated[str, Field(alias="threadId")]
    subject: str
    from_: Annotated[str, Field(alias="from")]
    to: str
    date: str
    internal_date: Annotated[str, Field(alias="internalDate")]
    message_id: Annotated[str, Field(alias="messageId")]
    body: str
    snippet: str
    label_ids: Annotated[list[str], Field(alias="labelIds")]
    attachments: list[GmailParsedAttachment] | None = None


class SlackReactionAddedTriggerChannelType(StrEnum):
    channel = "channel"
    group = "group"
    mpim = "mpim"
    im = "im"


class SlackReactionAddedTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["slack"], Field(alias="integrationType")] = "slack"
    event_type: Annotated[Literal["reaction_added"], Field(alias="eventType")] = "reaction_added"
    channel_id: Annotated[str, Field(alias="channelId")]
    channel_name: Annotated[str | None, Field(alias="channelName")]
    user_id: Annotated[str, Field(alias="userId")]
    user_name: Annotated[str | None, Field(alias="userName")]
    text: str
    timestamp: str
    thread_ts: Annotated[str | None, Field(alias="threadTs")] = None
    thread_timestamp: Annotated[str | None, Field(alias="threadTimestamp")]
    team_id: Annotated[str, Field(alias="teamId")]
    permalink: str | None
    channel_type: Annotated[SlackReactionAddedTriggerChannelType | None, Field(alias="channelType")]
    blocks: list[Any] | None
    attachments: list[Any] | None
    files: list[Any] | None
    reaction: str
    item_type: Annotated[str | None, Field(alias="itemType")]
    item_user_id: Annotated[str | None, Field(alias="itemUserId")]
    item_channel_id: Annotated[str | None, Field(alias="itemChannelId")]
    item_timestamp: Annotated[str | None, Field(alias="itemTimestamp")]


class SlackAppMentionTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["slack"], Field(alias="integrationType")] = "slack"
    event_type: Annotated[Literal["app_mention"], Field(alias="eventType")] = "app_mention"
    channel_id: Annotated[str, Field(alias="channelId")]
    channel_name: Annotated[str | None, Field(alias="channelName")]
    user_id: Annotated[str, Field(alias="userId")]
    user_name: Annotated[str | None, Field(alias="userName")]
    text: str
    timestamp: str
    thread_ts: Annotated[str | None, Field(alias="threadTs")] = None
    thread_timestamp: Annotated[str | None, Field(alias="threadTimestamp")]
    team_id: Annotated[str, Field(alias="teamId")]
    permalink: str | None
    channel_type: Annotated[SlackReactionAddedTriggerChannelType | None, Field(alias="channelType")]
    blocks: list[Any] | None
    attachments: list[Any] | None
    files: list[Any] | None


class SlackMessageTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[Literal["slack"], Field(alias="integrationType")] = "slack"
    event_type: Annotated[Literal["message"], Field(alias="eventType")] = "message"
    channel_id: Annotated[str, Field(alias="channelId")]
    channel_name: Annotated[str | None, Field(alias="channelName")]
    user_id: Annotated[str, Field(alias="userId")]
    user_name: Annotated[str | None, Field(alias="userName")]
    text: str
    timestamp: str
    thread_ts: Annotated[str | None, Field(alias="threadTs")] = None
    thread_timestamp: Annotated[str | None, Field(alias="threadTimestamp")]
    team_id: Annotated[str, Field(alias="teamId")]
    permalink: str | None
    channel_type: Annotated[SlackReactionAddedTriggerChannelType | None, Field(alias="channelType")]
    blocks: list[Any] | None
    attachments: list[Any] | None
    files: list[Any] | None


class SlackTrigger(
    RootModel[
        Annotated[
            SlackMessageTrigger | SlackAppMentionTrigger | SlackReactionAddedTrigger,
            Discriminator("event_type"),
        ]
    ]
):
    root: Annotated[
        SlackMessageTrigger | SlackAppMentionTrigger | SlackReactionAddedTrigger,
        Discriminator("event_type"),
    ]


class Trigger(
    RootModel[
        SlackTrigger
        | GithubTrigger
        | GmailTrigger
        | LinearTrigger
        | WorkOSTrigger
        | WebhookTrigger
        | CronTrigger
        | ManualSampleTrigger
    ]
):
    root: (
        SlackTrigger
        | GithubTrigger
        | GmailTrigger
        | LinearTrigger
        | WorkOSTrigger
        | WebhookTrigger
        | CronTrigger
        | ManualSampleTrigger
    )


class TriggerArray(RootModel[list[Trigger]]):
    root: list[Trigger]


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


class TriggerType(
    RootModel[
        SlackEventType
        | GitHubEventType
        | LinearEventType
        | GmailEventType
        | WorkOSEventType
        | WebhookTriggerType
        | CronTriggerType
        | ManualSampleTriggerType
    ]
):
    root: (
        SlackEventType
        | GitHubEventType
        | LinearEventType
        | GmailEventType
        | WorkOSEventType
        | WebhookTriggerType
        | CronTriggerType
        | ManualSampleTriggerType
    )


class WebhookInputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[Literal["system"], Field(alias="integrationId")] = "system"
    integration_type: Annotated[Literal["webhook"], Field(alias="integrationType")] = "webhook"
    config_type: Annotated[Literal["webhook_input"], Field(alias="configType")] = "webhook_input"


class WorkOSInputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    config_type: Annotated[Literal["workos_input"], Field(alias="configType")] = "workos_input"
    event_types: Annotated[list[WorkOSEventType], Field(alias="eventTypes")]


class WorkOSIntegrationEnvironment(StrEnum):
    live = "live"
    test = "test"


class WorkOSIntegration(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    webhook_url: Annotated[str, Field(alias="webhookUrl")]
    environment: WorkOSIntegrationEnvironment


class WorkOSOutputConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]
    integration_type: Annotated[Literal["workos"], Field(alias="integrationType")] = "workos"
    config_type: Annotated[Literal["workos_output"], Field(alias="configType")] = "workos_output"


class WorkOSWebhookData(RootModel[dict[str, Any]]):
    root: dict[str, Any]


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


class RunHistoryActionBase(TerseModel):
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
    action: RunHistoryActionBase


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


class AgentActivityItem(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    agent_id: Annotated[str, Field(alias="agentId")]
    agent_name: Annotated[str, Field(alias="agentName")]
    run_count: Annotated[int, Field(alias="runCount")]


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
        | SlackConfigInstance
        | SlackOutputConfigInstance
        | GmailOutputConfigInstance
        | GmailDraftOutputConfigInstance
        | NotionConfigInstance
        | LinearInputConfigInstance
        | LinearOutputConfigInstance
        | GitHubConfigInstance
        | GitHubSkillConfigInstance
        | PosthogConfigInstance
        | DatadogConfigInstance
        | TimeTriggerConfigInstance
        | LaunchDarklyConfigInstance
        | TerseConfigInstance
        | WorkOSInputConfigInstance
        | WorkOSOutputConfigInstance
        | AttioOutputConfigInstance
        | SnowflakeOutputConfigInstance
        | WebhookInputConfigInstance
    ]
):
    root: (
        GmailConfigInstance
        | SlackConfigInstance
        | SlackOutputConfigInstance
        | GmailOutputConfigInstance
        | GmailDraftOutputConfigInstance
        | NotionConfigInstance
        | LinearInputConfigInstance
        | LinearOutputConfigInstance
        | GitHubConfigInstance
        | GitHubSkillConfigInstance
        | PosthogConfigInstance
        | DatadogConfigInstance
        | TimeTriggerConfigInstance
        | LaunchDarklyConfigInstance
        | TerseConfigInstance
        | WorkOSInputConfigInstance
        | WorkOSOutputConfigInstance
        | AttioOutputConfigInstance
        | SnowflakeOutputConfigInstance
        | WebhookInputConfigInstance
    )


class AgentOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    config: ConfigData


class TriggerMetadata(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    webhook_url: Annotated[str | None, Field(alias="webhookUrl")] = None


class AgentTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    config: ConfigData
    metadata: TriggerMetadata | None = None


class AgentPrompt(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    text: str
    remote_server_url: Annotated[str | None, Field(alias="remoteServerUrl")] = None


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
    notification_settings: Annotated[AgentNotificationSettings | None, Field(alias="notificationSettings")]
    tool_approvals: Annotated[list[str] | None, Field(alias="toolApprovals")]


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
    notification_settings: Annotated[AgentNotificationSettings | None, Field(alias="notificationSettings")]
    tool_approvals: Annotated[list[str] | None, Field(alias="toolApprovals")]
    id: str | None
    created_by_user_id: Annotated[str, Field(alias="createdByUserId")]


class AgentFileContentResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    path: str
    file_name: Annotated[str, Field(alias="fileName")]
    content_base64: Annotated[str, Field(alias="contentBase64")]
    mime_type: Annotated[str | None, Field(alias="mimeType")] = None


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


class AgentReview(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    automation_id: Annotated[str, Field(alias="automationId")]
    title: str
    summary: str
    runs_analyzed: Annotated[int, Field(alias="runsAnalyzed")]
    review_period_start: Annotated[str, Field(alias="reviewPeriodStart")]
    review_period_end: Annotated[str, Field(alias="reviewPeriodEnd")]
    created_at: Annotated[str, Field(alias="createdAt")]


class AgentSource(StrEnum):
    web_ui = "WEB_UI"
    sdk = "SDK"


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
    notification_settings: Annotated[AgentNotificationSettings | None, Field(alias="notificationSettings")]
    tool_approvals: Annotated[list[str] | None, Field(alias="toolApprovals")]
    updated_at: Annotated[str | None, Field(alias="updatedAt")]
    source: AgentSource | None


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
    notification_settings: Annotated[AgentNotificationSettings | None, Field(alias="notificationSettings")] = None
    tool_approvals: Annotated[list[str] | None, Field(alias="toolApprovals")] = None


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


class DatadogAggregationGroupBy(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    facet: Annotated[
        str,
        Field(description="Facet to group by (e.g., @view.name, @service, @browser.name)"),
    ]
    limit: Annotated[int, Field(description="Maximum number of groups to return (default: 10)")]
    total: Annotated[
        bool,
        Field(description='Include "total" group with all events combined (default: false)'),
    ]


class DatadogAggregationComputeAggregation(StrEnum):
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
        DatadogAggregationComputeAggregation,
        Field(description="Aggregation: count, pc90/pc95/pc99, avg, sum, min, max, cardinality"),
    ]
    metric: Annotated[
        str,
        Field(description='Metric to compute (e.g., @view.loading_time, @duration). Use "*" for count of all events.'),
    ]
    type: Annotated[
        DatadogAggregationComputeType,
        Field(description='Computation type: "total" (overall) or "timeseries" (time-bucketed)'),
    ]


class AggregateRumEventsToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    query: Annotated[
        str | None,
        Field(description="Datadog RUM search query to filter events before aggregation (e.g., @type:view)"),
    ] = None
    from_: Annotated[
        str,
        Field(alias="from", description='Start time (ISO8601 or relative like "now-15m")'),
    ]
    to: Annotated[
        str | None,
        Field(description='End time (ISO8601). Defaults to "now" if not provided.'),
    ] = None
    compute: Annotated[
        list[DatadogAggregationCompute],
        Field(description="Array of metrics to compute. At least one required."),
    ]
    group_by: Annotated[
        list[DatadogAggregationGroupBy] | None,
        Field(alias="groupBy", description="Facets to group results by"),
    ]
    timezone: Annotated[str, Field(description='Timezone for time-based queries (default: "GMT")')]
    page_limit: Annotated[
        int,
        Field(
            alias="pageLimit",
            description="Maximum number of buckets to return (default: 25)",
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


class DatadogPagePagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    limit: int
    next_cursor: Annotated[str | None, Field(alias="nextCursor")]
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


class AggregateRumEventsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    query: str | None
    from_: Annotated[str, Field(alias="from")]
    to: str | None
    compute: str
    group_by: Annotated[str, Field(alias="groupBy")]
    total_buckets: Annotated[int, Field(alias="totalBuckets")]
    buckets: list[DatadogAggregationBucket]
    rum_link: Annotated[str, Field(alias="rumLink")]
    pagination: DatadogPagePagination
    warnings: str | None
    meta: DatadogAggregationMeta
    message: str


class ApiTokenCreateRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: Annotated[str, Field(max_length=100)]


class ApiToken(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    token_prefix: Annotated[str, Field(alias="tokenPrefix")]
    created_at: Annotated[str, Field(alias="createdAt")]
    last_used_at: Annotated[str | None, Field(alias="lastUsedAt")]


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


class AttioListObjectsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    objects: list[AttioObjectWithAttributes]
    count: int


class AttioObject(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    api_slug: str
    singular_noun: str
    plural_noun: str


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
        str | None,
        Field(
            description='Optional Attio filter as a JSON string. Pass null for no filtering. Use shorthand (e.g. \'{"email_addresses":"test@example.com"}\') or verbose syntax with operators.'
        ),
    ]
    limit: Annotated[
        int | None,
        Field(description="Maximum number of records to return. Pass null to use the default of 20."),
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


class AttioQueryRecordsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    records: list[AttioRecord]
    count: int


class AttioUpsertError(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    index: int
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


class AttioUpsertRecordToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    records: list[AttioRecord] | None = None
    count: int | None = None
    requested_count: Annotated[int | None, Field(alias="requestedCount")] = None
    success_count: Annotated[int | None, Field(alias="successCount")] = None
    failure_count: Annotated[int | None, Field(alias="failureCount")] = None
    partial: bool | None = None
    errors: list[AttioUpsertError] | None = None


class BaseTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[IntegrationTypeEnum, Field(alias="integrationType")]
    event_type: Annotated[TriggerType, Field(alias="eventType")]


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
    id: str | None = None
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


class MultipleChoiceOption(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    label: str
    value: str


class ChatSnippetButton(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["button"] = "button"
    label: str
    url: str
    id: str | None = None
    step_id: str | None = None
    selected_value: Annotated[str | None, Field(alias="selectedValue")] = None


class ChatSnippetIntegrationPrompt(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["integration_prompt"] = "integration_prompt"
    integration: str
    message: str
    state_token: Annotated[str | None, Field(alias="stateToken")] = None
    id: str | None = None
    step_id: str | None = None
    selected_value: Annotated[str | None, Field(alias="selectedValue")] = None


class ChatSnippetNavigate(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["navigate"] = "navigate"
    path: str
    id: str | None = None
    step_id: str | None = None
    selected_value: Annotated[str | None, Field(alias="selectedValue")] = None


class ChatSnippetMultipleChoice(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["multiple_choice"] = "multiple_choice"
    question_id: Annotated[str, Field(alias="questionId")]
    question: str
    options: list[MultipleChoiceOption]
    allow_multiple: Annotated[bool | None, Field(alias="allowMultiple")] = None
    id: str | None = None
    step_id: str | None = None
    selected_value: Annotated[str | None, Field(alias="selectedValue")] = None


class ChatSnippetImage(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["image"] = "image"
    url: str
    id: str | None = None
    step_id: str | None = None
    selected_value: Annotated[str | None, Field(alias="selectedValue")] = None


class ChatSnippet(
    RootModel[
        ChatSnippetButton
        | ChatSnippetIntegrationPrompt
        | ChatSnippetNavigate
        | ChatSnippetMultipleChoice
        | ChatSnippetImage
    ]
):
    root: (
        ChatSnippetButton
        | ChatSnippetIntegrationPrompt
        | ChatSnippetNavigate
        | ChatSnippetMultipleChoice
        | ChatSnippetImage
    )


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


class CountByString(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    label: str
    count: int


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


class DailyEventCount(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    date: str
    events: int


class DatadogCursorPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    limit: int
    cursor: str | None = None
    next_cursor: Annotated[str | None, Field(alias="nextCursor")]
    has_more: Annotated[bool, Field(alias="hasMore")]
    showing: str


class DatadogIndex(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    is_enabled: Annotated[bool, Field(alias="isEnabled")]
    daily_limit: Annotated[int | None, Field(alias="dailyLimit")] = None
    retention_days: Annotated[int | None, Field(alias="retentionDays")] = None


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


class DatadogRumResourceDetails(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str | None = None
    type: str | None = None
    url: str | None = None
    method: str | None = None
    status_code: Annotated[int | None, Field(alias="statusCode")] = None
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


class DatadogRumEvent(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    type: str
    timestamp: str | None = None
    session: DatadogRumSessionDetails | None = None
    view: DatadogRumViewDetails | dict[str, Any] | None = None
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


class DeviceTokenExchangeUser(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    email: str
    first_name: Annotated[str | None, Field(alias="firstName")]
    display_name: Annotated[str | None, Field(alias="displayName")]


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


class FilterResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    is_relevant: Annotated[bool, Field(alias="isRelevant")]
    reason: str
    confidence: float
    step_id: str
    type: Literal["FilterResult"] = "FilterResult"
    id: str | None = None
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


class GetAgentImprovementsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    review: AgentReview | None
    improvements: list[AgentImprovement]
    improvements_enabled: Annotated[bool, Field(alias="improvementsEnabled")]


class GetGithubRepositoriesForIntegrationRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )


class Repository(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    owner: str
    id: int


class GetGithubRepositoriesForIntegrationResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    repositories: list[Repository]


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
        str | None,
        Field(
            alias="environmentKey",
            description="Optional: Specific environment to get details for (if not provided, returns all configured environments).",
        ),
    ] = None
    include_history: Annotated[
        bool,
        Field(
            alias="includeHistory",
            description="If true, includes change history for the flag over the specified time window.",
        ),
    ]
    before: Annotated[
        str | None,
        Field(
            description="Optional: ISO date - only return history entries before this date (only used if includeHistory is true)."
        ),
    ] = None
    after: Annotated[
        str | None,
        Field(
            description="Optional: ISO date - only return history entries after this date (only used if includeHistory is true)."
        ),
    ] = None
    history_limit: Annotated[
        int,
        Field(
            alias="historyLimit",
            description="Number of history entries to return if includeHistory is true (default: 20, max: 20).",
        ),
    ]


class GetLaunchDarklyFlagDetailsInput(RootModel[GetLaunchDarklyFlagDetailsToolInput]):
    root: GetLaunchDarklyFlagDetailsToolInput


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
    member: dict[str, Any] | None
    changes: list[dict[str, Any]]


class LaunchDarklyHistoryResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    entries: list[LaunchDarklyHistoryEntry]
    total_entries: Annotated[int, Field(alias="totalEntries")]
    url: str


class LaunchDarklyEnvironmentConfigInstance(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    on: bool
    targets: list[dict[str, Any]]
    context_targets: Annotated[list[dict[str, Any]], Field(alias="contextTargets")]
    rules: list[dict[str, Any]]
    fallthrough: dict[str, Any] | None
    off_variation: Annotated[int | None, Field(alias="offVariation")]
    prerequisites: list[dict[str, Any]]


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
    maintainer_id: Annotated[str | None, Field(alias="maintainerId")]


class GetLaunchDarklyFlagDetailsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    project_key: Annotated[str, Field(alias="projectKey")]
    flag: LaunchDarklyFlagMetadata
    environments: dict[str, LaunchDarklyEnvironmentConfigInstance]
    url: str
    history: LaunchDarklyHistoryResult | None = None
    message: str


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
        float | None,
        Field(
            alias="startSeconds",
            description="Optional: Start time in seconds from the beginning of the session. If not provided, starts from the beginning.",
        ),
    ] = None
    end_seconds: Annotated[
        float | None,
        Field(
            alias="endSeconds",
            description="Optional: End time in seconds from the beginning of the session. If not provided, goes until the end.",
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


class PosthogSessionEventsSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    total_raw_events: Annotated[int, Field(alias="totalRawEvents")]
    meaningful_events_returned: Annotated[int, Field(alias="meaningfulEventsReturned")]
    console_logs_returned: Annotated[int, Field(alias="consoleLogsReturned")]


class PosthogSessionEventsTimeWindow(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    start_seconds: Annotated[float, Field(alias="startSeconds")]
    end_seconds: Annotated[float | None, Field(alias="endSeconds")]


class GetPosthogSessionEventsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
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


class WorkOSUserSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    email: str
    email_verified: Annotated[bool, Field(alias="emailVerified")]
    first_name: Annotated[str | None, Field(alias="firstName")] = None
    last_name: Annotated[str | None, Field(alias="lastName")] = None
    profile_picture_url: Annotated[str | None, Field(alias="profilePictureUrl")] = None
    created_at: Annotated[str, Field(alias="createdAt")]
    updated_at: Annotated[str, Field(alias="updatedAt")]


class GetWorkOSUserToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    user: WorkOSUserSummary
    message: str


class GitHubCodeGrepResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    index: int
    repository: str
    file: str
    url: str
    matches: str


class GitHubCodeSearchResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    index: int
    repository: str
    path: str
    url: str
    snippets: str


class GitHubCommitListSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    total: int
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


class GitHubFileEntry(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str | None = None
    path: str
    type: Literal["file"] = "file"
    size: int | None = None


class GitHubOtherEntry(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    type: str


class GitHubPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    page: int
    per_page: Annotated[int, Field(alias="perPage")]
    has_more: Annotated[bool, Field(alias="hasMore")]


class GitHubPullRequestListSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    total: int
    merged: int
    open: int
    closed: int


class GitHubPullRequestRef(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    number: int
    title: str
    state: str
    merged: bool
    base_branch: Annotated[str, Field(alias="baseBranch")]
    head_branch: Annotated[str, Field(alias="headBranch")]
    url: str


class GitHubPullRequestSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    number: int
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


class GithubAppInstallationCallbackRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    name: str
    email: str
    username: str
    installation_id: Annotated[int, Field(alias="installationId")]
    account_name: Annotated[str | None, Field(alias="accountName")]
    repositories: list[Repository]


class GmailHeader(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    key: str
    value: str


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
        str | None,
        Field(
            description="Plain text email body content. Do not include image URLs here — images cannot be embedded in plain text."
        ),
    ] = None
    html_body: Annotated[
        str | None,
        Field(
            description='HTML email body content. If provided with body, sends multipart/alternative. NEVER use <img src="https://..."> with remote URLs — they will expire. Images must be passed via image_urls and referenced as <img src="cid:image-1.png">.'
        ),
    ] = None
    thread_id: Annotated[
        str | None,
        Field(
            description="Gmail Thread ID (numeric string from the email event, NOT the Message-ID header). Omit for new drafts."
        ),
    ] = None
    cc: Annotated[
        str | None,
        Field(description="CC recipient email address(es). Multiple addresses can be comma-separated."),
    ] = None
    bcc: Annotated[
        str | None,
        Field(description="BCC recipient email address(es). Multiple addresses can be comma-separated."),
    ] = None
    image_urls: Annotated[
        list[str] | None,
        Field(
            description='URLs of images to embed in the email. Must be signed URLs from our internal GCS image bucket. Each image is downloaded and base64-encoded as an inline MIME attachment with a Content-ID. Images are assigned sequential filenames: image-1.png, image-2.png, etc. (extension reflects actual MIME type). You MUST reference each one in html_body as <img src="cid:image-1.png">, <img src="cid:image-2.png">, etc. Do NOT put the raw URLs in html_body.'
        ),
    ] = None
    custom_headers: Annotated[
        list[GmailHeader] | None,
        Field(
            description='Custom email headers as key-value pairs. Useful for adding headers like List-Unsubscribe, List-Unsubscribe-Post, X-Priority, etc. Example: {"List-Unsubscribe": "<mailto:unsubscribe@example.com>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}'
        ),
    ] = None


class GmailCreateDraftInput(RootModel[GmailCreateDraftToolInput]):
    root: GmailCreateDraftToolInput


class GmailCreateDraftToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
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
        str | None,
        Field(
            description="Plain text email body content. Do not include image URLs here — images cannot be embedded in plain text."
        ),
    ] = None
    html_body: Annotated[
        str | None,
        Field(
            description='HTML email body content. If provided with body, sends multipart/alternative. NEVER use <img src="https://..."> with remote URLs — they will expire. Images must be passed via image_urls and referenced as <img src="cid:image-1.png">.'
        ),
    ] = None
    thread_id: Annotated[
        str | None,
        Field(
            description="Gmail Thread ID (numeric string from the email event, NOT the Message-ID header). Omit for new emails."
        ),
    ] = None
    cc: Annotated[
        str | None,
        Field(description="CC recipient email address(es). Multiple addresses can be comma-separated."),
    ] = None
    bcc: Annotated[
        str | None,
        Field(description="BCC recipient email address(es). Multiple addresses can be comma-separated."),
    ] = None
    image_urls: Annotated[
        list[str] | None,
        Field(
            description='URLs of images to embed in the email. Must be signed URLs from our internal GCS image bucket. Each image is downloaded and base64-encoded as an inline MIME attachment with a Content-ID. Images are assigned sequential filenames: image-1.png, image-2.png, etc. (extension reflects actual MIME type). You MUST reference each one in html_body as <img src="cid:image-1.png">, <img src="cid:image-2.png">, etc. Do NOT put the raw URLs in html_body.'
        ),
    ] = None
    custom_headers: Annotated[
        list[GmailHeader] | None,
        Field(
            description='Custom email headers as key-value pairs. Useful for adding headers like List-Unsubscribe, List-Unsubscribe-Post, X-Priority, etc. Example: {"List-Unsubscribe": "<mailto:unsubscribe@example.com>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}'
        ),
    ] = None


class GmailSendEmailInput(RootModel[GmailSendEmailToolInput]):
    root: GmailSendEmailToolInput


class GmailSendEmailToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
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


class GrepGitHubCodeToolInputPage(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            ge=1,
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
        str | None,
        Field(
            alias="fileExtension",
            description='Filter by file extension (e.g., "ts", "js", "py"). Do not include the dot. Use null to search all file types.',
        ),
    ] = None
    path: Annotated[
        str | None,
        Field(
            description='Filter by directory path (e.g., "src/services" to only search in that directory). Use null to search everywhere.'
        ),
    ] = None
    per_page: Annotated[
        int,
        Field(
            alias="perPage",
            description="Number of results to return (default: 20, max: 100)",
        ),
    ]
    page: Annotated[
        GrepGitHubCodeToolInputPage | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1."
        ),
    ]


class GrepGitHubCodeInput(RootModel[GrepGitHubCodeToolInput]):
    root: GrepGitHubCodeToolInput


class GrepGitHubCodeToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    total_count: Annotated[int, Field(alias="totalCount")]
    results_returned: Annotated[int, Field(alias="resultsReturned")]
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


class ImageEditSnippet(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["image"] = "image"
    url: str


class ImageEditToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    url: str
    image_url: str
    summary: str
    snippets: list[ImageEditSnippet]


class ImageEditOutput(RootModel[ImageEditToolOutput]):
    root: ImageEditToolOutput


class Image(ImageEditSnippet):
    pass


class IntegrationFieldsResponseInstallationType(StrEnum):
    form = "form"
    oauth = "oauth"


class IntegrationFieldsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    installation_type: Annotated[IntegrationFieldsResponseInstallationType, Field(alias="installationType")]
    fields: list[FormFieldDefinition] | list[ConfigurationFieldDefinition]


class IntegrationPrompt(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["integration_prompt"] = "integration_prompt"
    integration: str
    message: str
    state_token: Annotated[str | None, Field(alias="stateToken")] = None


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


class LinearCommentHandle(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    body: str | None = None
    created_at: Annotated[str | AwareDatetime | None, Field(alias="createdAt")] = None
    updated_at: Annotated[str | AwareDatetime | None, Field(alias="updatedAt")] = None


class LinearAddCommentToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    comment: LinearCommentHandle


class LinearCreateTicketPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    title: str
    team_id: Annotated[str, Field(alias="teamId")]
    description: str | None = None
    state_id: Annotated[str | None, Field(alias="stateId")] = None
    priority: int | None = None
    project_id: Annotated[str | None, Field(alias="projectId")] = None
    label_ids: Annotated[list[str] | None, Field(alias="labelIds")] = None
    assignee_id: Annotated[str | None, Field(alias="assigneeId")] = None


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


class LinearIssueHandle(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    identifier: str
    title: str
    description: str | None = None
    url: str
    created_at: Annotated[str | AwareDatetime | None, Field(alias="createdAt")] = None
    updated_at: Annotated[str | AwareDatetime | None, Field(alias="updatedAt")] = None


class LinearCreateTicketToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    issue: LinearIssueHandle


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
        str | None,
        Field(
            alias="teamId",
            description="Optional team ID to limit results to that team's labels.",
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
    actions: list[RunHistoryActionBase] | None = None
    labels: list[LinearLabelSummary]


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
        str | None,
        Field(
            alias="teamId",
            description="Optional team ID to limit results to that team's projects.",
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
    actions: list[RunHistoryActionBase] | None = None
    projects: list[LinearProjectSummary]


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
        str | None,
        Field(
            alias="teamId",
            description="Optional team ID to limit results to that team's states.",
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
    actions: list[RunHistoryActionBase] | None = None
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


class LinearTeam(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    key: str


class LinearGetTeamsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
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
    actions: list[RunHistoryActionBase] | None = None
    users: list[LinearUserSummary]


class LinearIssueAssignee(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    email: str | None = None


class LinearIssueProject(LinearWebhookAssignee):
    pass


class LinearIssueDetail(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    identifier: str
    title: str
    description: str | None = None
    state: str
    priority: int | None = None
    assignee: LinearIssueAssignee | None
    url: str
    created_at: Annotated[str | AwareDatetime, Field(alias="createdAt")]
    updated_at: Annotated[str | AwareDatetime, Field(alias="updatedAt")]
    team: LinearTeam | None
    project: LinearIssueProject | None
    due_date: Annotated[str | AwareDatetime | None, Field(alias="dueDate")] = None
    estimate: float | None = None


class LinearIssueSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    identifier: str
    title: str
    description: str | None = None
    state: str
    priority: int | None = None
    assignee: LinearIssueAssignee | None
    url: str
    created_at: Annotated[str | AwareDatetime, Field(alias="createdAt")]
    updated_at: Annotated[str | AwareDatetime, Field(alias="updatedAt")]


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
        bool | None,
        Field(
            alias="includeComments",
            description="Whether to include comments. Defaults to true.",
        ),
    ] = None


class LinearReadTicketInput(RootModel[LinearReadTicketToolInput]):
    root: LinearReadTicketToolInput


class LinearReadTicketToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    issue: LinearIssueDetail
    comments: list[LinearReadTicketComment] | None = None


class LinearSearchPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    has_next_page: Annotated[bool, Field(alias="hasNextPage")]
    end_cursor: Annotated[str | None, Field(alias="endCursor")]
    limit: int | None


class LinearSearchTicketDateFilterField(StrEnum):
    updated_at = "updatedAt"
    created_at = "createdAt"


class LinearSearchTicketToolInputStateName(StrEnum):
    triage = "Triage"
    backlog = "Backlog"
    todo = "Todo"
    in_progress = "In Progress"
    in_review = "In Review"
    done = "Done"
    canceled = "Canceled"


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
        str,
        Field(
            alias="searchTerm",
            description='Plain-text keyword search (matched against titles, descriptions, etc.).\n            Do NOT include operators or field filters. Use dedicated parameters instead.\n            ✓ "block kit"\n            ✗ "team:TER state:Done updated:>2026-02-04 block kit"',
        ),
    ]
    state_names: Annotated[
        list[LinearSearchTicketToolInputStateName] | None,
        Field(
            alias="stateNames",
            description="Filter to only include issues with these state names. Available states: Triage, Backlog, Todo, In Progress, In Review, Done, Canceled.",
        ),
    ] = None
    date_filter_field: Annotated[
        LinearSearchTicketDateFilterField | None,
        Field(
            alias="dateFilterField",
            description="Which date field to filter on. Required if using dateAfter or dateBefore. Options: 'updatedAt' (when issue was last modified) or 'createdAt' (when issue was created).",
        ),
    ] = None
    date_after: Annotated[
        str | None,
        Field(
            alias="dateAfter",
            description="Filter to only include issues where the dateFilterField is on or after this date. ISO 8601 format (e.g., '2026-01-01' or '2026-01-01T00:00:00Z').",
        ),
    ] = None
    date_before: Annotated[
        str | None,
        Field(
            alias="dateBefore",
            description="Filter to only include issues where the dateFilterField is on or before this date. ISO 8601 format (e.g., '2026-02-01' or '2026-02-01T23:59:59Z').",
        ),
    ] = None
    limit: Annotated[
        int | None,
        Field(description="Maximum number of issues to return. Defaults to 10 if not provided."),
    ] = None
    after: Annotated[
        str | None,
        Field(
            description="Cursor for pagination. Use the endCursor from the previous response to fetch the next page of results."
        ),
    ] = None


class LinearSearchTicketInput(RootModel[LinearSearchTicketToolInput]):
    root: LinearSearchTicketToolInput


class LinearSearchTicketToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    issues: list[LinearIssueSummary]
    count: int
    query: str
    pagination: LinearSearchPagination


class LinearUpdateTicketUpdates(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    title: Annotated[str | None, Field(description="The updated title of the ticket.")] = None
    description: Annotated[str | None, Field(description="The updated description of the ticket.")] = None
    state_id: Annotated[
        str | None,
        Field(
            alias="stateId",
            description="The ID of the state to set. Use linear_get_states to find available states.",
        ),
    ] = None
    priority: Annotated[
        int | None,
        Field(description="The priority of the ticket. 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low."),
    ] = None
    project_id: Annotated[
        str | None,
        Field(
            alias="projectId",
            description="The ID of the project to associate with the ticket. Use linear_get_projects to find available projects.",
        ),
    ] = None
    label_ids: Annotated[
        list[str] | None,
        Field(
            alias="labelIds",
            description="The IDs of labels to add to the ticket. Use linear_get_labels to find available labels.",
        ),
    ] = None
    assignee_id: Annotated[
        str | None,
        Field(
            alias="assigneeId",
            description="The ID of the user to assign the ticket to. Use linear_get_users to find available users and their IDs.",
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


class LinearWebhookPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    action: LinearWebhookAction
    actor: LinearWebhookActor
    created_at: Annotated[str, Field(alias="createdAt")]
    data: LinearWebhookData
    type: LinearWebhookType
    url: str | None = None
    organization_id: Annotated[str, Field(alias="organizationId")]
    webhook_timestamp: Annotated[float, Field(alias="webhookTimestamp")]
    webhook_id: Annotated[str, Field(alias="webhookId")]


class LinearWorkspace(LinearWebhookAssignee):
    pass


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
        str | None,
        Field(
            description='Start of time window (ISO date string, e.g., "2024-01-01" or "2024-01-15T00:00:00Z"). Only commits after this date are included. Use null for no start filter.'
        ),
    ]
    until: Annotated[
        str | None,
        Field(
            description="End of time window (ISO date string). Only commits before this date are included. Use null for no end filter."
        ),
    ] = None
    branch: Annotated[
        str | None,
        Field(
            description='Branch name to list commits from (e.g., "main", "develop"). Use null for the repository\'s default branch.'
        ),
    ] = None
    path: Annotated[
        str | None,
        Field(
            description='Only include commits that affect this file or directory path (e.g., "src/components" or "package.json"). Use null for all paths.'
        ),
    ] = None
    author: Annotated[
        str | None,
        Field(description="Filter commits by author (GitHub username or email). Use null for all authors."),
    ] = None
    per_page: Annotated[
        int,
        Field(
            alias="perPage",
            description="Number of results to return (default: 30, max: 100)",
        ),
    ]


class ListGitHubCommitsInput(RootModel[ListGitHubCommitsToolInput]):
    root: ListGitHubCommitsToolInput


class ListGitHubCommitsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
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


class ListGitHubDirectoryToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    repository: str
    path: str
    recursive: bool
    total_items: Annotated[int, Field(alias="totalItems")]
    directories: list[GitHubDirectoryEntry | str]
    files: list[GitHubFileEntry]
    warning: str | None = None
    tip: str | None = None
    truncated: bool | None = None
    other: list[GitHubOtherEntry] | None = None


class ListGitHubPullRequestsToolInputState(StrEnum):
    open = "open"
    closed = "closed"
    all = "all"


class ListGitHubPullRequestsToolInputPage(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional PRs if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1.",
            ge=1,
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
        ListGitHubPullRequestsToolInputState,
        Field(
            description='Filter by PR state. Use "closed" to see merged PRs, "open" for in-progress, or "all" for both.'
        ),
    ]
    since: Annotated[
        str | None,
        Field(
            description='Start date in YYYY-MM-DD format (e.g., "2024-01-15"). Only PRs updated on or after this date (starting at 00:00:00) are included. Use null for no start filter.'
        ),
    ]
    until: Annotated[
        str | None,
        Field(
            description='End date in YYYY-MM-DD format (e.g., "2024-01-15"). Only PRs updated on or before this date (ending at 23:59:59) are included. Use null for no end filter.'
        ),
    ]
    per_page: Annotated[
        int,
        Field(
            alias="perPage",
            description="Number of results to return (default: 20, max: 100)",
        ),
    ]
    page: Annotated[
        ListGitHubPullRequestsToolInputPage | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional PRs if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1."
        ),
    ]


class ListGitHubPullRequestsInput(RootModel[ListGitHubPullRequestsToolInput]):
    root: ListGitHubPullRequestsToolInput


class ListGitHubPullRequestsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    repository: str
    time_window: Annotated[str, Field(alias="timeWindow")]
    summary: GitHubPullRequestListSummary
    pagination: GitHubPagination
    pull_requests: Annotated[list[GitHubPullRequestSummary], Field(alias="pullRequests")]
    message: str


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
        bool,
        Field(
            description="If true, return only flag key, name, and on/off state per environment. If false, return full flag details."
        ),
    ]
    filter: Annotated[
        str | None,
        Field(description="Optional: Filter flags by name/key containing this text."),
    ] = None
    tags: Annotated[list[str] | None, Field(description="Optional: Filter flags by tags.")] = None


class ListLaunchDarklyFlagsInput(RootModel[ListLaunchDarklyFlagsToolInput]):
    root: ListLaunchDarklyFlagsToolInput


class ListLaunchDarklyFlagsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    project_key: Annotated[str, Field(alias="projectKey")]
    total_flags: Annotated[int, Field(alias="totalFlags")]
    flags: list[LaunchDarklyFlagSummary]
    flags_link: Annotated[str, Field(alias="flagsLink")]
    message: str


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
        str | None,
        Field(description="Datadog RUM search query to filter events (e.g., @type:view)"),
    ] = None
    from_: Annotated[
        str | None,
        Field(
            alias="from",
            description='Minimum timestamp (ISO8601 only, e.g., "2020-09-17T11:48:36+01:00")',
        ),
    ] = None
    to: Annotated[
        str | None,
        Field(description="Maximum timestamp (ISO8601 only). Defaults to now if not provided."),
    ] = None
    limit: Annotated[
        int,
        Field(description="Maximum number of RUM events to return (default: 25, max: 1000)"),
    ]
    page_cursor: Annotated[
        str | None,
        Field(alias="pageCursor", description="Pagination cursor from previous response"),
    ] = None
    sort: Annotated[
        ListRumEventsToolInputSort,
        Field(description='Sort order: "timestamp" (ascending) or "-timestamp" (descending)'),
    ]


class ListRumEventsInput(RootModel[ListRumEventsToolInput]):
    root: ListRumEventsToolInput


class ListRumEventsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    query: str | None
    total_events: Annotated[int, Field(alias="totalEvents")]
    events: list[DatadogRumEvent]
    events_by_type: Annotated[dict[str, int], Field(alias="eventsByType")]
    rum_link: Annotated[str, Field(alias="rumLink")]
    pagination: DatadogCursorPagination
    warnings: str | None
    message: str


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
        int,
        Field(description="Maximum number of organizations to return (default: 20, max: 100)."),
    ]
    after: Annotated[
        str | None,
        Field(
            description="Optional pagination cursor. Use the 'after' value from a previous response to get the next page."
        ),
    ] = None


class ListWorkOSOrganizationsInput(RootModel[ListWorkOSOrganizationsToolInput]):
    root: ListWorkOSOrganizationsToolInput


class WorkOSPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    has_more: Annotated[bool, Field(alias="hasMore")]
    after: str | None = None


class WorkOSOrganizationSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    name: str
    external_id: Annotated[str | None, Field(alias="externalId")] = None
    domains: list[str]
    created_at: Annotated[str, Field(alias="createdAt")]
    updated_at: Annotated[str, Field(alias="updatedAt")]


class ListWorkOSOrganizationsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    organizations: list[WorkOSOrganizationSummary]
    pagination: WorkOSPagination
    message: str


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
        str | None,
        Field(description="Optional exact email address filter. Omit or pass null to list all users."),
    ] = None
    organization_id: Annotated[
        str | None,
        Field(
            alias="organizationId",
            description="Optional WorkOS organization ID filter. Omit or pass null for all organizations.",
        ),
    ] = None
    limit: Annotated[
        int,
        Field(description="Maximum number of users to return (default: 20, max: 100)."),
    ]
    after: Annotated[
        str | None,
        Field(
            description="Optional pagination cursor. Use the 'after' value from a previous response to get the next page."
        ),
    ] = None


class ListWorkOSUsersInput(RootModel[ListWorkOSUsersToolInput]):
    root: ListWorkOSUsersToolInput


class ListWorkOSUsersToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
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
    id: str | None = None
    timestamp: float
    snippet: ChatSnippet


class ProcessOutputStream(StrEnum):
    stdout = "stdout"
    stderr = "stderr"


class ProcessOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["ProcessOutput"] = "ProcessOutput"
    id: str | None = None
    stream: ProcessOutputStream
    content: str
    label: str
    timestamp: float


class Thinking(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    step_id: str
    type: Literal["Thinking"] = "Thinking"
    id: str | None = None
    timestamp: float


class UserMessage(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["UserMessage"] = "UserMessage"
    id: str | None = None
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
    id: str | None = None
    timestamp: float


class RunError(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["RunError"] = "RunError"
    id: str | None = None
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
    id: str | None = None
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
    id: str | None = None
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
    id: str | None = None
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
    id: str | None = None
    timestamp: float


class ToolApprovalRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    step_id: str
    type: Literal["ToolApprovalRequest"] = "ToolApprovalRequest"
    id: str | None = None
    name: str
    arguments: str
    timestamp: float


class ToolApprovalResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    step_id: str
    type: Literal["ToolApprovalResponse"] = "ToolApprovalResponse"
    id: str | None = None
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
        | ProcessOutput
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
        | ProcessOutput
    )


class SendModelRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["SendModelRequest"] = "SendModelRequest"
    id: str | None = None
    user_message: str
    timezone: str
    ui_state: str | None = None
    client_turn_id: str
    template_id: str | None = None


class ModelRequest(RootModel[SendModelRequest | ToolApprovalResponse]):
    root: SendModelRequest | ToolApprovalResponse


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
        str | None,
        Field(
            description="The ID of the row to update (from notion_query_database). MUST be null to create a new row. Provide a valid page ID to update an existing row."
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


class NotionDatabaseRowMutationResultAction(StrEnum):
    created = "created"
    updated = "updated"


class NotionDatabaseRowMutationResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    action: NotionDatabaseRowMutationResultAction
    page_id: str
    url: str | None = None


class NotionCreateOrUpdateDatabaseRowToolOutput(RootModel[NotionDatabaseRowMutationResult]):
    root: NotionDatabaseRowMutationResult


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
        str | None,
        Field(description="ID of an existing page to update. Omit or null to create a new subpage under parentPageId."),
    ] = None
    parent_page_id: Annotated[
        str | None,
        Field(
            alias="parentPageId",
            description="Required for create: the allowed page ID under which to create the new subpage (from the Notion config list). Ignored when page_id is provided for update.",
        ),
    ] = None
    title: Annotated[str, Field(description="The page title (used for both create and update).")]


class NotionCreateOrUpdatePageInput(RootModel[NotionCreateOrUpdatePageToolInput]):
    root: NotionCreateOrUpdatePageToolInput


class NotionCreateOrUpdatePageToolOutput(NotionCreateOrUpdateDatabaseRowToolOutput):
    pass


class NotionPageParent(WorkOSWebhookData):
    pass


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


class NotionDateReference(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    start: str | None = None
    end: str | None = None
    time_zone: str | None = None


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


class NotionFetchRelatedEventsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    events_count: int
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


class NotionGetSchemaToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    data_source_id: str
    database_name: str
    schema_: Annotated[dict[str, NotionSchemaProperty], Field(alias="schema")]
    property_count: int


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
        str | None,
        Field(description="Optional search query to filter users by name. Case-insensitive partial match."),
    ] = None


class NotionListUsersInput(RootModel[NotionListUsersToolInput]):
    root: NotionListUsersToolInput


class NotionWorkspaceUser(LinearIssueAssignee):
    pass


class NotionListUsersToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    users: list[NotionWorkspaceUser]
    count: int


class NotionLooseObject(RootModel[NotionPageParent]):
    root: NotionPageParent


class NotionModifyBlocksAppendResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    operation: Literal["append"] = "append"
    actions: list[RunHistoryActionBase]
    block_ids: list[str]
    blocks_count: int


class NotionModifyBlocksAppendSuccess(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    operation: Literal["append"] = "append"
    block_ids: list[str]
    blocks_count: int


class NotionModifyBlocksDeleteResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    operation: Literal["delete"] = "delete"
    actions: list[RunHistoryActionBase]
    block_id: str


class NotionModifyBlocksUpdateResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    operation: Literal["update"] = "update"
    actions: list[RunHistoryActionBase]
    block_id: str


class NotionModifyBlocksOperationResult(
    RootModel[NotionModifyBlocksAppendResult | NotionModifyBlocksUpdateResult | NotionModifyBlocksDeleteResult]
):
    root: NotionModifyBlocksAppendResult | NotionModifyBlocksUpdateResult | NotionModifyBlocksDeleteResult


class NotionModifyBlocksBatchSuccess(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    operations: list[NotionModifyBlocksOperationResult]
    block_ids: list[str]
    total_operations: int


class NotionModifyBlocksFailure(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[False] = False
    actions: list[RunHistoryActionBase] | None = None
    error: str
    block_ids: list[str]
    operations: list[NotionModifyBlocksOperationResult] | None = None
    failed_at_index: int | None = None
    total_operations: int | None = None
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


class NotionModifyBlocksSingleBlockSuccessOperation(StrEnum):
    update = "update"
    delete = "delete"


class NotionModifyBlocksSingleBlockSuccess(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    operation: NotionModifyBlocksSingleBlockSuccessOperation
    block_id: str


class NotionModifyBlocksSuccess(
    RootModel[NotionModifyBlocksAppendSuccess | NotionModifyBlocksSingleBlockSuccess | NotionModifyBlocksBatchSuccess]
):
    root: NotionModifyBlocksAppendSuccess | NotionModifyBlocksSingleBlockSuccess | NotionModifyBlocksBatchSuccess


class NotionModifyBlocksToolOutput(RootModel[NotionModifyBlocksSuccess | NotionModifyBlocksFailure]):
    root: NotionModifyBlocksSuccess | NotionModifyBlocksFailure


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
    table_width: int | None = None
    has_column_header: bool | None = None
    has_row_header: bool | None = None
    caption: str | None = None
    file: str | None = None
    external: str | None = None
    url: str | None = None
    page_id: str | None = None
    database_id: str | None = None
    children: list[NotionPageBlock] | None = None


class NotionPageQueryMetadata(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    page_id: str
    object: str
    url: str | None = None
    public_url: str | None = None
    created_time: str | None = None
    last_edited_time: str | None = None
    archived: bool | None = None
    icon: NotionPageParent | None = None
    cover: NotionPageParent | None = None
    parent: NotionPageParent | None = None
    created_by: NotionUserReference | None = None
    last_edited_by: NotionUserReference | None = None
    in_trash: bool | None = None


class NotionQueryDatabaseFailure(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[False] = False
    actions: list[RunHistoryActionBase] | None = None
    pages: list[NotionDatabaseQueryPage]
    total_returned: Literal[0] = 0
    has_more: Literal[False] = False
    next_cursor: None
    error: str
    hint: str


class NotionQueryDatabaseToolInputPageSize(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Number of results per page (1-100). Default returns all results. Use pagination for large databases.",
            ge=1,
            le=100,
        ),
    ]


class NotionQueryDatabaseToolInputResultType(StrEnum):
    page = "page"
    data_source = "data_source"


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
        list[str] | None,
        Field(
            description="Array of property names or IDs to include in results. Only these properties will be returned, improving performance. Use property names from the database schema."
        ),
    ] = None
    filter: Annotated[
        str | None,
        Field(
            description='JSON string with filter object to query pages matching specific criteria. Supports complex filtering with AND/OR logic, property filters, and timestamp filters.\n\nBASIC STRUCTURE:\n- Property filter: { "property": "Property Name", "type": { "condition": value } }\n- Timestamp filter: { "timestamp": "created_time" | "last_edited_time", "created_time" | "last_edited_time": { "condition": value } }\n- Compound filter: { "and": [...] } or { "or": [...] } to combine multiple filters (nesting supported up to 2 levels)\n\nPROPERTY FILTER TYPES AND CONDITIONS:\n\n1. CHECKBOX: { "property": "Name", "checkbox": { "equals": true|false } | { "does_not_equal": true|false } }\n\n2. DATE: { "property": "Name", "date": { \n"after": "2021-05-10" | "2021-05-10T12:00:00" | "2021-10-15T12:00:00-07:00",\n"before": "2021-05-10",\n"equals": "2021-05-10",\n"on_or_after": "2021-05-10",\n"on_or_before": "2021-05-10",\n"is_empty": true,\n"is_not_empty": true,\n"past_week": {},\n"past_month": {},\n"past_year": {},\n"next_week": {},\n"next_month": {},\n"next_year": {},\n"this_week": {}\n} }\n\n3. FILES: { "property": "Name", "files": { "is_empty": true } | { "is_not_empty": true } }\n\n4. FORMULA: { "property": "Name", "formula": { \n"checkbox": { checkbox conditions },\n"date": { date conditions },\n"number": { number conditions },\n"string": { rich_text conditions }\n} }\n\n5. MULTI_SELECT: { "property": "Name", "multi_select": { \n"contains": "Value",\n"does_not_contain": "Value",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n6. NUMBER: { "property": "Name", "number": { \n"equals": 42,\n"does_not_equal": 42,\n"greater_than": 42,\n"less_than": 42,\n"greater_than_or_equal_to": 42,\n"less_than_or_equal_to": 42,\n"is_empty": true,\n"is_not_empty": true\n} }\n\n7. PEOPLE (also for created_by, last_edited_by): { "property": "Name", "people": { \n"contains": "uuid-v4",\n"does_not_contain": "uuid-v4",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n8. RELATION: { "property": "Name", "relation": { \n"contains": "uuid-v4",\n"does_not_contain": "uuid-v4",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n9. RICH_TEXT (also title): { "property": "Name", "rich_text": { \n"contains": "string",\n"does_not_contain": "string",\n"does_not_equal": "string",\n"ends_with": "string",\n"equals": "string",\n"is_empty": true,\n"is_not_empty": true,\n"starts_with": "string"\n} }\n\n10. ROLLUP: { "property": "Name", "rollup": { \n"any": { filter condition },\n"every": { filter condition },\n"none": { filter condition },\n"date": { date conditions },\n"number": { number conditions }\n} }\n\n11. SELECT: { "property": "Name", "select": { \n"equals": "Value",\n"does_not_equal": "Value",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n12. STATUS: { "property": "Name", "status": { \n"equals": "Value",\n"does_not_equal": "Value",\n"is_empty": true,\n"is_not_empty": true\n} }\n\n13. TIMESTAMP: { "timestamp": "created_time" | "last_edited_time", "created_time" | "last_edited_time": { \nsame conditions as DATE filter (after, before, equals, on_or_after, on_or_before, is_empty, is_not_empty, past_week, past_month, past_year, next_week, next_month, next_year, this_week)\n} }\nNOTE: Do NOT include "property" field for timestamp filters.\n\n14. VERIFICATION: { "property": "Name", "verification": { "status": "verified" | "expired" | "none" } }\n\n15. UNIQUE_ID: { "property": "Name", "unique_id": { \n"equals": 42,\n"does_not_equal": 42,\n"greater_than": 42,\n"less_than": 42,\n"greater_than_or_equal_to": 42,\n"less_than_or_equal_to": 42\n} }\n\nCOMPOUND FILTERS:\n- AND: { "and": [filter1, filter2, ...] } - all conditions must match\n- OR: { "or": [filter1, filter2, ...] } - any condition can match\n- Nesting: Can nest AND/OR up to 2 levels deep\n\nEXAMPLES:\n- Simple: "{\\"property\\": \\"Task completed\\", \\"checkbox\\": {\\"equals\\": true}}"\n- Compound: "{\\"and\\": [{\\"property\\": \\"Done\\", \\"checkbox\\": {\\"equals\\": true}}, {\\"or\\": [{\\"property\\": \\"Tags\\", \\"multi_select\\": {\\"contains\\": \\"A\\"}}, {\\"property\\": \\"Tags\\", \\"multi_select\\": {\\"contains\\": \\"B\\"}}]}]}"\n- Timestamp: "{\\"timestamp\\": \\"created_time\\", \\"created_time\\": {\\"on_or_after\\": \\"2023-02-08\\"}}"'
        ),
    ] = None
    page_size: Annotated[
        NotionQueryDatabaseToolInputPageSize | None,
        Field(
            description="Number of results per page (1-100). Default returns all results. Use pagination for large databases."
        ),
    ] = None
    start_cursor: Annotated[
        str | None,
        Field(
            description="Cursor from previous response to fetch next page. Use next_cursor from response when has_more is true."
        ),
    ] = None
    result_type: Annotated[
        NotionQueryDatabaseToolInputResultType | None,
        Field(description="Filter results to only pages or data sources. Only relevant for wiki databases."),
    ] = None


class NotionQueryDatabaseInput(RootModel[NotionQueryDatabaseToolInput]):
    root: NotionQueryDatabaseToolInput


class NotionQueryDatabaseSuccess(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    pages: list[NotionDatabaseQueryPage]
    total_returned: int
    has_more: bool
    next_cursor: str | None


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


class PosthogEventCount(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    event_name: Annotated[str, Field(alias="eventName")]
    count: int


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


class PosthogOffsetPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    limit: int
    offset: int
    has_more: Annotated[bool, Field(alias="hasMore")]
    next_offset: Annotated[int | None, Field(alias="nextOffset")]
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


class PosthogSearchSessionsPagination(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    limit: int
    offset: int
    has_next: Annotated[bool, Field(alias="hasNext")]
    has_previous: Annotated[bool, Field(alias="hasPrevious")]
    next_offset: Annotated[int | None, Field(alias="nextOffset")]
    previous_offset: Annotated[int | None, Field(alias="previousOffset")]


class PosthogSessionSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    start_time: Annotated[str | None, Field(alias="startTime")] = None
    end_time: Annotated[str | None, Field(alias="endTime")] = None
    duration: float | None = None
    events_count: Annotated[int, Field(alias="eventsCount")]
    session_url: Annotated[str, Field(alias="sessionUrl")]
    person_id: Annotated[str, Field(alias="personId")]
    distinct_id: Annotated[str, Field(alias="distinctId")]


class PosthogSearchSessionsFound(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    user_email: Annotated[str, Field(alias="userEmail")]
    project_id: Annotated[str, Field(alias="projectId")]
    person_found: Annotated[Literal[True], Field(alias="personFound")] = True
    person_id: Annotated[str, Field(alias="personId")]
    distinct_id: Annotated[str, Field(alias="distinctId")]
    total_sessions: Annotated[int, Field(alias="totalSessions")]
    sessions: list[PosthogSessionSummary]
    sessions_link: Annotated[str, Field(alias="sessionsLink")]
    pagination: PosthogSearchSessionsPagination
    message: str


class PosthogSearchSessionsNotFound(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
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
        int | None,
        Field(
            alias="startLine",
            description="Start reading from this line number (1-indexed). Use with endLine for partial file reads. Use null to start from beginning.",
        ),
    ] = None
    end_line: Annotated[
        int | None,
        Field(
            alias="endLine",
            description="Stop reading at this line number (1-indexed, inclusive). Use with startLine for partial file reads. Use null to read to end.",
        ),
    ] = None


class ReadGitHubFileInput(RootModel[ReadGitHubFileToolInput]):
    root: ReadGitHubFileToolInput


class ReadGitHubFileToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    repository: str
    path: str
    url: str
    total_lines: Annotated[int, Field(alias="totalLines")]
    displayed_lines: Annotated[str, Field(alias="displayedLines")]
    size: int
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
    notification_settings: Annotated[AgentNotificationSettings | None, Field(alias="notificationSettings")]
    tool_approvals: Annotated[list[str] | None, Field(alias="toolApprovals")]
    updated_at: Annotated[str, Field(alias="updatedAt")]
    source: AgentSource | None
    last_event_processed_at: Annotated[str | None, Field(alias="lastEventProcessedAt")]


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
    actions: list[RunHistoryActionBase] | None = None
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
    actions: list[RunHistoryActionBase] | None = None
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


class SdkAgentRunNormalizedRequestOptions(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    max_turns: Annotated[int, Field(alias="maxTurns")]
    require_approval: Annotated[bool, Field(alias="requireApproval")]


class SkillConfigData(
    RootModel[
        Annotated[
            SlackOutputConfigInstance
            | GmailOutputConfigInstance
            | GmailDraftOutputConfigInstance
            | NotionConfigInstance
            | LinearOutputConfigInstance
            | GitHubSkillConfigInstance
            | PosthogConfigInstance
            | DatadogConfigInstance
            | LaunchDarklyConfigInstance
            | TerseConfigInstance
            | WorkOSOutputConfigInstance
            | AttioOutputConfigInstance
            | SnowflakeOutputConfigInstance,
            Discriminator("config_type"),
        ]
    ]
):
    root: Annotated[
        SlackOutputConfigInstance
        | GmailOutputConfigInstance
        | GmailDraftOutputConfigInstance
        | NotionConfigInstance
        | LinearOutputConfigInstance
        | GitHubSkillConfigInstance
        | PosthogConfigInstance
        | DatadogConfigInstance
        | LaunchDarklyConfigInstance
        | TerseConfigInstance
        | WorkOSOutputConfigInstance
        | AttioOutputConfigInstance
        | SnowflakeOutputConfigInstance,
        Discriminator("config_type"),
    ]


class SdkAgentRunNormalizedRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    prompt: str
    event: Trigger
    skills: list[SkillConfigData]
    tool_approvals: Annotated[list[str], Field(alias="toolApprovals")]
    options: SdkAgentRunNormalizedRequestOptions


class SdkAgentRunOptionsPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    max_turns: Annotated[int | None, Field(alias="maxTurns")] = None
    require_approval: Annotated[bool | None, Field(alias="requireApproval")] = None


class SdkAgentRunRequestBody(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    prompt: str | None = None
    message: str
    skills: list[SkillConfigData] | None = None
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
        Annotated[
            RunStarted
            | Text
            | FinalOutput
            | ToolCallParams
            | ToolCallStarted
            | ToolCallCompleted
            | ToolApprovalRequested
            | Action
            | Error
            | Done,
            Discriminator("type"),
        ]
    ]
):
    root: Annotated[
        RunStarted
        | Text
        | FinalOutput
        | ToolCallParams
        | ToolCallStarted
        | ToolCallCompleted
        | ToolApprovalRequested
        | Action
        | Error
        | Done,
        Discriminator("type"),
    ]


class SdkApprovalDecisionRequestBody(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    run_id: Annotated[str, Field(alias="runId")]
    step_id: Annotated[str, Field(alias="stepId")]
    approved: bool


class TriggerConfigData(
    RootModel[
        Annotated[
            GmailConfigInstance
            | SlackConfigInstance
            | LinearInputConfigInstance
            | GitHubConfigInstance
            | TimeTriggerConfigInstance
            | WorkOSInputConfigInstance
            | WebhookInputConfigInstance,
            Discriminator("config_type"),
        ]
    ]
):
    root: Annotated[
        GmailConfigInstance
        | SlackConfigInstance
        | LinearInputConfigInstance
        | GitHubConfigInstance
        | TimeTriggerConfigInstance
        | WorkOSInputConfigInstance
        | WebhookInputConfigInstance,
        Discriminator("config_type"),
    ]


class SdkDeployJob(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    job_name: Annotated[str, Field(alias="jobName")]
    triggers: list[TriggerConfigData]


class SdkDeployRemoved(LinearWebhookAssignee):
    pass


class SdkDeployRequestBody(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    jobs: list[SdkDeployJob]
    remote_server_url: Annotated[str | None, Field(alias="remoteServerUrl")] = None
    source_zip_base64: Annotated[str | None, Field(alias="sourceZipBase64")] = None


class SdkDeployResultTrigger(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    metadata: TriggerMetadata | None = None


class SdkDeployResult(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    job_name: Annotated[str, Field(alias="jobName")]
    automation_id: Annotated[str, Field(alias="automationId")]
    is_update: Annotated[bool, Field(alias="isUpdate")]
    signing_secret: Annotated[str | None, Field(alias="signingSecret")] = None
    triggers: list[SdkDeployResultTrigger] | None = None


class SdkDeployResponseBody(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    results: list[SdkDeployResult]
    removed: list[SdkDeployRemoved]
    error: str | None = None
    details: str | None = None


class SdkJobServerCheckStep(StrEnum):
    http = "http"
    json = "json"
    response_schema = "response_schema"
    challenge_echo = "challenge_echo"
    challenge_signature = "challenge_signature"


class SdkJobServerCheckResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    message: str
    trigger_url: Annotated[str | None, Field(alias="triggerUrl")] = None
    step: SdkJobServerCheckStep | None = None
    http_status: Annotated[float | None, Field(alias="httpStatus")] = None


class SerializedEventDisplay(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    title: str
    subtitle: str


class SerializedEvent(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_type: Annotated[IntegrationTypeEnum, Field(alias="integrationType")]
    event_type: Annotated[TriggerType, Field(alias="eventType")]
    formatted_content: Annotated[str, Field(alias="formattedContent")]
    debug_log: Annotated[str, Field(alias="debugLog")]
    display: SerializedEventDisplay | None = None
    data: Trigger


class SdkRunTriggerEventResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    event: SerializedEvent


class SdkSampleEventsRequestTrigger(TerseModel):
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
    triggers: Annotated[list[SdkSampleEventsRequestTrigger], Field(min_length=1)]


class SdkToolExecuteRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    tool_name: Annotated[str, Field(alias="toolName")]
    params: dict[str, Any] | None = None


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
        list[str] | None,
        Field(
            alias="defaultIndexes",
            description='Default log indexes to search (e.g., ["main"]). Falls back to ["main"] if not provided.',
        ),
    ] = None
    query: Annotated[
        str | None,
        Field(description="Datadog log search query (e.g., service:web AND @status:error)"),
    ] = None
    indexes: Annotated[
        list[str] | None,
        Field(description='Log indexes to search (e.g., ["main"]). Defaults to defaultIndexes if not provided.'),
    ] = None
    from_: Annotated[
        str | None,
        Field(alias="from", description='Start time (ISO8601 or relative like "now-1h")'),
    ] = None
    to: Annotated[
        str | None,
        Field(description="End time (ISO8601). Defaults to now if not provided."),
    ] = None
    limit: Annotated[int, Field(description="Maximum number of log entries to return (default: 50)")]
    cursor: Annotated[str | None, Field(description="Pagination cursor from previous response")] = None
    sort: Annotated[
        ListRumEventsToolInputSort,
        Field(description='Sort order: "timestamp" (ascending) or "-timestamp" (descending)'),
    ]


class SearchDatadogLogsInput(RootModel[SearchDatadogLogsToolInput]):
    root: SearchDatadogLogsToolInput


class SearchDatadogLogsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    query: str | None
    indexes: list[str]
    total_logs: Annotated[int, Field(alias="totalLogs")]
    logs: list[DatadogLogEntry]
    logs_link: Annotated[str, Field(alias="logsLink")]
    pagination: DatadogCursorPagination
    warnings: str | None
    message: str


class SearchGitHubCodeToolInputPage(GrepGitHubCodeToolInputPage):
    pass


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
        str | None,
        Field(
            description='Filter by programming language (e.g., "typescript", "python", "javascript"). Use null to search all languages.'
        ),
    ] = None
    filename: Annotated[
        str | None,
        Field(
            description='Filter by filename pattern (e.g., "*.test.ts" for test files, "*.config.*" for config files). Use null to search all files.'
        ),
    ] = None
    path: Annotated[
        str | None,
        Field(
            description='Filter by path (e.g., "src/components" to only search in that directory). Use null to search everywhere.'
        ),
    ] = None
    per_page: Annotated[
        int,
        Field(
            alias="perPage",
            description="Number of results to return (default: 10, max: 100)",
        ),
    ]
    page: Annotated[
        SearchGitHubCodeToolInputPage | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional results if there are more than perPage results. Use null for page 1. Must be a positive integer >= 1."
        ),
    ]


class SearchGitHubCodeInput(RootModel[SearchGitHubCodeToolInput]):
    root: SearchGitHubCodeToolInput


class SearchGitHubCodeToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    total_count: Annotated[int, Field(alias="totalCount")]
    results_returned: Annotated[int, Field(alias="resultsReturned")]
    query: str
    repositories: list[str]
    pagination: GitHubPagination
    results: list[GitHubCodeSearchResult]
    message: str
    tip: str


class SearchPosthogEventsCountSummary(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    count_by_event_name_only: Annotated[Literal[True], Field(alias="countByEventNameOnly")] = True
    custom_events_only: Annotated[bool, Field(alias="customEventsOnly")]
    event_counts: Annotated[list[PosthogEventCount], Field(alias="eventCounts")]
    total_event_types: Annotated[int, Field(alias="totalEventTypes")]
    events_link: Annotated[str, Field(alias="eventsLink")]
    message: str


class SearchPosthogEventsEventList(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    user_email: Annotated[str | None, Field(alias="userEmail")]
    event_name: Annotated[str | None, Field(alias="eventName")]
    project_id: Annotated[str, Field(alias="projectId")]
    total_events: Annotated[int, Field(alias="totalEvents")]
    events: list[PosthogEventSummary]
    events_link: Annotated[str, Field(alias="eventsLink")]
    pagination: PosthogOffsetPagination
    message: str


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
        bool,
        Field(
            alias="countByEventNameOnly",
            description="If true (default), returns only event names and their counts. If false, returns full event list (larger response).",
        ),
    ]
    custom_events_only: Annotated[
        bool,
        Field(
            alias="customEventsOnly",
            description="If true (default), only include custom events (exclude PostHog built-in events whose names start with $, e.g. $pageview, $autocapture). If false, include all events. Use true to get counts for events the project actually tracks (works for any user's project).",
        ),
    ]
    user_email: Annotated[
        str | None,
        Field(
            alias="userEmail",
            description='Optional: User email to filter events by (e.g., "user@example.com").',
        ),
    ] = None
    event_name: Annotated[
        str | None,
        Field(
            alias="eventName",
            description='Optional: Specific event name to filter by (e.g., "$pageview", "button_clicked", "form_submitted").',
        ),
    ] = None
    property_filters: Annotated[
        list[PosthogPropertyFilter] | None,
        Field(
            alias="propertyFilters",
            description="Optional: Array of property filters to apply. Each filter has a key, value, and operator.",
        ),
    ] = None
    limit: Annotated[
        int,
        Field(
            description="Maximum number of events to return when countByEventNameOnly is false (default: 50, max: 100). Ignored when countByEventNameOnly is true."
        ),
    ]
    offset: Annotated[
        int,
        Field(
            description="Offset for pagination when countByEventNameOnly is false (default: 0). Ignored when countByEventNameOnly is true."
        ),
    ]
    last7_days: Annotated[
        bool,
        Field(
            alias="last7Days",
            description="If true and dateFrom is not provided, filters events from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.",
        ),
    ]
    date_from: Annotated[
        str | None,
        Field(
            alias="dateFrom",
            description='Start date for filtering. MUST be formatted as "YYYY-MM-DD HH:mm:ss" in UTC (e.g. "2026-02-06 14:00:00"). Do NOT use ISO format with T/Z (e.g. 2026-02-07T22:52:34Z) and do NOT use relative strings like "-7d". If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.',
        ),
    ]
    date_to: Annotated[
        str | None,
        Field(
            alias="dateTo",
            description='End date for filtering. MUST be formatted as "YYYY-MM-DD HH:mm:ss" in UTC (e.g. "2026-02-07 14:00:00"). Do NOT use ISO format with T/Z and do NOT use relative strings like "now". If not provided, defaults to now.',
        ),
    ]


class SearchPosthogEventsInput(RootModel[SearchPosthogEventsToolInput]):
    root: SearchPosthogEventsToolInput


class SearchPosthogEventsToolOutput(RootModel[SearchPosthogEventsCountSummary | SearchPosthogEventsEventList]):
    root: SearchPosthogEventsCountSummary | SearchPosthogEventsEventList


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
        str | None,
        Field(
            alias="userEmail",
            description='Optional: User email to filter logs by (e.g., "user@example.com").',
        ),
    ] = None
    severity_levels: Annotated[
        list[PosthogSeverityLevel] | None,
        Field(
            alias="severityLevels",
            description='Optional: Array of log severity levels to filter by (e.g., ["error", "warn"]). If not provided, all severity levels are included.',
        ),
    ]
    message_search: Annotated[
        str | None,
        Field(
            alias="messageSearch",
            description="Optional: Text to search for within log messages. Searches are case-insensitive and match partial text.",
        ),
    ] = None
    limit: Annotated[
        int,
        Field(description="Maximum number of log entries to return (default: 50, max: 250)"),
    ]
    offset: Annotated[
        int,
        Field(
            description="Offset for pagination (default: 0). Use with limit to page through results. For example, offset=0 gets logs 1-50, offset=50 gets logs 51-100, etc."
        ),
    ]
    last7_days: Annotated[
        bool,
        Field(
            alias="last7Days",
            description="If true and dateFrom is not provided, filters logs from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.",
        ),
    ]
    date_from: Annotated[
        str | None,
        Field(
            alias="dateFrom",
            description='Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.',
        ),
    ]
    date_to: Annotated[
        str | None,
        Field(
            alias="dateTo",
            description='End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.',
        ),
    ] = None


class SearchPosthogLogsInput(RootModel[SearchPosthogLogsToolInput]):
    root: SearchPosthogLogsToolInput


class SearchPosthogLogsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    user_email: Annotated[str | None, Field(alias="userEmail")]
    severity_levels: Annotated[list[PosthogSeverityLevel] | None, Field(alias="severityLevels")]
    message_search: Annotated[str | None, Field(alias="messageSearch")]
    project_id: Annotated[str, Field(alias="projectId")]
    total_logs: Annotated[int, Field(alias="totalLogs")]
    logs: list[PosthogLogEntry]
    logs_link: Annotated[str, Field(alias="logsLink")]
    pagination: PosthogOffsetPagination
    message: str


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
        int,
        Field(description="Maximum number of session recordings to return (default: 10, max: 100)"),
    ]
    offset: Annotated[int, Field(description="Offset for pagination (default: 0)")]
    last7_days: Annotated[
        bool,
        Field(
            alias="last7Days",
            description="If true and dateFrom is not provided, filters session recordings from the last 7 days only (default: false). If false, no date restriction is applied unless dateFrom is explicitly provided.",
        ),
    ]
    date_from: Annotated[
        str | None,
        Field(
            alias="dateFrom",
            description='Start date for filtering (ISO format or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago. If not provided and last7Days is false, no date restriction is applied.',
        ),
    ]
    date_to: Annotated[
        str | None,
        Field(
            alias="dateTo",
            description='End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.',
        ),
    ] = None


class SearchPosthogSessionsInput(RootModel[SearchPosthogSessionsToolInput]):
    root: SearchPosthogSessionsToolInput


class SearchPosthogSessionsToolOutput(RootModel[PosthogSearchSessionsFound | PosthogSearchSessionsNotFound]):
    root: PosthogSearchSessionsFound | PosthogSearchSessionsNotFound


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
        str | None,
        Field(description="Datadog RUM search query (e.g., @type:error AND @error.source:network)"),
    ] = None
    from_: Annotated[
        str,
        Field(alias="from", description='Start time (ISO8601 or relative like "now-15m")'),
    ]
    to: Annotated[
        str | None,
        Field(description='End time (ISO8601). Defaults to "now" if not provided.'),
    ] = None
    limit: Annotated[
        int,
        Field(description="Maximum number of RUM events to return (default: 25, max: 1000)"),
    ]
    page_cursor: Annotated[
        str | None,
        Field(alias="pageCursor", description="Pagination cursor from previous response"),
    ] = None
    sort: Annotated[
        ListRumEventsToolInputSort,
        Field(description='Sort order: "timestamp" (ascending) or "-timestamp" (descending)'),
    ]
    timezone: Annotated[str, Field(description='Timezone for time-based queries (default: "GMT")')]


class SearchRumEventsInput(RootModel[SearchRumEventsToolInput]):
    root: SearchRumEventsToolInput


class SearchRumEventsToolOutput(ListRumEventsToolOutput):
    pass


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


class SlackChannelsResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    channels: list[SlackChannel]
    selected_channel_id: Annotated[str | None, Field(alias="selectedChannelId")]


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


class SlackListChannelsToolInputLimit(RootModel[int]):
    root: Annotated[
        int,
        Field(description="Maximum number of conversations to return.", ge=1, le=500),
    ] = 100


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
        SlackListChannelsTypes | None,
        Field(
            description="Filter by type: public (public channels), private (private channels), im (DMs), mpim (group DMs), or all. Defaults to all."
        ),
    ] = None
    limit: Annotated[
        SlackListChannelsToolInputLimit | None,
        Field(
            description="Maximum number of conversations to return.",
            validate_default=True,
        ),
    ]
    cursor: Annotated[
        str | None,
        Field(description="Pagination cursor from a previous response (nextCursor). Omit on first call."),
    ] = None


class SlackListChannelsInput(RootModel[SlackListChannelsToolInput]):
    root: SlackListChannelsToolInput


class SlackListChannelsToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    channels: list[SlackChannelListItem]
    count: int
    next_cursor: Annotated[str | None, Field(alias="nextCursor")]
    has_more: Annotated[bool, Field(alias="hasMore")]


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
        str | None,
        Field(description="Optional search query to filter users by name. Case-insensitive partial match."),
    ] = None


class SlackListUsersInput(RootModel[SlackListUsersToolInput]):
    root: SlackListUsersToolInput


class SlackUserResponse(LinearWebhookAssignee):
    pass


class SlackListUsersToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    users: list[SlackUserResponse]
    count: int


class SlackReadConversationToolInputLimit(RootModel[int]):
    root: Annotated[int, Field(description="Maximum number of messages to return.", ge=1, le=200)] = 50


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
        Field(description="Maximum number of messages to return.", validate_default=True),
    ]
    cursor: Annotated[
        str | None,
        Field(description="Pagination cursor from a previous response (nextCursor). Omit on first call."),
    ] = None


class SlackReadConversationInput(RootModel[SlackReadConversationToolInput]):
    root: SlackReadConversationToolInput


class SlackReadConversationToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    channel_id: Annotated[str, Field(alias="channelId")]
    channel_name: Annotated[str | None, Field(alias="channelName")] = None
    messages: list[SlackConversationMessage]
    count: int
    has_more: Annotated[bool, Field(alias="hasMore")]
    next_cursor: Annotated[str | None, Field(alias="nextCursor")]


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
        str | None,
        Field(
            description="Thread timestamp to reply to existing thread. If sending a message to a thread, this should be the timestamp of the thread to reply to. If sending an unthreaded message, this should be set to null."
        ),
    ] = None
    blocks: Annotated[
        str | None,
        Field(description="Block Kit JSON array string for interactive messages with buttons, structured layouts"),
    ] = None


class SlackSendMessageInput(RootModel[SlackSendMessageToolInput]):
    root: SlackSendMessageToolInput


class SlackSendMessageToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    message_ts: str | None = None
    channel: str
    thread_ts: str | None = None
    summary: str
    has_blocks: bool


class SlackUsersResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    users: list[SlackUserResponse]


class SnippetVariant(RootModel[Button | IntegrationPrompt | Navigate | MultipleChoice | Image]):
    root: Button | IntegrationPrompt | Navigate | MultipleChoice | Image


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


class SnowflakeQueryRow(WorkOSWebhookData):
    pass


class SnowflakeExecuteQueryToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    rows: list[SnowflakeQueryRow]
    columns: list[str]
    row_count: Annotated[int, Field(alias="rowCount")]


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


class SnowflakeExplainQueryToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
    explain_plan: Annotated[list[SnowflakeQueryRow], Field(alias="explainPlan")]
    columns: list[str]
    row_count: Annotated[int, Field(alias="rowCount")]


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


class SummarizeGitHubPullRequestDiffToolInputPage(RootModel[int]):
    root: Annotated[
        int,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional files if a PR has more than 100 files. Use null for page 1. Must be a positive integer >= 1.",
            ge=1,
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
        int,
        Field(
            alias="pullNumber",
            description="The pull request number (e.g., 123 for PR #123)",
        ),
    ]
    page: Annotated[
        SummarizeGitHubPullRequestDiffToolInputPage | None,
        Field(
            description="Page number for pagination (default: 1). Use this to fetch additional files if a PR has more than 100 files. Use null for page 1. Must be a positive integer >= 1."
        ),
    ]
    context: Annotated[
        str | None,
        Field(
            description='Optional high-level context about what you\'re looking for in this PR. This helps the sub-agent focus its analysis. For example: "I need to understand the authentication changes" or "Focus on database migration changes". Use null if no specific context.'
        ),
    ]


class SummarizeGitHubPullRequestDiffInput(RootModel[SummarizeGitHubPullRequestDiffToolInput]):
    root: SummarizeGitHubPullRequestDiffToolInput


class SummarizeGitHubPullRequestDiffToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: bool
    actions: list[RunHistoryActionBase] | None = None
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
    actions: list[RunHistoryActionBase] | None = None


class ToolOutputFailure(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[False] = False
    actions: list[RunHistoryActionBase] | None = None


class ToolOutputSuccess(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None


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
    event: Trigger


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


class UserNoOrganization(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    workos_id: Annotated[str, Field(alias="workosId")]
    email: str
    display_name: Annotated[str, Field(alias="displayName")]
    first_name: Annotated[str | None, Field(alias="firstName")]
    last_name: Annotated[str | None, Field(alias="lastName")]
    display_photo_url: Annotated[str, Field(alias="displayPhotoUrl")]


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
    first_name: Annotated[str | None, Field(alias="firstName")]
    last_name: Annotated[str | None, Field(alias="lastName")]
    display_photo_url: Annotated[str, Field(alias="displayPhotoUrl")]
    roles: list[Role]


class WebExtractToolInputExtractDepth(StrEnum):
    basic = "basic"
    advanced = "advanced"


class WebExtractToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    urls: Annotated[
        str | list[str],
        Field(description="URL or list of URLs to extract content from"),
    ]
    extract_depth: Annotated[
        WebExtractToolInputExtractDepth | None,
        Field(description="'advanced' handles JavaScript-heavy pages but is slower"),
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


class WebResearchToolInputModel(StrEnum):
    mini = "mini"
    pro = "pro"
    auto = "auto"


class WebResearchToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    input: Annotated[str, Field(description="The research question or topic to investigate")]
    model: Annotated[
        WebResearchToolInputModel | None,
        Field(
            description="'mini' for quick focused research, 'pro' for comprehensive multi-angle research, 'auto' picks automatically"
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
    actions: list[RunHistoryActionBase] | None = None
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


class WebSearchToolInputMaxResults(RootModel[int]):
    root: Annotated[int, Field(description="Number of results to return (default 5)", ge=1, le=10)]


class WebSearchToolInputTopic(StrEnum):
    general = "general"
    news = "news"


class WebSearchToolInputTimeRange(StrEnum):
    day = "day"
    week = "week"
    month = "month"
    year = "year"


class WebSearchToolInput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    query: Annotated[str, Field(description="The search query")]
    max_results: Annotated[
        WebSearchToolInputMaxResults | None,
        Field(description="Number of results to return (default 5)"),
    ]
    search_depth: Annotated[
        WebExtractToolInputExtractDepth | None,
        Field(description="'basic' is faster, 'advanced' is more thorough (default 'basic')"),
    ]
    include_answer: Annotated[
        bool | None,
        Field(description="Include an LLM-generated answer summarizing the results (default false)"),
    ]
    topic: Annotated[
        WebSearchToolInputTopic | None,
        Field(description="'news' for recent news articles, 'general' for all web content (default 'general')"),
    ]
    time_range: Annotated[
        WebSearchToolInputTimeRange | None,
        Field(description="Filter results by recency"),
    ]


class WebhookJobChallengeRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    type: Literal["challenge"] = "challenge"
    challenge: Annotated[str, Field(min_length=1)]


class WebhookJobChallengeResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    challenge: Annotated[str, Field(min_length=1)]
    signature: Annotated[str, Field(min_length=1)]


class WebhookJobTriggerRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    job_name: Annotated[str, Field(alias="jobName")]
    run_id: Annotated[str, Field(alias="runId")]
    event: SerializedEvent


class WebhookJobTriggerResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    status: str | None = None
    filtered: bool | None = None


class WebhookWorkOSTriggerParams(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    integration_id: Annotated[str, Field(alias="integrationId")]


class WorkOSInvitationTrigger(
    RootModel[
        WorkOSInvitationCreatedTrigger
        | WorkOSInvitationAcceptedTrigger
        | WorkOSInvitationResentTrigger
        | WorkOSInvitationRevokedTrigger
    ]
):
    root: (
        WorkOSInvitationCreatedTrigger
        | WorkOSInvitationAcceptedTrigger
        | WorkOSInvitationResentTrigger
        | WorkOSInvitationRevokedTrigger
    )


class WorkOSMembershipTrigger(
    RootModel[
        WorkOSOrganizationMembershipCreatedTrigger
        | WorkOSOrganizationMembershipUpdatedTrigger
        | WorkOSOrganizationMembershipDeletedTrigger
    ]
):
    root: (
        WorkOSOrganizationMembershipCreatedTrigger
        | WorkOSOrganizationMembershipUpdatedTrigger
        | WorkOSOrganizationMembershipDeletedTrigger
    )


class WorkOSUserTrigger(RootModel[WorkOSUserCreatedTrigger | WorkOSUserUpdatedTrigger | WorkOSUserDeletedTrigger]):
    root: WorkOSUserCreatedTrigger | WorkOSUserUpdatedTrigger | WorkOSUserDeletedTrigger


class WorkOSWebhookPayload(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    event: str
    data: WorkOSWebhookData
    created_at: str


class WorkosWebhookSecretUpdateRequest(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    webhook_secret: Annotated[str, Field(alias="webhookSecret")]
    state: str | None = None


class FieldSchema0(Model):
    pass


class AgentFilesResponse(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    id: str
    files: list[FieldSchema0]


class NotionQueryPageToolOutput(TerseModel):
    model_config = ConfigDict(
        extra="forbid",
    )
    page_id: str
    object: str
    url: str | None = None
    public_url: str | None = None
    created_time: str | None = None
    last_edited_time: str | None = None
    archived: bool | None = None
    icon: NotionPageParent | None = None
    cover: NotionPageParent | None = None
    parent: NotionPageParent | None = None
    created_by: NotionUserReference | None = None
    last_edited_by: NotionUserReference | None = None
    in_trash: bool | None = None
    success: Literal[True] = True
    actions: list[RunHistoryActionBase] | None = None
    properties: dict[str, NotionReadablePropertyValue | None]
    properties_raw: dict[str, Any] | None = None
    blocks: list[FieldSchema0]
    blocks_count: int


NotionPageBlock.model_rebuild()
