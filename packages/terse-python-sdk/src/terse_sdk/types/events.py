"""Canonical trigger-event models for the Python SDK."""

from __future__ import annotations

from typing import TypeAlias

from ._base import TerseModel
from ._generated import (
    Commit,
    CronTriggerEvent,
    FileDiff,
    GithubRepository,
    GithubTriggerEvent,
    GmailTriggerEvent,
    LinearTriggerEvent,
    ManualSampleTriggerEvent,
    PullRequest,
    PullRequestRef,
    Sender,
    SlackTriggerEvent,
    TriggerEvent,
    WebhookTriggerEvent,
    WorkOSBaseTriggerEvent,
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

TriggerEventScalar: TypeAlias = (
    SlackTriggerEvent
    | GithubTriggerEvent
    | GmailTriggerEvent
    | LinearTriggerEvent
    | WebhookTriggerEvent
    | WorkOSBaseTriggerEvent
    | WorkOSTriggerEvent
    | CronTriggerEvent
    | ManualSampleTriggerEvent
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


GithubFileDiff = FileDiff
GithubCommit = Commit
GithubUser = Sender
GithubPRRef = PullRequestRef
GithubPRData = PullRequest
GithubEventMetadata = GithubTriggerEvent
GithubInputEvent = GithubTriggerEvent
SlackInputEvent = SlackTriggerEvent
LinearInputEvent = LinearTriggerEvent
GmailInputEvent = GmailTriggerEvent
CronJobInputEvent = CronTriggerEvent
TerseInputEvent = ManualSampleTriggerEvent
WorkOSEventUser = WorkOSTriggerUser
WorkOSEventMembership = WorkOSTriggerMembership
WorkOSEventInvitation = WorkOSTriggerInvitation
WorkOSEventOrganization = WorkOSTriggerOrganization
WorkOSInputEvent = WorkOSBaseTriggerEvent | WorkOSTriggerEvent
WorkOSEventMetadata = WorkOSBaseTriggerEvent
WebhookInputEvent = WebhookTriggerEvent


class _LegacyInputEvent(TerseModel):
    integration_type: str
    event_type: str = "manual_sample"


class AttioInputEvent(_LegacyInputEvent):
    integration_type: str = "attio"


class DatadogInputEvent(_LegacyInputEvent):
    integration_type: str = "datadog"


class LaunchDarklyInputEvent(_LegacyInputEvent):
    integration_type: str = "launchdarkly"


class NotionInputEvent(_LegacyInputEvent):
    integration_type: str = "notion"


class PosthogInputEvent(_LegacyInputEvent):
    integration_type: str = "posthog"


class SnowflakeInputEvent(_LegacyInputEvent):
    integration_type: str = "snowflake"


KnownInputEvent: TypeAlias = TriggerEventScalar
AnyInputEvent: TypeAlias = TriggerEventScalar

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
    "KnownInputEvent",
    "LaunchDarklyInputEvent",
    "LinearInputEvent",
    "NotionInputEvent",
    "PosthogInputEvent",
    "SlackAttachment",
    "SlackAttachmentField",
    "SlackFile",
    "SlackInputEvent",
    "SnowflakeInputEvent",
    "TerseInputEvent",
    "WebhookInputEvent",
    "TriggerEvent",
    "WorkOSBaseTriggerEvent",
    "WorkOSEventInvitation",
    "WorkOSEventMembership",
    "WorkOSEventMetadata",
    "WorkOSEventOrganization",
    "WorkOSEventUser",
    "WorkOSInputEvent",
    "WorkOSInvitationTriggerEvent",
    "WorkOSMembershipTriggerEvent",
    "WorkOSOrganizationTriggerEvent",
    "WorkOSTriggerEvent",
    "WorkOSUserTriggerEvent",
]
