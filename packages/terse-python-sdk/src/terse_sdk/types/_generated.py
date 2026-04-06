# AUTO-GENERATED - DO NOT EDIT. Run 'pnpm run generate:python-types' to regenerate.
# ruff: noqa: E501

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import AnyUrl, EmailStr, Field, RootModel

from terse_sdk.types._base import TerseModel
from terse_sdk.types.enums import ConfigType as ConfigTypeEnum
from terse_sdk.types.enums import IntegrationType as IntegrationTypeEnum


class AgentActivityItem(TerseModel):
    agent_id: str
    agent_name: str
    run_count: int


class AgentImprovementStatus(StrEnum):
    PENDING = "PENDING"
    APPLIED = "APPLIED"
    DISMISSED = "DISMISSED"


class AgentImprovementTargetArea(StrEnum):
    PROMPT = "prompt"
    TRIGGER_CONFIG = "trigger_config"
    OUTPUT_CONFIG = "output_config"
    GENERAL = "general"
    CODE = "code"


class AgentImprovement(TerseModel):
    id: str
    review_id: str
    automation_id: str
    title: str
    description: str
    target_area: AgentImprovementTargetArea
    confidence: float
    status: AgentImprovementStatus
    suggested_patch: str | None = None
    applied_prompt: str | None = None
    applied_at: str | None = None
    dismissed_at: str | None = None
    created_at: str
    updated_at: str


class AgentPrompt(TerseModel):
    text: str


class AgentReview(TerseModel):
    id: str
    automation_id: str
    title: str
    summary: str
    runs_analyzed: int
    review_period_start: str
    review_period_end: str
    created_at: str


class ApiToken(TerseModel):
    id: str
    name: str
    token_prefix: str
    created_at: str
    last_used_at: str | None


class ApiTokenCreateResponse(TerseModel):
    token: ApiToken
    raw_token: str


class ApplyImprovementResponse(TerseModel):
    success: bool
    applied_prompt: str


class AtlassianIntegrationInstance(TerseModel):
    id: str
    base_url: AnyUrl
    email: EmailStr
    site_name: str | None = None
    project_key: str | None = None
    project_name: str | None = None


class AttioAttribute(TerseModel):
    api_slug: str | None = None
    title: str | None = None
    type: str | None = None
    is_required: bool | None = None
    is_unique: bool | None = None


class AttioIntegrationInstance(TerseModel):
    id: str
    workspace_name: str | None = None


class AttioListObjectsToolInput(TerseModel):
    integration_id: str


AttioListObjectsInput = AttioListObjectsToolInput


class AttioObject(TerseModel):
    api_slug: str
    singular_noun: str
    plural_noun: str


class AttioObjectWithAttributes(TerseModel):
    api_slug: str
    singular_noun: str
    plural_noun: str
    attributes: list[AttioAttribute] | None = None


class AttioOutputConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["attio"]
    config_type: Literal["attio_output"]
    object_slug: str | None = None


class AttioQueryRecordsToolInput(TerseModel):
    integration_id: str
    object_slug: str
    filter: str | None
    limit: int | None


AttioQueryRecordsInput = AttioQueryRecordsToolInput


class AttioRecordIdentifier(TerseModel):
    workspace_id: str | None = None
    object_id: str | None = None
    record_id: str | None = None


class AttioRecord(TerseModel):
    id: AttioRecordIdentifier | None = None
    values: dict[str, Any] | None = None
    web_url: str | None = None
    created_at: str | None = None


class AttioUpsertError(TerseModel):
    index: int
    message: str


class AttioUpsertRecordToolInput(TerseModel):
    integration_id: str
    object_slug: str
    matching_attribute: str
    records: str


AttioUpsertRecordInput = AttioUpsertRecordToolInput


class BaseIntegrationInstance(TerseModel):
    id: str


class CommitAssociation(TerseModel):
    sha: str
    message: str
    url: str


class ConfigurationFieldType(StrEnum):
    RADIO = "radio"
    SELECT = "select"


class ConfigurationOption(TerseModel):
    label: str
    value: str


class ConfigurationFieldDefinition(TerseModel):
    name: str
    type: ConfigurationFieldType
    label: str
    options: list[ConfigurationOption]
    required: bool | None = None
    hint: str | None = None


class ConfluenceAddCommentToolInput(TerseModel):
    integration_id: str
    page_id: str
    comment_text: str
    text_to_comment_on: str | None = None
    start_position: int | None = None
    end_position: int | None = None


ConfluenceAddCommentInput = ConfluenceAddCommentToolInput


class ConfluenceBodyRepresentation(TerseModel):
    value: str
    representation: str


class ConfluenceBodyContent(TerseModel):
    storage: ConfluenceBodyRepresentation | None = None
    view: ConfluenceBodyRepresentation | None = None
    export_view: ConfluenceBodyRepresentation | None = None


class ConfluenceCommentPosition(TerseModel):
    start: int
    end: int


class ConfluenceConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["atlassian"]
    config_type: Literal["confluence"]
    space_name: str
    space_id: str
    page_id: str
    page_name: str


class ConfluencePage(TerseModel):
    id: str
    title: str
    space_id: str
    space_name: str
    url: str
    status: str
    version: int


class ConfluencePageRelation(TerseModel):
    id: str
    title: str
    type: str


class ConfluencePageSpace(TerseModel):
    id: str | float
    key: str
    name: str
    type: str


class ConfluencePageVersionAuthor(TerseModel):
    type: str
    username: str | None = None
    user_key: str | None = None
    account_id: str | None = None
    display_name: str | None = None


class ConfluencePageVersion(TerseModel):
    number: int
    when: str
    message: str | None = None
    by: ConfluencePageVersionAuthor | None = None


class ConfluencePageQueryResult(TerseModel):
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
    ancestors_count: int
    descendants_count: int


class ConfluencePagesQuery(TerseModel):
    integration_id: str
    space_id: str | None = None
    space_key: str | None = None


class ConfluencePagesResponse(TerseModel):
    pages: list[ConfluencePage]
    space_id: str
    total: int


class ConfluenceQueryPageToolInput(TerseModel):
    integration_id: str
    page_id: str


ConfluenceQueryPageInput = ConfluenceQueryPageToolInput


class ConfluenceResourcesResponse(TerseModel):
    resources: list[ConfluencePage]
    space_id: str
    total: int


class CountByString(TerseModel):
    label: str
    count: int


class DailyEventCount(TerseModel):
    date: str
    events: int


class DatadogAggregationBucketCompute(TerseModel):
    value: Any
    aggregation: str
    metric: str


class DatadogAggregationBucket(TerseModel):
    by: dict[str, Any]
    computes: dict[str, DatadogAggregationBucketCompute]


class DatadogAggregationCompute(TerseModel):
    aggregation: Literal["count", "pc90", "pc95", "pc99", "avg", "sum", "min", "max", "cardinality"]
    metric: str
    type: Literal["total", "timeseries"]


class DatadogAggregationGroupBy(TerseModel):
    facet: str
    limit: int
    total: bool


class AggregateRumEventsToolInput(TerseModel):
    query: str | None = None
    from_: str = Field(alias="from")
    to: str | None = None
    compute: list[DatadogAggregationCompute]
    group_by: list[DatadogAggregationGroupBy] | None
    timezone: str
    page_limit: int
    integration_id: str


AggregateRumEventsInput = AggregateRumEventsToolInput


class DatadogAggregationMeta(TerseModel):
    elapsed: float | None = None
    request_id: str | None = None
    status: Any | None = None


class DatadogConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["datadog"]
    config_type: Literal["DATADOG"]
    default_indexes: list[str]


class DatadogCursorPagination(TerseModel):
    limit: int
    cursor: str | None = None
    next_cursor: str | None
    has_more: bool
    showing: str


class DatadogIndex(TerseModel):
    id: str
    name: str
    is_enabled: bool
    daily_limit: int | None = None
    retention_days: int | None = None


class DatadogIndexesResponse(TerseModel):
    indexes: list[DatadogIndex]


class DatadogIntegrationInstance(TerseModel):
    id: str
    region: str


