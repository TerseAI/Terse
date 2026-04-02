"""Enum-like literal aliases shared across SDK DTOs."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal, TypeAlias

ApprovalActionType: TypeAlias = Literal["open_run_history", "approve_action", "reject_action"]
ApprovalRequestStatus: TypeAlias = Literal["pending", "in_progress", "completed"]
ChangeEventType: TypeAlias = Literal["CREATED", "UPDATED", "ACTION_EXECUTED"]


class ConfigType(StrEnum):
    GMAIL = "gmail"
    GMAIL_OUTPUT = "gmail_output"
    GMAIL_DRAFT_OUTPUT = "gmail_draft_output"
    FIGMA = "figma"
    SLACK = "slack"
    SLACK_OUTPUT = "slack_output"
    NOTION = "notion"
    LINEAR_INPUT = "linear_input"
    LINEAR_OUTPUT = "linear_output"
    GITHUB = "github"
    JIRA = "jira"
    CONFLUENCE = "confluence"
    POSTHOG = "posthog"
    DATADOG = "datadog"
    TIME_TRIGGER = "time_trigger"
    LAUNCHDARKLY = "launchdarkly"
    TERSE = "terse"
    WORKOS_INPUT = "workos_input"
    WORKOS_OUTPUT = "workos_output"
    ATTIO_OUTPUT = "attio_output"
    SNOWFLAKE_OUTPUT = "snowflake_output"


EntityType: TypeAlias = Literal["ticket", "comment", "user", "action_event", "run_history_action"]
FigmaEventType: TypeAlias = Literal["file_comment"]
GitHubEventType: TypeAlias = Literal[
    "push",
    "pull_request.opened",
    "pull_request.merged",
    "pull_request.closed",
    "pull_request.synchronize",
]
GmailEventType: TypeAlias = Literal["email.received"]


class IntegrationType(StrEnum):
    GITHUB = "github"
    GMAIL = "gmail"
    LINEAR = "linear"
    ATLASSIAN = "atlassian"
    SLACK = "slack"
    NOTION = "notion"
    FIGMA = "figma"
    TERSE = "terse"
    POSTHOG = "posthog"
    DATADOG = "datadog"
    CRON_JOB = "cron_job"
    LAUNCHDARKLY = "launchdarkly"
    WORKOS = "workos"
    ATTIO = "attio"
    SNOWFLAKE = "snowflake"


JiraEventType: TypeAlias = Literal["issue.created", "issue.updated"]
LinearEventType: TypeAlias = Literal["issue.created", "issue.updated", "comment.created"]
NotificationDestinationType: TypeAlias = Literal["email", "slack"]
RunHistoryActionType: TypeAlias = Literal["create", "update", "delete", "read", "approve", "error"]
RunHistoryDecisionAction: TypeAlias = Literal["processed", "skipped"]
RunHistoryStatus: TypeAlias = Literal["success", "failed", "cancelled", "skipped", "in_progress", "awaiting_approval"]
SlackEventType: TypeAlias = Literal["message", "app_mention", "reaction_added"]
TicketSystemType: TypeAlias = Literal["jira", "linear"]
ToolCallExecutionStatus: TypeAlias = Literal["completed", "incomplete", "failed", "unknown"]
WorkOSEventType: TypeAlias = Literal[
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


class SlackChannelType(StrEnum):
    CHANNEL = "channel"
    GROUP = "group"
    MPIM = "mpim"
    IM = "im"

__all__ = [
    "ApprovalActionType",
    "ApprovalRequestStatus",
    "ChangeEventType",
    "ConfigType",
    "EntityType",
    "FigmaEventType",
    "GitHubEventType",
    "GmailEventType",
    "IntegrationType",
    "JiraEventType",
    "LinearEventType",
    "NotificationDestinationType",
    "RunHistoryActionType",
    "RunHistoryDecisionAction",
    "RunHistoryStatus",
    "SlackChannelType",
    "SlackEventType",
    "TicketSystemType",
    "ToolCallExecutionStatus",
    "WorkOSEventType",
]
