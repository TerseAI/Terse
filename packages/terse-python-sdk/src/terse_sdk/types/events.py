"""Canonical trigger-event models for the Python SDK."""

from __future__ import annotations

from typing import TypeAlias

from ._base import TerseModel
from ._generated import (
    Commit,
    CronTrigger,
    FileDiff,
    GithubPRClosedTrigger,
    GithubPRMergedTrigger,
    GithubPROpenedTrigger,
    GithubPRSynchronizedTrigger,
    GithubPRTrigger,
    GithubPushTrigger,
    GitHubRepository,
    GithubTrigger,
    GmailTrigger,
    LinearCommentCreatedTrigger,
    LinearIssueCreatedTrigger,
    LinearIssueUpdatedTrigger,
    LinearTrigger,
    ManualSampleTrigger,
    PullRequest,
    PullRequestRef,
    Sender,
    SlackAppMentionTrigger,
    SlackMessageTrigger,
    SlackReactionAddedTrigger,
    SlackTrigger,
    Trigger,
    WebhookTrigger,
    WorkOSInvitationAcceptedTrigger,
    WorkOSInvitationCreatedTrigger,
    WorkOSInvitationResentTrigger,
    WorkOSInvitationRevokedTrigger,
    WorkOSInvitationTrigger,
    WorkOSMembershipTrigger,
    WorkOSOrganizationMembershipCreatedTrigger,
    WorkOSOrganizationMembershipDeletedTrigger,
    WorkOSOrganizationMembershipUpdatedTrigger,
    WorkOSOrganizationTrigger,
    WorkOSTrigger,
    WorkOSTriggerInvitation,
    WorkOSTriggerMembership,
    WorkOSTriggerOrganization,
    WorkOSTriggerUser,
    WorkOSUserCreatedTrigger,
    WorkOSUserDeletedTrigger,
    WorkOSUserTrigger,
    WorkOSUserUpdatedTrigger,
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

KnownTrigger: TypeAlias = (
    SlackMessageTrigger
    | SlackAppMentionTrigger
    | SlackReactionAddedTrigger
    | GithubTrigger
    | GmailTrigger
    | LinearTrigger
    | WebhookTrigger
    | WorkOSTrigger
    | CronTrigger
    | ManualSampleTrigger
)
AnyTrigger: TypeAlias = KnownTrigger


class _ManualTrigger(TerseModel):
    integration_type: str
    event_type: str = "manual_sample"


class AttioTrigger(_ManualTrigger):
    integration_type: str = "attio"


class DatadogTrigger(_ManualTrigger):
    integration_type: str = "datadog"


class LaunchDarklyTrigger(_ManualTrigger):
    integration_type: str = "launchdarkly"


class NotionTrigger(_ManualTrigger):
    integration_type: str = "notion"


class PosthogTrigger(_ManualTrigger):
    integration_type: str = "posthog"


class SnowflakeTrigger(_ManualTrigger):
    integration_type: str = "snowflake"


__all__ = [
    "AnyTrigger",
    "AttioTrigger",
    "CronTrigger",
    "DatadogTrigger",
    "GitHubCommit",
    "GitHubFileDiff",
    "GitHubPullRequestData",
    "GitHubPullRequestRef",
    "GithubPRClosedTrigger",
    "GithubPRMergedTrigger",
    "GithubPROpenedTrigger",
    "GithubPRSynchronizedTrigger",
    "GithubPRTrigger",
    "GithubPushTrigger",
    "GitHubRepository",
    "GithubTrigger",
    "GitHubUser",
    "GmailTrigger",
    "KnownTrigger",
    "LaunchDarklyTrigger",
    "LinearCommentCreatedTrigger",
    "LinearIssueCreatedTrigger",
    "LinearIssueUpdatedTrigger",
    "LinearTrigger",
    "NotionTrigger",
    "PosthogTrigger",
    "SlackAttachment",
    "SlackAttachmentField",
    "SlackFile",
    "SlackAppMentionTrigger",
    "SlackMessageTrigger",
    "SlackReactionAddedTrigger",
    "SlackTrigger",
    "SnowflakeTrigger",
    "Trigger",
    "ManualSampleTrigger",
    "WebhookTrigger",
    "WorkOSInvitationAcceptedTrigger",
    "WorkOSInvitationCreatedTrigger",
    "WorkOSInvitationResentTrigger",
    "WorkOSInvitationRevokedTrigger",
    "WorkOSInvitationTrigger",
    "WorkOSMembershipTrigger",
    "WorkOSOrganizationMembershipCreatedTrigger",
    "WorkOSOrganizationMembershipDeletedTrigger",
    "WorkOSOrganizationMembershipUpdatedTrigger",
    "WorkOSOrganizationTrigger",
    "WorkOSTrigger",
    "WorkOSTriggerInvitation",
    "WorkOSTriggerMembership",
    "WorkOSTriggerOrganization",
    "WorkOSTriggerUser",
    "WorkOSUserCreatedTrigger",
    "WorkOSUserDeletedTrigger",
    "WorkOSUserTrigger",
    "WorkOSUserUpdatedTrigger",
]