class DatadogLogEntry(TerseModel):
    id: str
    timestamp: str | None = None
    message: str | None = None
    host: str | None = None
    service: str | None = None
    status: str | None = None
    tags: list[str]
    custom_attributes: dict[str, Any]


class DatadogPagePagination(TerseModel):
    limit: int
    next_cursor: str | None
    has_more: bool
    showing: str


class DatadogRumActionDetails(TerseModel):
    id: str | None = None
    type: str | None = None
    target: str | None = None
    loading_time: float | None = None


class DatadogRumErrorDetails(TerseModel):
    id: str | None = None
    message: str | None = None
    source: str | None = None
    stack: str | None = None
    type: str | None = None


class DatadogRumLongTaskDetails(TerseModel):
    id: str | None = None
    duration: float | None = None


class DatadogRumResourceDetails(TerseModel):
    id: str | None = None
    type: str | None = None
    url: str | None = None
    method: str | None = None
    status_code: int | None = None
    duration: float | None = None


class DatadogRumSessionDetails(TerseModel):
    id: str | None = None
    type: str | None = None
    has_replay: bool | None = None
    duration: float | None = None


class DatadogRumViewDetails(TerseModel):
    id: str | None = None
    name: str | None = None
    url: str | None = None
    load_time: float | None = None
    time_spent: float | None = None


class DatadogRumEvent(TerseModel):
    id: str
    type: str
    timestamp: str | None = None
    session: DatadogRumSessionDetails | None = None
    view: DatadogRumViewDetails | dict[str, Any] | None = None
    action: DatadogRumActionDetails | None = None
    error: DatadogRumErrorDetails | None = None
    resource: DatadogRumResourceDetails | None = None
    long_task: DatadogRumLongTaskDetails | None = None
    service: str | None = None
    version: str | None = None
    environment: str | None = None
    device: dict[str, Any] | None = None
    os: dict[str, Any] | None = None
    browser: dict[str, Any] | None = None
    user: dict[str, Any] | None = None
    tags: list[str]
    custom_attributes: dict[str, Any]


class DeviceTokenExchangeUser(TerseModel):
    email: str
    first_name: str | None
    display_name: str | None


class DeviceTokenExchangeResponse(TerseModel):
    api_key: str
    user: DeviceTokenExchangeUser


class DismissImprovementResponse(TerseModel):
    success: bool


class FigmaCommentImageUrls(TerseModel):
    node_image: str | None = None
    full_frame: str | None = None


class FigmaConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["figma"]
    config_type: Literal["figma"]
    file_key: str
    file_name: str
    team_id: str
    event_types: list[Literal["file_comment"]] | None = None


class FigmaEventTypes(StrEnum):
    FILE_COMMENT = "FILE_COMMENT"


class FigmaFileMetadata(TerseModel):
    name: str | None = None
    folder_name: str | None = None
    url: str | None = None


class FigmaIntegrationInstance(TerseModel):
    id: str
    handle: str
    figma_user_id: str
    token_expiry: str


class FigmaRegionData(TerseModel):
    x: float
    y: float
    width: float
    height: float


class FigmaRegionPositioning(TerseModel):
    type: Literal["Region"]
    data: FigmaRegionData


class FigmaVectorData(TerseModel):
    x: float
    y: float


class FigmaClientMeta(TerseModel):
    x: float
    y: float
    width: float
    height: float
    node_id: str
    node_offset: FigmaVectorData


class FigmaFrameOffsetData(TerseModel):
    node_id: str
    node_offset: FigmaVectorData


class FigmaFrameOffsetPositioning(TerseModel):
    type: Literal["FrameOffset"]
    data: FigmaFrameOffsetData


class FigmaFrameOffsetRegionData(TerseModel):
    node_id: str
    node_offset: FigmaVectorData
    x: float
    y: float
    width: float
    height: float


class FigmaFrameOffsetRegionPositioning(TerseModel):
    type: Literal["FrameOffsetRegion"]
    data: FigmaFrameOffsetRegionData


class FigmaVectorPositioning(TerseModel):
    type: Literal["Vector"]
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


class FigmaWebhookUser(TerseModel):
    id: str
    handle: str
    email: str
    img_url: str


class FigmaApiComment(TerseModel):
    id: str
    message: str
    client_meta: FigmaClientMeta | None
    user: FigmaWebhookUser
    created_at: str
    resolved_at: str | None
    parent_id: str | None = None
    order_id: str | None = None
    mentions: list[Any] | None = None
    reactions: list[Any] | None = None


class FigmaCommentThreadEntry(TerseModel):
    id: str
    message: str
    author: FigmaWebhookUser
    created_at: str
    resolved_at: str | None
    parent_id: str | None
    order_id: str | None = None
    is_root: bool | None = None


class FigmaCommentEventData(TerseModel):
    integration_id: str
    comment_id: str
    file_key: str
    file_url: str
    node_id: str | None = None
    message: str
    author: FigmaWebhookUser
    created_at: str
    resolved: bool | None = None
    thread: list[FigmaCommentThreadEntry] | None = None
    file_metadata: FigmaFileMetadata | None = None
    positioning_data: FigmaPositioningData | None = None
    matched_node_ids: list[str] | None = None
    image_urls: FigmaCommentImageUrls | None = None


class FigmaWebhookComment(TerseModel):
    id: str
    message: str
    client_meta: FigmaClientMeta
    user: FigmaWebhookUser
    created_at: str
    resolved_at: str | None


class FormFieldType(StrEnum):
    TEXT = "text"
    PASSWORD = "password"
    TEXTAREA = "textarea"


class FormFieldDefinition(TerseModel):
    name: str
    type: FormFieldType
    label: str
    placeholder: str | None = None
    required: bool | None = None
    hint: str | None = None


class GetAgentImprovementsResponse(TerseModel):
    review: AgentReview | None
    improvements: list[AgentImprovement]
    improvements_enabled: bool


class GetGithubRepositoriesForIntegrationRequest(TerseModel):
    pass


class GetLaunchDarklyFlagDetailsToolInput(TerseModel):
    integration_id: str
    project_key: str
    environment_keys: list[str]
    flag_key: str
    environment_key: str | None = None
    include_history: bool
    before: str | None = None
    after: str | None = None
    history_limit: int


GetLaunchDarklyFlagDetailsInput = GetLaunchDarklyFlagDetailsToolInput


class GetPosthogSessionEventsToolInput(TerseModel):
    integration_id: str
    project_id: str
    session_id: UUID
    start_seconds: float | None = None
    end_seconds: float | None = None


GetPosthogSessionEventsInput = GetPosthogSessionEventsToolInput


class GetWorkOSUserToolInput(TerseModel):
    integration_id: str
    user_id: str


GetWorkOSUserInput = GetWorkOSUserToolInput


class GitHubCodeGrepResult(TerseModel):
    index: int
    repository: str
    file: str
    url: str
    matches: str


class GitHubCodeSearchResult(TerseModel):
    index: int
    repository: str
    path: str
    url: str
    snippets: str


class GitHubCommitListSummary(TerseModel):
    total: int
    by_author: dict[str, int]


class GitHubCommitSummary(TerseModel):
    sha: str
    full_sha: str
    message: str
    full_message: str
    author: str
    date: str
    url: str


class GitHubConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["github"]
    config_type: Literal["github"]
    repository_ids: list[int]
    event_types: (
        list[
            Literal[
                "push", "pull_request.opened", "pull_request.merged", "pull_request.closed", "pull_request.synchronize"
            ]
        ]
        | None
    ) = None


class GitHubDirectoryEntry(TerseModel):
    name: str | None = None
    path: str | None = None
    type: Literal["directory"] | None = None


class GitHubFileEntry(TerseModel):
    name: str | None = None
    path: str
    type: Literal["file"] | None = None
    size: int | None = None


class GitHubIntegrationInstance(TerseModel):
    id: str
    installation_id: int
    account_name: str | None = None


class GitHubOtherEntry(TerseModel):
    name: str
    type: str


class GitHubPagination(TerseModel):
    page: int
    per_page: int
    has_more: bool


