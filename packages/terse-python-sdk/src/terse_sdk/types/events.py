"""Canonical trigger-event models for the Python SDK."""

from __future__ import annotations

from typing import TypeAlias

from ._base import TerseModel
from ._generated import (
    Commit,
    CronTriggerEvent,
    FileDiff,
    GitHubPullRequestTriggerEvent,
    GitHubPushTriggerEvent,
    GitHubRepository,
    GitHubTriggerEvent,
    GmailTriggerEvent,
    LinearTriggerEvent,
    ManualSampleTriggerEvent,
    PullRequest,
    PullRequestRef,
    Sender,
    SlackTriggerEvent,
    TriggerEvent,
    WebhookTriggerEvent,
    WorkOSInvitationTriggerEvent,
    WorkOSMembershipTriggerEvent,
    WorkOSOrganizationTriggerEvent,
    WorkOSTriggerEvent,
    WorkOSTriggerInvitation,
    WorkOSTriggerMembership,
    WorkOSTriggerOrganization,
    WorkOSTriggerUser,
    WorkOSUserTriggerEvent,
)


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


GitHubFileDiff = FileDiff
GitHubCommit = Commit
GitHubUser = Sender
GitHubPullRequestRef = PullRequestRef
GitHubPullRequestData = PullRequest

KnownTriggerEvent: TypeAlias = (
    SlackTriggerEvent
    | GitHubTriggerEvent
    | GmailTriggerEvent
    | LinearTriggerEvent
    | WebhookTriggerEvent
    | WorkOSTriggerEvent
    | CronTriggerEvent
    | ManualSampleTriggerEvent
)
AnyTriggerEvent: TypeAlias = KnownTriggerEvent


class _ManualTriggerEvent(TerseModel):
    integration_type: str
    event_type: str = "manual_sample"


class AttioTriggerEvent(_ManualTriggerEvent):
    integration_type: str = "attio"


class DatadogTriggerEvent(_ManualTriggerEvent):
    integration_type: str = "datadog"


class LaunchDarklyTriggerEvent(_ManualTriggerEvent):
    integration_type: str = "launchdarkly"


class NotionTriggerEvent(_ManualTriggerEvent):
    integration_type: str = "notion"


class PosthogTriggerEvent(_ManualTriggerEvent):
    integration_type: str = "posthog"


class SnowflakeTriggerEvent(_ManualTriggerEvent):
    integration_type: str = "snowflake"


__all__ = [
    "AnyTriggerEvent",
    "AttioTriggerEvent",
    "CronTriggerEvent",
    "DatadogTriggerEvent",
    "GitHubCommit",
    "GitHubFileDiff",
    "GitHubPullRequestData",
    "GitHubPullRequestRef",
    "GitHubPullRequestTriggerEvent",
    "GitHubPushTriggerEvent",
    "GitHubRepository",
    "GitHubTriggerEvent",
    "GitHubUser",
    "GmailTriggerEvent",
    "KnownTriggerEvent",
    "LaunchDarklyTriggerEvent",
    "LinearTriggerEvent",
    "NotionTriggerEvent",
    "PosthogTriggerEvent",
    "SlackAttachment",
    "SlackAttachmentField",
    "SlackFile",
    "SlackTriggerEvent",
    "SnowflakeTriggerEvent",
    "TriggerEvent",
    "ManualSampleTriggerEvent",
    "WebhookTriggerEvent",
    "WorkOSInvitationTriggerEvent",
    "WorkOSMembershipTriggerEvent",
    "WorkOSOrganizationTriggerEvent",
    "WorkOSTriggerEvent",
    "WorkOSTriggerInvitation",
    "WorkOSTriggerMembership",
    "WorkOSTriggerOrganization",
    "WorkOSTriggerUser",
    "WorkOSUserTriggerEvent",
]
