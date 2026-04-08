"""Input event models for the Python SDK."""

from __future__ import annotations

from typing import Annotated, Any, Literal, TypeAlias

from pydantic import Field

from ._base import TerseModel
from .enums import SlackChannelType


class InputEvent(TerseModel):
    integration_type: str
    event_type: str = "unknown"
    formatted_content: str = ""
    debug_log: str = ""
    metadata: dict[str, Any] | None = None


class GithubRepository(TerseModel):
    id: int
    name: str
    owner: str
    default_branch: str = "main"


class GithubUser(TerseModel):
    login: str
    email: str | None = None


class GithubFileDiff(TerseModel):
    filename: str
    diff: str


class GithubCommit(TerseModel):
    sha: str
    message: str
    file_diffs: list[GithubFileDiff] = Field(default_factory=list)


class GithubPRRef(TerseModel):
    ref: str
    sha: str


class GithubPRData(TerseModel):
    number: int
    title: str
    body: str | None = None
    state: Literal["open", "closed"]
    merged: bool = False
    head: GithubPRRef
    base: GithubPRRef
    author: GithubUser
    url: str


class GithubEventMetadata(TerseModel):
    repository: GithubRepository | None = None
    sender: GithubUser | None = None
    commits: list[GithubCommit] = Field(default_factory=list)
    pull_request: GithubPRData | None = None
    branch: str | None = None


class GithubInputEvent(InputEvent):
    integration_type: Literal["github"] = "github"
    metadata: GithubEventMetadata | None = None


class SlackAttachmentField(TerseModel):
    title: str
    value: str
    short: bool


class SlackAttachment(TerseModel):
    fallback: str | None = None
    color: str | None = None
    pretext: str | None = None
    author_name: str | None = None
    author_link: str | None = None
    author_icon: str | None = None
    title: str | None = None
    title_link: str | None = None
    text: str | None = None
    fields: list[SlackAttachmentField] | None = None
    image_url: str | None = None
    thumb_url: str | None = None
    footer: str | None = None
    footer_icon: str | None = None
    ts: int | None = None


class SlackFile(TerseModel):
    id: str
    name: str | None = None
    title: str | None = None
    mimetype: str | None = None
    filetype: str | None = None
    url_private: str | None = None
    url_private_download: str | None = None
    thumb_64: str | None = None
    thumb_80: str | None = None
    thumb_160: str | None = None
    thumb_360: str | None = None
    thumb_480: str | None = None
    thumb_720: str | None = None
    thumb_800: str | None = None
    thumb_960: str | None = None
    thumb_1024: str | None = None
    original_w: int | None = None
    original_h: int | None = None


class SlackInputEvent(InputEvent):
    integration_type: Literal["slack"] = "slack"
    channel_id: str = ""
    channel_name: str | None = None
    user_id: str = ""
    user_name: str | None = None
    text: str = ""
    timestamp: str = ""
    thread_ts: str | None = None
    team_id: str = ""
    permalink: str | None = None
    channel_type: SlackChannelType | None = None
    blocks: list[dict[str, Any]] | None = None
    attachments: list[SlackAttachment] | None = None
    files: list[SlackFile] | None = None

    @property
    def thread_timestamp(self) -> str | None:
        return self.thread_ts


class LinearInputEvent(InputEvent):
    integration_type: Literal["linear"] = "linear"


class GmailInputEvent(InputEvent):
    integration_type: Literal["gmail"] = "gmail"


class NotionInputEvent(InputEvent):
    integration_type: Literal["notion"] = "notion"


class PosthogInputEvent(InputEvent):
    integration_type: Literal["posthog"] = "posthog"


class DatadogInputEvent(InputEvent):
    integration_type: Literal["datadog"] = "datadog"


class TerseInputEvent(InputEvent):
    integration_type: Literal["terse"] = "terse"


class CronJobInputEvent(InputEvent):
    integration_type: Literal["cron_job"] = "cron_job"


class LaunchDarklyInputEvent(InputEvent):
    integration_type: Literal["launchdarkly"] = "launchdarkly"


class WorkOSEventUser(TerseModel):
    id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    email_verified: bool
    profile_picture_url: str | None = None


class WorkOSEventMembership(TerseModel):
    id: str
    user_id: str
    organization_id: str
    role: dict[str, str]
    status: str


class WorkOSEventInvitation(TerseModel):
    id: str
    email: str
    organization_id: str
    inviter_email: str | None = None
    state: str
    accepted_at: str | None = None


class WorkOSEventMetadata(TerseModel):
    event_id: str | None = None
    created_at: str | None = None
    user: WorkOSEventUser | None = None
    membership: WorkOSEventMembership | None = None
    invitation: WorkOSEventInvitation | None = None


class WorkOSInputEvent(InputEvent):
    integration_type: Literal["workos"] = "workos"
    metadata: WorkOSEventMetadata | None = None


class AttioInputEvent(InputEvent):
    integration_type: Literal["attio"] = "attio"


class SnowflakeInputEvent(InputEvent):
    integration_type: Literal["snowflake"] = "snowflake"


class SerializedEventInputEvent(InputEvent):
    """Fallback event for integrations without a dedicated typed model yet."""


KnownInputEvent: TypeAlias = Annotated[
    GithubInputEvent
    | SlackInputEvent
    | LinearInputEvent
    | GmailInputEvent
    | NotionInputEvent
    | PosthogInputEvent
    | DatadogInputEvent
    | TerseInputEvent
    | CronJobInputEvent
    | LaunchDarklyInputEvent
    | WorkOSInputEvent
    | AttioInputEvent
    | SnowflakeInputEvent,
    Field(discriminator="integration_type"),
]

AnyInputEvent: TypeAlias = KnownInputEvent | SerializedEventInputEvent


__all__ = [
    "AnyInputEvent",
    "AttioInputEvent",
    "CronJobInputEvent",
    "DatadogInputEvent",
    "GithubCommit",
    "GithubEventMetadata",
    "GithubFileDiff",
    "GithubInputEvent",
    "GithubPRData",
    "GithubPRRef",
    "GithubRepository",
    "GithubUser",
    "GmailInputEvent",
    "InputEvent",
    "KnownInputEvent",
    "LaunchDarklyInputEvent",
    "LinearInputEvent",
    "NotionInputEvent",
    "PosthogInputEvent",
    "SerializedEventInputEvent",
    "SlackAttachment",
    "SlackAttachmentField",
    "SlackFile",
    "SlackInputEvent",
    "SnowflakeInputEvent",
    "TerseInputEvent",
    "WorkOSEventInvitation",
    "WorkOSEventMembership",
    "WorkOSEventMetadata",
    "WorkOSEventUser",
    "WorkOSInputEvent",
]