class GitHubPullRequestListSummary(TerseModel):
    total: int
    merged: int
    open: int
    closed: int


class GitHubPullRequestRef(TerseModel):
    number: int
    title: str
    state: str
    merged: bool
    base_branch: str
    head_branch: str
    url: str


class GitHubPullRequestSummary(TerseModel):
    number: int
    title: str
    description: str
    author: str
    state: str
    merged: bool
    merged_at: str | None = None
    created_at: str
    closed_at: str | None = None
    labels: list[str]
    base_branch: str
    head_branch: str
    url: str


class GmailConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["gmail"]
    config_type: Literal["gmail"]
    event_types: list[Literal["email.received"]] | None = None


class GmailDraftOutputConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["gmail"]
    config_type: Literal["gmail_draft_output"]


class GmailDraftSummary(TerseModel):
    draft_id: str
    message_id: str
    thread_id: str
    draft_url: str
    to: str
    subject: str
    summary: str
    is_reply: bool


class GmailHeader(TerseModel):
    key: str
    value: str


class GmailCreateDraftToolInput(TerseModel):
    integration_id: str
    to: str
    subject: str
    body: str | None = None
    html_body: str | None = None
    thread_id: str | None = None
    cc: str | None = None
    bcc: str | None = None
    image_urls: list[str] | None = None
    custom_headers: list[GmailHeader] | None = None


GmailCreateDraftInput = GmailCreateDraftToolInput


class GmailIntegrationInstance(TerseModel):
    id: str
    email: EmailStr
    history_id: str | None = None
    watch_expiration: str | None = None


class GmailOutputConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["gmail"]
    config_type: Literal["gmail_output"]


class GmailSendEmailToolInput(TerseModel):
    integration_id: str
    to: str
    subject: str
    body: str | None = None
    html_body: str | None = None
    thread_id: str | None = None
    cc: str | None = None
    bcc: str | None = None
    image_urls: list[str] | None = None
    custom_headers: list[GmailHeader] | None = None


GmailSendEmailInput = GmailSendEmailToolInput


class GmailSendSummary(TerseModel):
    message_id: str
    thread_id: str
    to: str
    subject: str
    summary: str
    is_reply: bool


class GrepGitHubCodeToolInput(TerseModel):
    repository_names: list[str]
    pattern: str
    file_extension: str | None = None
    path: str | None = None
    per_page: int
    page: Annotated[int, Field(ge=1)] | None


GrepGitHubCodeInput = GrepGitHubCodeToolInput


class ImageEditSnippet(TerseModel):
    type: Literal["image"]
    url: str


class ImageEditToolInput(TerseModel):
    image_url: str
    prompt: str


ImageEditInput = ImageEditToolInput


class IntegrationFieldsResponse(TerseModel):
    installation_type: Literal["form", "oauth"]
    fields: list[FormFieldDefinition] | list[ConfigurationFieldDefinition]


class BaseConfigInstance(TerseModel):
    integration_id: str
    integration_type: IntegrationTypeEnum
    config_type: ConfigTypeEnum


class AgentOutput(TerseModel):
    id: str
    config: BaseConfigInstance


class AgentTrigger(TerseModel):
    id: str
    config: BaseConfigInstance


class IntegrationWithStatus(TerseModel):
    integration_type: IntegrationTypeEnum
    is_active: bool


JiraAssigneeInput = dict[str, Any] | None


class JiraConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["atlassian"]
    config_type: Literal["jira"]
    project_key: str | None = None
    project_id: str | None = None
    event_types: list[Literal["issue.created", "issue.updated"]] | None = None


class JiraCreateTicketToolInput(TerseModel):
    integration_id: str
    title: str
    description: str | None = None
    project_key: str
    issue_type: str | None
    assignee: JiraAssigneeInput | None = None
    priority: int | None = None
    labels: list[str] | None = None
    due_date: str | None = None


JiraCreateTicketInput = JiraCreateTicketToolInput


class JiraIssueAssignee(TerseModel):
    id: str
    name: str
    email: str | None = None


class JiraIssueProjectRef(TerseModel):
    id: str
    name: str
    key: str


class JiraIssueState(TerseModel):
    id: str
    name: str


class JiraIssueTypeRef(TerseModel):
    id: str
    name: str


class JiraProject(TerseModel):
    id: str
    key: str
    name: str


class JiraCredentialsValidationResponse(TerseModel):
    valid: bool
    projects: list[JiraProject] | None = None
    error: str | None = None


class JiraResourceProject(TerseModel):
    id: str
    key: str
    name: str
    project_type_key: str


class JiraResourcesPayload(TerseModel):
    projects: list[JiraResourceProject]
    base_url: str
    cloud_id: str


class JiraResourcesResponse(TerseModel):
    success: bool
    resources: JiraResourcesPayload


JiraRichDescription = str | dict[str, Any]


class JiraIssueSummary(TerseModel):
    id: str | None = None
    key: str
    identifier: str
    title: str | None = None
    description: JiraRichDescription | None = None
    state: JiraIssueState | None = None
    priority: int | None = None
    assignee: JiraIssueAssignee | None = None
    labels: list[str] | None = None
    due_date: str | None = None
    project: JiraIssueProjectRef | None = None
    issue_type: JiraIssueTypeRef | None = None
    url: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class JiraSearchTicketToolInput(TerseModel):
    integration_id: str
    jql: str | None = None
    text: str | None = None
    project_key: str | None = None
    assignee_email: str | None = None
    status: str | None = None
    limit: int | None = None
    next_page_token: str | None = None


JiraSearchTicketInput = JiraSearchTicketToolInput


class JiraUpdateTicketToolInput(TerseModel):
    integration_id: str
    issue_key: str
    title: str | None = None
    description: str | None = None
    status: str | None = None
    assignee: JiraAssigneeInput | None = None
    priority: int | None = None
    labels: list[str] | None = None
    due_date: str | None = None


JiraUpdateTicketInput = JiraUpdateTicketToolInput


class LaunchDarklyConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["launchdarkly"]
    config_type: Literal["launchdarkly"]
    project_key: str
    environment_keys: list[str]


class LaunchDarklyEnvironment(TerseModel):
    key: str
    name: str


class LaunchDarklyEnvironmentConfigInstance(TerseModel):
    on: bool
    targets: list[dict[str, Any]]
    context_targets: list[dict[str, Any]]
    rules: list[dict[str, Any]]
    fallthrough: dict[str, Any] | None
    off_variation: int | None
    prerequisites: list[dict[str, Any]]


class LaunchDarklyEnvironmentsResponse(TerseModel):
    environments: list[LaunchDarklyEnvironment]


class LaunchDarklyFlagMetadata(TerseModel):
    key: str
    name: str
    description: str
    kind: str
    variations: list[dict[str, Any]]
    tags: list[str]
    maintainer_id: str | None


class LaunchDarklyFlagSummary(TerseModel):
    key: str
    name: str
    description: str
    environments: dict[str, bool]
    url: str
    environment_urls: dict[str, str]


class LaunchDarklyHistoryEntry(TerseModel):
    id: str
    timestamp: str
    kind: str
    key: str
    name: str
    description: str
    member: dict[str, Any] | None
    changes: list[dict[str, Any]]


class LaunchDarklyHistoryResult(TerseModel):
    entries: list[LaunchDarklyHistoryEntry]
    total_entries: int
    url: str


class LaunchDarklyIntegrationInstance(TerseModel):
    id: str
    email: EmailStr | None = None
    token_name: str | None = None


class LaunchDarklyProject(TerseModel):
    key: str
    name: str


class LaunchDarklyProjectsResponse(TerseModel):
    projects: list[LaunchDarklyProject]


class LinearAddCommentToolInput(TerseModel):
    integration_id: str
    issue_id: str
    body: str


LinearAddCommentInput = LinearAddCommentToolInput


class LinearCommentHandle(TerseModel):
    id: str
    body: str | None = None
    created_at: str | str | None = None
    updated_at: str | str | None = None


