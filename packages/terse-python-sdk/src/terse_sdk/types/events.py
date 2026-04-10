"""Canonical trigger-event models for the Python SDK."""

from __future__ import annotations

from typing import Any, Generic, TypeAlias, TypeVar

from ._base import TerseModel
from ._generated import (
    Commit,
    CronTrigger as _RawCronTrigger,
    FileDiff,
    GithubPRClosedTrigger as _RawGithubPRClosedTrigger,
    GithubPRMergedTrigger as _RawGithubPRMergedTrigger,
    GithubPROpenedTrigger as _RawGithubPROpenedTrigger,
    GithubPRSynchronizedTrigger as _RawGithubPRSynchronizedTrigger,
    GithubPRTrigger as _RawGithubPRTrigger,
    GithubPushTrigger as _RawGithubPushTrigger,
    GithubRepository,
    GithubTrigger as _RawGithubTrigger,
    GmailTrigger as _RawGmailTrigger,
    LinearCommentCreatedTrigger as _RawLinearCommentCreatedTrigger,
    LinearIssueCreatedTrigger as _RawLinearIssueCreatedTrigger,
    LinearIssueUpdatedTrigger as _RawLinearIssueUpdatedTrigger,
    LinearTrigger as _RawLinearTrigger,
    ManualSampleTrigger as _RawManualSampleTrigger,
    PullRequest,
    PullRequestRef,
    Sender,
    SlackAppMentionTrigger as _RawSlackAppMentionTrigger,
    SlackMessageTrigger as _RawSlackMessageTrigger,
    SlackReactionAddedTrigger as _RawSlackReactionAddedTrigger,
    SlackTrigger as _RawSlackTrigger,
    Trigger as _RawTrigger,
    WebhookTrigger as _RawWebhookTrigger,
    WorkOSInvitationAcceptedTrigger as _RawWorkOSInvitationAcceptedTrigger,
    WorkOSInvitationCreatedTrigger as _RawWorkOSInvitationCreatedTrigger,
    WorkOSInvitationResentTrigger as _RawWorkOSInvitationResentTrigger,
    WorkOSInvitationRevokedTrigger as _RawWorkOSInvitationRevokedTrigger,
    WorkOSInvitationTrigger as _RawWorkOSInvitationTrigger,
    WorkOSMembershipTrigger as _RawWorkOSMembershipTrigger,
    WorkOSOrganizationMembershipCreatedTrigger as _RawWorkOSOrganizationMembershipCreatedTrigger,
    WorkOSOrganizationMembershipDeletedTrigger as _RawWorkOSOrganizationMembershipDeletedTrigger,
    WorkOSOrganizationMembershipUpdatedTrigger as _RawWorkOSOrganizationMembershipUpdatedTrigger,
    WorkOSOrganizationTrigger as _RawWorkOSOrganizationTrigger,
    WorkOSTrigger as _RawWorkOSTrigger,
    WorkOSTriggerInvitation,
    WorkOSTriggerMembership,
    WorkOSTriggerOrganization,
    WorkOSTriggerUser,
    WorkOSUserCreatedTrigger as _RawWorkOSUserCreatedTrigger,
    WorkOSUserDeletedTrigger as _RawWorkOSUserDeletedTrigger,
    WorkOSUserTrigger as _RawWorkOSUserTrigger,
    WorkOSUserUpdatedTrigger as _RawWorkOSUserUpdatedTrigger,
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

_T = TypeVar("_T")


class SDKTrigger(Generic[_T]):
    """Trigger event enriched with ``formatted_content`` and ``debug_log``.

    Mirrors the TypeScript ``SDKTrigger<T>`` intersection type.  Trigger
    fields are accessible directly via ``__getattr__`` delegation (e.g.
    ``event.text``), and type-safe access is available through ``event.data``.
    """

    __slots__ = ("_trigger", "_formatted_content", "_debug_log")

    def __init__(self, trigger: _T, formatted_content: str, debug_log: str) -> None:
        object.__setattr__(self, "_trigger", trigger)
        object.__setattr__(self, "_formatted_content", formatted_content)
        object.__setattr__(self, "_debug_log", debug_log)

    @property
    def data(self) -> _T:
        return self._trigger  # type: ignore[return-value]

    @property
    def formatted_content(self) -> str:
        return self._formatted_content  # type: ignore[return-value]

    @property
    def debug_log(self) -> str:
        return self._debug_log  # type: ignore[return-value]

    def __getattr__(self, name: str) -> Any:
        return getattr(self._trigger, name)

    def __repr__(self) -> str:
        return f"SDKTrigger({self._trigger!r})"


# ---------------------------------------------------------------------------
# Public SDK-wrapped trigger type aliases.
# Users write e.g. ``event: CronTrigger`` and get ``formatted_content`` /
# ``debug_log`` for free — matching the TypeScript SDK pattern.
# ---------------------------------------------------------------------------

Trigger: TypeAlias = SDKTrigger[_RawTrigger]
CronTrigger: TypeAlias = SDKTrigger[_RawCronTrigger]
GithubPRClosedTrigger: TypeAlias = SDKTrigger[_RawGithubPRClosedTrigger]
GithubPRMergedTrigger: TypeAlias = SDKTrigger[_RawGithubPRMergedTrigger]
GithubPROpenedTrigger: TypeAlias = SDKTrigger[_RawGithubPROpenedTrigger]
GithubPRSynchronizedTrigger: TypeAlias = SDKTrigger[_RawGithubPRSynchronizedTrigger]
GithubPRTrigger: TypeAlias = SDKTrigger[_RawGithubPRTrigger]
GithubPushTrigger: TypeAlias = SDKTrigger[_RawGithubPushTrigger]
GithubTrigger: TypeAlias = SDKTrigger[_RawGithubTrigger]
GmailTrigger: TypeAlias = SDKTrigger[_RawGmailTrigger]
LinearCommentCreatedTrigger: TypeAlias = SDKTrigger[_RawLinearCommentCreatedTrigger]
LinearIssueCreatedTrigger: TypeAlias = SDKTrigger[_RawLinearIssueCreatedTrigger]
LinearIssueUpdatedTrigger: TypeAlias = SDKTrigger[_RawLinearIssueUpdatedTrigger]
LinearTrigger: TypeAlias = SDKTrigger[_RawLinearTrigger]
ManualSampleTrigger: TypeAlias = SDKTrigger[_RawManualSampleTrigger]
SlackAppMentionTrigger: TypeAlias = SDKTrigger[_RawSlackAppMentionTrigger]
SlackMessageTrigger: TypeAlias = SDKTrigger[_RawSlackMessageTrigger]
SlackReactionAddedTrigger: TypeAlias = SDKTrigger[_RawSlackReactionAddedTrigger]
SlackTrigger: TypeAlias = SDKTrigger[_RawSlackTrigger]
WebhookTrigger: TypeAlias = SDKTrigger[_RawWebhookTrigger]
WorkOSInvitationAcceptedTrigger: TypeAlias = SDKTrigger[_RawWorkOSInvitationAcceptedTrigger]
WorkOSInvitationCreatedTrigger: TypeAlias = SDKTrigger[_RawWorkOSInvitationCreatedTrigger]
WorkOSInvitationResentTrigger: TypeAlias = SDKTrigger[_RawWorkOSInvitationResentTrigger]
WorkOSInvitationRevokedTrigger: TypeAlias = SDKTrigger[_RawWorkOSInvitationRevokedTrigger]
WorkOSInvitationTrigger: TypeAlias = SDKTrigger[_RawWorkOSInvitationTrigger]
WorkOSMembershipTrigger: TypeAlias = SDKTrigger[_RawWorkOSMembershipTrigger]
WorkOSOrganizationMembershipCreatedTrigger: TypeAlias = SDKTrigger[_RawWorkOSOrganizationMembershipCreatedTrigger]
WorkOSOrganizationMembershipDeletedTrigger: TypeAlias = SDKTrigger[_RawWorkOSOrganizationMembershipDeletedTrigger]
WorkOSOrganizationMembershipUpdatedTrigger: TypeAlias = SDKTrigger[_RawWorkOSOrganizationMembershipUpdatedTrigger]
WorkOSOrganizationTrigger: TypeAlias = SDKTrigger[_RawWorkOSOrganizationTrigger]
WorkOSTrigger: TypeAlias = SDKTrigger[_RawWorkOSTrigger]
WorkOSUserCreatedTrigger: TypeAlias = SDKTrigger[_RawWorkOSUserCreatedTrigger]
WorkOSUserDeletedTrigger: TypeAlias = SDKTrigger[_RawWorkOSUserDeletedTrigger]
WorkOSUserTrigger: TypeAlias = SDKTrigger[_RawWorkOSUserTrigger]
WorkOSUserUpdatedTrigger: TypeAlias = SDKTrigger[_RawWorkOSUserUpdatedTrigger]

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


__all__ = [
    "AnyTrigger",
    "SDKTrigger",
    "CronTrigger",
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
    "GithubRepository",
    "GithubTrigger",
    "GitHubUser",
    "GmailTrigger",
    "KnownTrigger",
    "LinearCommentCreatedTrigger",
    "LinearIssueCreatedTrigger",
    "LinearIssueUpdatedTrigger",
    "LinearTrigger",
    "SlackAttachment",
    "SlackAttachmentField",
    "SlackFile",
    "SlackAppMentionTrigger",
    "SlackMessageTrigger",
    "SlackReactionAddedTrigger",
    "SlackTrigger",
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