class LinearCreateTicketPayload(TerseModel):
    title: str
    team_id: str
    description: str | None = None
    state_id: str | None = None
    priority: int | None = None
    project_id: str | None = None
    label_ids: list[str] | None = None
    assignee_id: str | None = None


class LinearCreateTicketToolInput(TerseModel):
    integration_id: str
    ticket: LinearCreateTicketPayload


LinearCreateTicketInput = LinearCreateTicketToolInput


class LinearGetLabelsToolInput(TerseModel):
    integration_id: str
    team_id: str | None = None


LinearGetLabelsInput = LinearGetLabelsToolInput


class LinearGetProjectsToolInput(TerseModel):
    integration_id: str
    team_id: str | None = None


LinearGetProjectsInput = LinearGetProjectsToolInput


class LinearGetStatesToolInput(TerseModel):
    integration_id: str
    team_id: str | None = None


LinearGetStatesInput = LinearGetStatesToolInput


class LinearGetTeamsToolInput(TerseModel):
    integration_id: str


LinearGetTeamsInput = LinearGetTeamsToolInput


class LinearGetUsersToolInput(TerseModel):
    integration_id: str


LinearGetUsersInput = LinearGetUsersToolInput


class LinearInputConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["linear"]
    config_type: Literal["linear_input"]
    project_id: str | None = None
    project_name: str | None = None
    event_types: list[Literal["issue.created", "issue.updated", "comment.created"]] | None = None


class LinearIntegrationInstance(TerseModel):
    id: str
    workspace_name: str


class LinearIssueAssignee(TerseModel):
    id: str
    name: str
    email: str | None = None


class LinearIssueHandle(TerseModel):
    id: str
    identifier: str
    title: str
    description: str | None = None
    url: str
    created_at: str | str | None = None
    updated_at: str | str | None = None


class LinearIssueProject(TerseModel):
    id: str
    name: str


class LinearIssueSummary(TerseModel):
    id: str
    identifier: str
    title: str
    description: str | None = None
    state: str
    priority: int | None = None
    assignee: LinearIssueAssignee | None
    url: str
    created_at: str | str
    updated_at: str | str


class LinearLabelSummary(TerseModel):
    id: str
    name: str
    color: str
    team_id: str


class LinearOutputConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["linear"]
    config_type: Literal["linear_output"]
    team_id: str | None = None
    team_name: str | None = None
    project_id: str | None = None
    project_name: str | None = None


class LinearProjectSummary(TerseModel):
    id: str
    name: str
    description: str | None = None
    team_id: str


class LinearReadTicketComment(TerseModel):
    id: str
    body: str
    author_id: str
    created_at: str


class LinearReadTicketToolInput(TerseModel):
    integration_id: str
    issue_id: str
    include_comments: bool | None = None


LinearReadTicketInput = LinearReadTicketToolInput


class LinearSearchPagination(TerseModel):
    has_next_page: bool
    end_cursor: str | None
    limit: int | None


class LinearSearchTicketDateFilterField(StrEnum):
    UPDATED_AT = "updatedAt"
    CREATED_AT = "createdAt"


class LinearSearchTicketToolInput(TerseModel):
    integration_id: str
    search_term: str
    state_names: list[Literal["Triage", "Backlog", "Todo", "In Progress", "In Review", "Done", "Canceled"]] | None = (
        None
    )
    date_filter_field: LinearSearchTicketDateFilterField | None = None
    date_after: str | None = None
    date_before: str | None = None
    limit: int | None = None
    after: str | None = None


LinearSearchTicketInput = LinearSearchTicketToolInput


class LinearStateSummary(TerseModel):
    id: str
    name: str
    type: str
    color: str
    team_id: str


class LinearTeam(TerseModel):
    id: str
    name: str
    key: str


class LinearIssueDetail(TerseModel):
    id: str
    identifier: str
    title: str
    description: str | None = None
    state: str
    priority: int | None = None
    assignee: LinearIssueAssignee | None
    url: str
    created_at: str | str
    updated_at: str | str
    team: LinearTeam | None
    project: LinearIssueProject | None
    due_date: str | str | None = None
    estimate: float | None = None


LinearIssueTeam = LinearTeam


class LinearUpdateTicketUpdates(TerseModel):
    title: str | None = None
    description: str | None = None
    state_id: str | None = None
    priority: int | None = None
    project_id: str | None = None
    label_ids: list[str] | None = None
    assignee_id: str | None = None


class LinearUpdateTicketToolInput(TerseModel):
    integration_id: str
    issue_id: str
    updates: LinearUpdateTicketUpdates


LinearUpdateTicketInput = LinearUpdateTicketToolInput


class LinearUserSummary(TerseModel):
    id: str
    name: str
    email: str
    avatar_url: str | None = None


class LinearWorkspace(TerseModel):
    id: str
    name: str


class ListGitHubCommitsToolInput(TerseModel):
    repository: str
    since: str | None
    until: str | None = None
    branch: str | None = None
    path: str | None = None
    author: str | None = None
    per_page: int


ListGitHubCommitsInput = ListGitHubCommitsToolInput


class ListGitHubDirectoryToolInput(TerseModel):
    repository: str
    path: str
    recursive: bool


ListGitHubDirectoryInput = ListGitHubDirectoryToolInput


class ListGitHubPullRequestsToolInput(TerseModel):
    repository: str
    state: Literal["open", "closed", "all"]
    since: str | None
    until: str | None
    per_page: int
    page: Annotated[int, Field(ge=1)] | None


ListGitHubPullRequestsInput = ListGitHubPullRequestsToolInput


class ListLaunchDarklyFlagsToolInput(TerseModel):
    integration_id: str
    project_key: str
    environment_keys: list[str]
    summary: bool
    filter: str | None = None
    tags: list[str] | None = None


ListLaunchDarklyFlagsInput = ListLaunchDarklyFlagsToolInput


class ListRumEventsToolInput(TerseModel):
    integration_id: str
    query: str | None = None
    from_: str | None = Field(None, alias="from")
    to: str | None = None
    limit: int
    page_cursor: str | None = None
    sort: Literal["timestamp", "-timestamp"]


ListRumEventsInput = ListRumEventsToolInput


class ListWorkOSOrganizationsToolInput(TerseModel):
    integration_id: str
    limit: int
    after: str | None = None


ListWorkOSOrganizationsInput = ListWorkOSOrganizationsToolInput


class ListWorkOSUsersToolInput(TerseModel):
    integration_id: str
    email: str | None = None
    organization_id: str | None = None
    limit: int
    after: str | None = None


ListWorkOSUsersInput = ListWorkOSUsersToolInput


class NotionConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["notion"]
    config_type: Literal["notion"]
    database_ids: list[str]
    database_names: list[str]
    page_ids: list[str]
    page_names: list[str]


class NotionCreateOrUpdateDatabaseRowToolInput(TerseModel):
    integration_id: str
    database_id: str
    page_id: str | None
    properties_json: str


NotionCreateOrUpdateDatabaseRowInput = NotionCreateOrUpdateDatabaseRowToolInput


class NotionCreateOrUpdatePageToolInput(TerseModel):
    integration_id: str
    page_id: str | None = None
    parent_page_id: str | None = None
    title: str


NotionCreateOrUpdatePageInput = NotionCreateOrUpdatePageToolInput


class NotionDateReference(TerseModel):
    start: str | None = None
    end: str | None = None
    time_zone: str | None = None


class NotionFetchRelatedEventsToolInput(TerseModel):
    integration_id: str
    page_id: str
    block_id: str


NotionFetchRelatedEventsInput = NotionFetchRelatedEventsToolInput


class NotionFileReference(TerseModel):
    name: str
    type: str
    file: str | None = None
    external: str | None = None


class NotionGetSchemaToolInput(TerseModel):
    integration_id: str
    database_id: str


NotionGetSchemaInput = NotionGetSchemaToolInput


class NotionIntegrationInstance(TerseModel):
    id: str
    workspace_id: str | None = None
    workspace_name: str | None = None


class NotionListUsersToolInput(TerseModel):
    integration_id: str
    query: str | None = None


NotionListUsersInput = NotionListUsersToolInput


class NotionModifyBlocksToolInput(TerseModel):
    integration_id: str
    page_id: str
    operation_json: str


NotionModifyBlocksInput = NotionModifyBlocksToolInput


NotionPageParent = dict[str, Any]


NotionLooseObject = NotionPageParent


class NotionQueryDatabaseToolInput(TerseModel):
    integration_id: str
    database_id: str
    filter_properties: list[str] | None = None
    filter: str | None = None
    page_size: Annotated[int, Field(ge=1, le=100)] | None = None
    start_cursor: str | None = None
    result_type: Literal["page", "data_source"] | None = None


NotionQueryDatabaseInput = NotionQueryDatabaseToolInput


class NotionQueryPageToolInput(TerseModel):
    integration_id: str
    page_id: str


NotionQueryPageInput = NotionQueryPageToolInput


class NotionResourceType(StrEnum):
    DATABASE = "database"
    PAGE = "page"


class NotionResource(TerseModel):
    id: str
    title: str
    url: str
    type: NotionResourceType


class NotionResourcesResponse(TerseModel):
    resources: list[NotionResource]


class NotionSchemaProperty(TerseModel):
    type: str
    id: str
    options: list[str] | None = None
    format_example: str | None = None


class NotionUserReference(TerseModel):
    id: str
    name: str | None = None
    object: str | None = None


class NotionPageBlock(TerseModel):
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


NotionReadablePropertyValue = (
    str
    | float
    | bool
    | None
    | list[str]
    | NotionDateReference
    | NotionUserReference
    | list[NotionUserReference]
    | list[NotionFileReference]
    | NotionPageParent
)


class NotionDatabaseQueryPage(TerseModel):
    page_id: str
    properties: dict[str, NotionReadablePropertyValue]
    url: str | None = None
    created_time: str | None = None
    last_edited_time: str | None = None


class NotionWorkspaceUser(TerseModel):
    id: str
    name: str
    email: str | None = None


class OauthInstallationDetails(TerseModel):
    oauth_url: str


class OutputItem(TerseModel):
    output_item_id: str
    output_item_type: ConfigTypeEnum


class PartialSdkAgentRunEventPayload(TerseModel):
    integration_type: IntegrationTypeEnum | None = None
    formatted_content: str | None = None
    debug_log: str | None = None


class PosthogConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["posthog"]
    config_type: Literal["POSTHOG"]
    project_id: str
    project_name: str | None = None


class PosthogEventCount(TerseModel):
    event_name: str
    count: int


class PosthogEventSummary(TerseModel):
    id: str
    event: str
    timestamp: str | None = None
    distinct_id: str | None = None
    url: str | None = None


class PosthogIntegrationInstance(TerseModel):
    id: str
    email: EmailStr | None = None
    org_name: str | None = None


class PosthogLogEntry(TerseModel):
    id: str
    timestamp: str | None = None
    level: str
    message: str
    service: str
    attributes: dict[str, Any]


class PosthogOffsetPagination(TerseModel):
    limit: int
    offset: int
    has_more: bool
    next_offset: int | None
    showing: str


class PosthogProject(TerseModel):
    id: str
    name: str
    organization_id: str | None = None


class PosthogProjectsResponse(TerseModel):
    projects: list[PosthogProject]


class PosthogPropertyFilterOperator(StrEnum):
    EXACT = "exact"
    IS_NOT = "is_not"
    ICONTAINS = "icontains"
    NOT_ICONTAINS = "not_icontains"
    GT = "gt"
    LT = "lt"
    GTE = "gte"
    LTE = "lte"


PosthogPropertyFilterValue = str | float | bool


class PosthogPropertyFilter(TerseModel):
    key: str
    value: PosthogPropertyFilterValue
    operator: PosthogPropertyFilterOperator


class PosthogSearchSessionsPagination(TerseModel):
    limit: int
    offset: int
    has_next: bool
    has_previous: bool
    next_offset: int | None
    previous_offset: int | None


class PosthogSessionConsoleLog(TerseModel):
    timestamp: str
    level: str
    message: str


class PosthogSessionEventType(StrEnum):
    CLICK = "click"
    INPUT = "input"
    SCROLL = "scroll"
    CONSOLE = "console"
    NETWORK_ERROR = "network_error"
    NAVIGATION = "navigation"
    CUSTOM = "custom"
    PAGE_LOAD = "page_load"
    VIEWPORT_RESIZE = "viewport_resize"


class PosthogSessionEvent(TerseModel):
    type: PosthogSessionEventType
    timestamp: float
    relative_time: float
    data: dict[str, Any]


class PosthogSessionEventsSummary(TerseModel):
    total_raw_events: int
    meaningful_events_returned: int
    console_logs_returned: int


class PosthogSessionEventsTimeWindow(TerseModel):
    start_seconds: float
    end_seconds: float | None


class PosthogSessionSummary(TerseModel):
    id: str
    start_time: str | None = None
    end_time: str | None = None
    duration: float | None = None
    events_count: int
    session_url: str
    person_id: str
    distinct_id: str


class PosthogSeverityLevel(StrEnum):
    ERROR = "error"
    WARN = "warn"
    INFO = "info"
    DEBUG = "debug"


class ReadGitHubFileToolInput(TerseModel):
    repository: str
    path: str
    start_line: int | None = None
    end_line: int | None = None


ReadGitHubFileInput = ReadGitHubFileToolInput


class Repository(TerseModel):
    name: str
    owner: str
    id: int


class GetGithubRepositoriesForIntegrationResponse(TerseModel):
    repositories: list[Repository]


class GithubAppInstallationCallbackRequest(TerseModel):
    name: str
    email: str
    username: str
    installation_id: int
    account_name: str | None
    repositories: list[Repository]


class Role(StrEnum):
    ADMIN = "admin"
    USER = "user"


class RunHistoryAction(TerseModel):
    action: str
    integration: IntegrationTypeEnum
    target: str
    details: str
    url: str | None = None
    step_id: str | None = None
    type: Literal["create", "update", "delete", "read", "approve", "error"]
    is_read_only: bool | None = None
    output_items: list[OutputItem] | None = None


class AggregateRumEventsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    query: str | None
    from_: str = Field(alias="from")
    to: str | None
    compute: str
    group_by: str
    total_buckets: int
    buckets: list[DatadogAggregationBucket]
    rum_link: str
    pagination: DatadogPagePagination
    warnings: str | None
    meta: DatadogAggregationMeta
    message: str


class AttioListObjectsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    objects: list[AttioObjectWithAttributes]
    count: int


class AttioQueryRecordsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    records: list[AttioRecord]
    count: int


class AttioUpsertRecordToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    records: list[AttioRecord] | None = None
    count: int | None = None
    requested_count: int | None = None
    success_count: int | None = None
    failure_count: int | None = None
    partial: bool | None = None
    errors: list[AttioUpsertError] | None = None


class ConfluenceAddCommentToolOutput(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    comment_id: str
    comment_text: str
    position: ConfluenceCommentPosition
    text_commented_on: str | None = None
    message: str


class ConfluenceQueryPageToolOutput(TerseModel):
    success: Literal[True]
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
    ancestors_count: int
    descendants_count: int


class GetLaunchDarklyFlagDetailsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    project_key: str
    flag: LaunchDarklyFlagMetadata
    environments: dict[str, LaunchDarklyEnvironmentConfigInstance]
    url: str
    history: LaunchDarklyHistoryResult | None = None
    message: str


class GetPosthogSessionEventsToolOutput(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    session_id: str
    session_url: str
    start_time: str
    duration: float | None = None
    time_window: PosthogSessionEventsTimeWindow
    summary: PosthogSessionEventsSummary
    events: list[PosthogSessionEvent]
    console_logs: list[PosthogSessionConsoleLog]
    message: str


class GmailCreateDraftToolOutput(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    draft_id: str
    message_id: str
    thread_id: str
    draft_url: str
    to: str
    subject: str
    summary: str
    is_reply: bool


class GmailSendEmailToolOutput(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    message_id: str
    thread_id: str
    to: str
    subject: str
    summary: str
    is_reply: bool


class GrepGitHubCodeToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    total_count: int
    results_returned: int
    pattern: str
    query: str
    repositories: list[str]
    pagination: GitHubPagination
    results: list[GitHubCodeGrepResult]
    message: str
    tip: str


class ImageEditToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    url: str
    image_url: str
    summary: str
    snippets: list[ImageEditSnippet]


ImageEditOutput = ImageEditToolOutput


class JiraCreateTicketToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    issue: JiraIssueSummary


class JiraSearchTicketToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    issues: list[JiraIssueSummary]
    count: int
    total: int
    max_results: int
    is_last: bool
    next_page_token: str | None = None
    jql: str


class JiraUpdateTicketToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    issue: JiraIssueSummary
    updated_fields: list[str]


class LinearAddCommentToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    comment: LinearCommentHandle


class LinearCreateTicketToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    issue: LinearIssueHandle


class LinearGetLabelsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    labels: list[LinearLabelSummary]


class LinearGetProjectsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    projects: list[LinearProjectSummary]


class LinearGetStatesToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    states: list[LinearStateSummary]


class LinearGetTeamsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    teams: list[LinearTeam]


class LinearGetUsersToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    users: list[LinearUserSummary]


class LinearReadTicketToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    issue: LinearIssueDetail
    comments: list[LinearReadTicketComment] | None = None


class LinearSearchTicketToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    issues: list[LinearIssueSummary]
    count: int
    query: str
    pagination: LinearSearchPagination


class LinearUpdateTicketToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    issue: LinearIssueHandle


class ListGitHubCommitsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    repository: str
    time_window: str
    filters: str
    summary: GitHubCommitListSummary
    commits: list[GitHubCommitSummary]
    message: str
    tip: str


class ListGitHubDirectoryToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    repository: str
    path: str
    recursive: bool
    total_items: int
    directories: list[GitHubDirectoryEntry | str]
    files: list[GitHubFileEntry]
    warning: str | None = None
    tip: str | None = None
    truncated: bool | None = None
    other: list[GitHubOtherEntry] | None = None


class ListGitHubPullRequestsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    repository: str
    time_window: str
    summary: GitHubPullRequestListSummary
    pagination: GitHubPagination
    pull_requests: list[GitHubPullRequestSummary]
    message: str


class ListLaunchDarklyFlagsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    project_key: str
    total_flags: int
    flags: list[LaunchDarklyFlagSummary]
    flags_link: str
    message: str


class ListRumEventsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    query: str | None
    total_events: int
    events: list[DatadogRumEvent]
    events_by_type: dict[str, int]
    rum_link: str
    pagination: DatadogCursorPagination
    warnings: str | None
    message: str


class NotionDatabaseRowMutationResult(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    action: Literal["created", "updated"]
    page_id: str
    url: str | None = None


NotionCreateOrUpdateDatabaseRowToolOutput = NotionDatabaseRowMutationResult


NotionCreateOrUpdatePageToolOutput = NotionDatabaseRowMutationResult


class NotionFetchRelatedEventsToolOutput(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    events_count: int
    events: str | None = None
    message: str


class NotionGetSchemaToolOutput(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    data_source_id: str
    database_name: str
    schema_: dict[str, NotionSchemaProperty] = Field(alias="schema")
    property_count: int


class NotionListUsersToolOutput(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    users: list[NotionWorkspaceUser]
    count: int


class NotionModifyBlocksAppendResult(TerseModel):
    operation: Literal["append"]
    actions: list[RunHistoryAction]
    block_ids: list[str]
    blocks_count: int


class NotionModifyBlocksAppendSuccess(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    operation: Literal["append"]
    block_ids: list[str]
    blocks_count: int


class NotionModifyBlocksDeleteResult(TerseModel):
    operation: Literal["delete"]
    actions: list[RunHistoryAction]
    block_id: str


class NotionModifyBlocksSingleBlockSuccess(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    operation: Literal["update", "delete"]
    block_id: str


class NotionModifyBlocksUpdateResult(TerseModel):
    operation: Literal["update"]
    actions: list[RunHistoryAction]
    block_id: str


class NotionModifyBlocksOperationResult(
    RootModel[NotionModifyBlocksAppendResult | NotionModifyBlocksUpdateResult | NotionModifyBlocksDeleteResult]
):
    root: NotionModifyBlocksAppendResult | NotionModifyBlocksUpdateResult | NotionModifyBlocksDeleteResult


class NotionModifyBlocksBatchSuccess(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    operations: list[NotionModifyBlocksOperationResult]
    block_ids: list[str]
    total_operations: int


class NotionModifyBlocksFailure(TerseModel):
    success: Literal[False]
    actions: list[RunHistoryAction] | None = None
    error: str
    block_ids: list[str]
    operations: list[NotionModifyBlocksOperationResult] | None = None
    failed_at_index: int | None = None
    total_operations: int | None = None
    hint: str | None = None
    retry_instructions: str | None = None


class NotionModifyBlocksSuccess(
    RootModel[NotionModifyBlocksAppendSuccess | NotionModifyBlocksSingleBlockSuccess | NotionModifyBlocksBatchSuccess]
):
    root: NotionModifyBlocksAppendSuccess | NotionModifyBlocksSingleBlockSuccess | NotionModifyBlocksBatchSuccess


class NotionModifyBlocksToolOutput(RootModel[NotionModifyBlocksSuccess | NotionModifyBlocksFailure]):
    root: NotionModifyBlocksSuccess | NotionModifyBlocksFailure


class NotionQueryDatabaseFailure(TerseModel):
    success: Literal[False]
    actions: list[RunHistoryAction] | None = None
    pages: list[NotionDatabaseQueryPage]
    total_returned: Literal[0]
    has_more: Literal[False]
    next_cursor: None
    error: str
    hint: str


class NotionQueryDatabaseSuccess(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    pages: list[NotionDatabaseQueryPage]
    total_returned: int
    has_more: bool
    next_cursor: str | None


class NotionQueryDatabaseToolOutput(RootModel[NotionQueryDatabaseSuccess | NotionQueryDatabaseFailure]):
    root: NotionQueryDatabaseSuccess | NotionQueryDatabaseFailure


class NotionQueryPageToolOutput(TerseModel):
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
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    properties: dict[str, NotionReadablePropertyValue]
    properties_raw: dict[str, Any] | None = None
    blocks: list[NotionPageBlock]
    blocks_count: int


class PosthogSearchSessionsFound(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    user_email: str
    project_id: str
    person_found: Literal[True]
    person_id: str
    distinct_id: str
    total_sessions: int
    sessions: list[PosthogSessionSummary]
    sessions_link: str
    pagination: PosthogSearchSessionsPagination
    message: str


class PosthogSearchSessionsNotFound(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    user_email: str
    project_id: str
    person_found: Literal[False]
    sessions: list[PosthogSessionSummary]
    total_sessions: Literal[0]
    message: str


class ReadGitHubFileToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    repository: str
    path: str
    url: str
    total_lines: int
    displayed_lines: str
    size: int
    content: str
    warning: str | None = None


class SdkAgentRunEventPayload(TerseModel):
    integration_type: IntegrationTypeEnum
    formatted_content: str
    debug_log: str


class SdkAgentRunNormalizedRequestOptions(TerseModel):
    max_turns: int
    require_approval: bool


class SdkAgentRunOptionsPayload(TerseModel):
    max_turns: int | None = None
    require_approval: bool | None = None


class SdkAgentRunResponseContract(TerseModel):
    response_mode: Literal["streaming"]
    supports_interruptions: bool


class SdkAgentSkillPayload(TerseModel):
    config_type: ConfigTypeEnum
    config: dict[str, Any]


class SdkAgentRunNormalizedRequest(TerseModel):
    prompt: str
    event: SdkAgentRunEventPayload
    skills: list[SdkAgentSkillPayload]
    tool_approvals: list[str]
    options: SdkAgentRunNormalizedRequestOptions


class SdkAgentRunRequestBody(TerseModel):
    prompt: str | None = None
    event: PartialSdkAgentRunEventPayload | None = None
    skills: list[SdkAgentSkillPayload] | None = None
    options: SdkAgentRunOptionsPayload | None = None
    tool_approvals: list[str] | None = None


class SdkAgentRunResponseBody(TerseModel):
    success: bool
    error: str | None = None
    details: list[str] | None = None
    contract: SdkAgentRunResponseContract | None = None
    normalized_request: SdkAgentRunNormalizedRequest | None = None


class SdkApprovalDecisionRequestBody(TerseModel):
    run_id: str
    step_id: str
    approved: bool


class SdkDeployJob(TerseModel):
    job_name: str
    triggers: list[AgentTrigger]
    outputs: list[AgentOutput]
    tool_approvals: list[str]
    webhook_url: str | None = None


class SdkDeployRemoved(TerseModel):
    id: str
    name: str


class SdkDeployRequestBody(TerseModel):
    jobs: list[SdkDeployJob]
    source_zip_base64: str


class SdkDeployResult(TerseModel):
    job_name: str
    automation_id: str
    is_update: bool


class SdkDeployResponseBody(TerseModel):
    success: bool
    results: list[SdkDeployResult]
    removed: list[SdkDeployRemoved]
    error: str | None = None
    details: str | None = None


class SearchDatadogLogsToolInput(TerseModel):
    integration_id: str
    default_indexes: list[str] | None = None
    query: str | None = None
    indexes: list[str] | None = None
    from_: str | None = Field(None, alias="from")
    to: str | None = None
    limit: int
    cursor: str | None = None
    sort: Literal["timestamp", "-timestamp"]


SearchDatadogLogsInput = SearchDatadogLogsToolInput


class SearchDatadogLogsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    query: str | None
    indexes: list[str]
    total_logs: int
    logs: list[DatadogLogEntry]
    logs_link: str
    pagination: DatadogCursorPagination
    warnings: str | None
    message: str


class SearchGitHubCodeToolInput(TerseModel):
    repository_names: list[str]
    query: str
    language: str | None = None
    filename: str | None = None
    path: str | None = None
    per_page: int
    page: Annotated[int, Field(ge=1)] | None


SearchGitHubCodeInput = SearchGitHubCodeToolInput


class SearchGitHubCodeToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    total_count: int
    results_returned: int
    query: str
    repositories: list[str]
    pagination: GitHubPagination
    results: list[GitHubCodeSearchResult]
    message: str
    tip: str


class SearchPosthogEventsCountSummary(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    count_by_event_name_only: Literal[True]
    custom_events_only: bool
    event_counts: list[PosthogEventCount]
    total_event_types: int
    events_link: str
    message: str


class SearchPosthogEventsEventList(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    user_email: str | None
    event_name: str | None
    project_id: str
    total_events: int
    events: list[PosthogEventSummary]
    events_link: str
    pagination: PosthogOffsetPagination
    message: str


class SearchPosthogEventsToolInput(TerseModel):
    integration_id: str
    project_id: str
    count_by_event_name_only: bool
    custom_events_only: bool
    user_email: str | None = None
    event_name: str | None = None
    property_filters: list[PosthogPropertyFilter] | None = None
    limit: int
    offset: int
    last7_days: bool
    date_from: str | None
    date_to: str | None


SearchPosthogEventsInput = SearchPosthogEventsToolInput


class SearchPosthogEventsToolOutput(RootModel[SearchPosthogEventsCountSummary | SearchPosthogEventsEventList]):
    root: SearchPosthogEventsCountSummary | SearchPosthogEventsEventList


class SearchPosthogLogsToolInput(TerseModel):
    integration_id: str
    project_id: str
    user_email: str | None = None
    severity_levels: list[PosthogSeverityLevel] | None
    message_search: str | None = None
    limit: int
    offset: int
    last7_days: bool
    date_from: str | None
    date_to: str | None = None


SearchPosthogLogsInput = SearchPosthogLogsToolInput


class SearchPosthogLogsToolOutput(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None
    user_email: str | None
    severity_levels: list[PosthogSeverityLevel] | None
    message_search: str | None
    project_id: str
    total_logs: int
    logs: list[PosthogLogEntry]
    logs_link: str
    pagination: PosthogOffsetPagination
    message: str


class SearchPosthogSessionsToolInput(TerseModel):
    integration_id: str
    project_id: str
    user_email: str
    limit: int
    offset: int
    last7_days: bool
    date_from: str | None
    date_to: str | None = None


SearchPosthogSessionsInput = SearchPosthogSessionsToolInput


class SearchPosthogSessionsToolOutput(RootModel[PosthogSearchSessionsFound | PosthogSearchSessionsNotFound]):
    root: PosthogSearchSessionsFound | PosthogSearchSessionsNotFound


class SearchRumEventsToolInput(TerseModel):
    integration_id: str
    query: str | None = None
    from_: str = Field(alias="from")
    to: str | None = None
    limit: int
    page_cursor: str | None = None
    sort: Literal["timestamp", "-timestamp"]
    timezone: str


SearchRumEventsInput = SearchRumEventsToolInput


class SearchRumEventsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    query: str | None
    total_events: int
    events: list[DatadogRumEvent]
    events_by_type: dict[str, int]
    rum_link: str
    pagination: DatadogCursorPagination
    warnings: str | None
    message: str


class SerializedEvent(TerseModel):
    integration_type: IntegrationTypeEnum
    event_type: str | None = None
    formatted_content: str
    debug_log: str
    metadata: dict[str, Any] | None = None


class SlackChannel(TerseModel):
    id: str
    name: str
    is_private: bool
    is_archived: bool
    is_mpim: bool


class SlackChannelListItem(TerseModel):
    id: str | None = None
    name: str
    is_private: bool
    is_im: bool
    is_mpim: bool
    user_id: str | None = None


class SlackChannelsResponse(TerseModel):
    channels: list[SlackChannel]
    selected_channel_id: str | None


class SlackConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["slack"]
    config_type: Literal["slack"]
    channel_id: str | None = None
    channel_name: str | None = None
    listen_to_user_dms: bool
    user_ids: list[str] | None = None
    event_types: list[Literal["message", "app_mention", "reaction_added"]] | None = None


class SlackConversationMessage(TerseModel):
    user_id: str | None = None
    user_name: str | None = None
    text: str
    timestamp: str | None = None
    thread_ts: str | None = None


class SlackIntegrationInstance(TerseModel):
    id: str
    team_id: str | None = None
    team_name: str | None = None
    is_bot_user: bool | None = None


class SlackListChannelsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    channels: list[SlackChannelListItem]
    count: int
    next_cursor: str | None
    has_more: bool


class SlackListChannelsTypes(StrEnum):
    PUBLIC = "public"
    PRIVATE = "private"
    IM = "im"
    MPIM = "mpim"
    ALL = "all"


class SlackListChannelsToolInput(TerseModel):
    integration_id: str
    types: SlackListChannelsTypes | None = None
    limit: Annotated[int, Field(ge=1, le=500)] | None
    cursor: str | None = None


SlackListChannelsInput = SlackListChannelsToolInput


class SlackListUsersToolInput(TerseModel):
    integration_id: str
    query: str | None = None


SlackListUsersInput = SlackListUsersToolInput


class SlackOutputConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["slack"]
    config_type: Literal["slack_output"]
    channel_id: str | None = None
    channel_name: str | None = None
    user_ids: list[str] | None = None
    user_names: list[str] | None = None
    listen_to_user_dms: bool


class SlackReadConversationToolInput(TerseModel):
    integration_id: str
    channel_id: str
    limit: Annotated[int, Field(ge=1, le=200)] | None
    cursor: str | None = None


SlackReadConversationInput = SlackReadConversationToolInput


class SlackReadConversationToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    channel_id: str
    channel_name: str | None = None
    messages: list[SlackConversationMessage]
    count: int
    has_more: bool
    next_cursor: str | None


class SlackSendMessageToolInput(TerseModel):
    integration_id: str
    channel_id: str
    message: str
    thread_ts: str | None = None
    blocks: str | None = None


SlackSendMessageInput = SlackSendMessageToolInput


class SlackSendMessageToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    message_ts: str | None = None
    channel: str
    thread_ts: str | None = None
    summary: str
    has_blocks: bool


class SlackUserSummary(TerseModel):
    id: str
    name: str


class SlackListUsersToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    users: list[SlackUserSummary]
    count: int


class SlackUsersResponse(TerseModel):
    users: list[SlackUserSummary]


class SnowflakeExecuteQueryToolInput(TerseModel):
    integration_id: str
    query: str


SnowflakeExecuteQueryInput = SnowflakeExecuteQueryToolInput


class SnowflakeExplainQueryToolInput(TerseModel):
    integration_id: str
    query: str


SnowflakeExplainQueryInput = SnowflakeExplainQueryToolInput


class SnowflakeIntegrationInstance(TerseModel):
    id: str
    account_identifier: str
    username: str
    warehouse: str
    database_name: str | None = None
    schema_name: str | None = None


class SnowflakeOutputConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["snowflake"]
    config_type: Literal["snowflake_output"]


SnowflakeQueryRow = dict[str, Any]


class SnowflakeExecuteQueryToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    rows: list[SnowflakeQueryRow]
    columns: list[str]
    row_count: int


class SnowflakeExplainQueryToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    explain_plan: list[SnowflakeQueryRow]
    columns: list[str]
    row_count: int


class StatsInterval(StrEnum):
    _1H = "1h"
    _24H = "24h"
    _7D = "7d"
    _1MO = "1mo"
    _3MO = "3mo"
    _1Y = "1y"


class SubActivity(TerseModel):
    summary: str
    commits: list[CommitAssociation]


class ActivityEvent(TerseModel):
    event_type: str
    title: str
    github_repository_owner_id: str
    github_repository_name: str
    created_at: str
    sub_activities: list[SubActivity]


class SummarizeGitHubPullRequestDiffToolInput(TerseModel):
    repository: str
    pull_number: int
    page: Annotated[int, Field(ge=1)] | None
    context: str | None


SummarizeGitHubPullRequestDiffInput = SummarizeGitHubPullRequestDiffToolInput


class SummarizeGitHubPullRequestDiffToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    repository: str
    pull_request: GitHubPullRequestRef
    summary: dict[str, Any]
    pagination: GitHubPagination
    analysis: str
    message: str


class TemplateCategory(StrEnum):
    SHIP = "ship"
    USERS = "users"
    SYNC = "sync"
    TRACK = "track"


class TemplateConfigRef(TerseModel):
    config_type: ConfigTypeEnum
    integration_type: IntegrationTypeEnum


class TemplateOutput(TerseModel):
    config: TemplateConfigRef


class TemplateTrigger(TerseModel):
    config: TemplateConfigRef


class AgentTemplate(TerseModel):
    id: str
    category: TemplateCategory
    name: str
    description: str
    chat_prompt: str
    prompt: AgentPrompt
    triggers: list[TemplateTrigger]
    outputs: list[TemplateOutput]
    require_approval: bool
    is_active: bool


class TerseAgentMessageEventPayload(TerseModel):
    run_id: str
    automation_id: str
    organization_id: str


class TerseAgentMessageMetadata(TerseModel):
    event_type: Literal["terse_agent_message"]
    event_payload: TerseAgentMessageEventPayload


class TerseConfigInstance(TerseModel):
    integration_id: Literal["system"]
    integration_type: Literal["terse"]
    config_type: Literal["terse"]


class TimeTriggerConfigInstance(TerseModel):
    integration_id: Literal["system"]
    integration_type: Literal["cron_job"]
    config_type: Literal["time_trigger"]
    cron_expression: str


class ToggleImprovementsEnabledResponse(TerseModel):
    success: bool
    improvements_enabled: bool


class ToolOutputBase(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None


class ToolOutputFailure(TerseModel):
    success: Literal[False]
    actions: list[RunHistoryAction] | None = None


class ToolOutputSuccess(TerseModel):
    success: Literal[True]
    actions: list[RunHistoryAction] | None = None


class TransientAgentOutput(TerseModel):
    id: str
    config: BaseConfigInstance | None = None
    config_type: ConfigTypeEnum


class TransientAgentTrigger(TerseModel):
    id: str
    config: BaseConfigInstance | None = None
    config_type: ConfigTypeEnum


class TriggerPayload(TerseModel):
    integration_id: str
    integration_type: IntegrationTypeEnum
    config: dict[str, Any]


class UseConfluenceResourcesReturnBase(TerseModel):
    resources: list[ConfluencePage]
    response: ConfluenceResourcesResponse | None = None
    is_loading: bool
    is_error: bool
    error: Any
    is_validating: bool


class User(TerseModel):
    id: str
    workos_id: str
    organization_id: str
    organization_name: str
    email: str
    display_name: str
    first_name: str | None
    last_name: str | None
    display_photo_url: str
    roles: list[Role]


class UserNoOrganization(TerseModel):
    id: str
    workos_id: str
    email: str
    display_name: str
    first_name: str | None
    last_name: str | None
    display_photo_url: str


class WebExtractResultItem(TerseModel):
    url: str
    raw_content: str


class WebExtractToolInput(TerseModel):
    urls: str | list[str]
    extract_depth: Literal["basic", "advanced"] | None


WebExtractInput = WebExtractToolInput


class WebExtractToolOutput(TerseModel):
    results: list[WebExtractResultItem]
    failed_results: Any


WebExtractOutput = WebExtractToolOutput


class WebResearchSource(TerseModel):
    title: str
    url: str


class WebResearchToolInput(TerseModel):
    input: str
    model: Literal["mini", "pro", "auto"] | None


WebResearchInput = WebResearchToolInput


class WebResearchToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    status: Literal["completed"]
    request_id: str
    content: str | None = None
    sources: list[WebResearchSource] | None = None


WebResearchOutput = WebResearchToolOutput


class WebSearchResultItem(TerseModel):
    title: str
    url: str
    content: str
    score: float


class WebSearchToolInput(TerseModel):
    query: str
    max_results: Annotated[int, Field(ge=1, le=10)] | None
    search_depth: Literal["basic", "advanced"] | None
    include_answer: bool | None
    topic: Literal["general", "news"] | None
    time_range: Literal["day", "week", "month", "year"] | None


class WebSearchToolOutput(TerseModel):
    query: str
    answer: str | None = None
    results: list[WebSearchResultItem]


WebSearchOutput = WebSearchToolOutput


class WorkOSInputConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["workos"]
    config_type: Literal["workos_input"]
    event_types: list[
        Literal[
            "user.created",
            "user.updated",
            "user.deleted",
            "organization.created",
            "organization_membership.created",
            "organization_membership.updated",
            "organization_membership.deleted",
            "invitation.created",
            "invitation.accepted",
            "invitation.resent",
            "invitation.revoked",
        ]
    ]


class WorkOSIntegration(TerseModel):
    id: str
    webhook_url: str
    environment: Literal["live", "test"]


class WorkOSOrganizationSummary(TerseModel):
    id: str
    name: str
    external_id: str | None = None
    domains: list[str]
    created_at: str
    updated_at: str


class WorkOSOutputConfigInstance(TerseModel):
    integration_id: str
    integration_type: Literal["workos"]
    config_type: Literal["workos_output"]


class WorkOSPagination(TerseModel):
    has_more: bool
    after: str | None = None


class ListWorkOSOrganizationsToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    organizations: list[WorkOSOrganizationSummary]
    pagination: WorkOSPagination
    message: str


class WorkOSUserSummary(TerseModel):
    id: str
    email: str
    email_verified: bool
    first_name: str | None = None
    last_name: str | None = None
    profile_picture_url: str | None = None
    created_at: str
    updated_at: str


class GetWorkOSUserToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    user: WorkOSUserSummary
    message: str


class ListWorkOSUsersToolOutput(TerseModel):
    success: bool
    actions: list[RunHistoryAction] | None = None
    users: list[WorkOSUserSummary]
    pagination: WorkOSPagination
    message: str
