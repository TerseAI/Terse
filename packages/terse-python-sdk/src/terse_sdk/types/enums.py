"""Enum-like literal aliases shared across SDK DTOs."""

from __future__ import annotations

from typing import Literal, TypeAlias

ApprovalActionType: TypeAlias = Literal["open_run_history", "approve_action", "reject_action"]
ApprovalRequestStatus: TypeAlias = Literal["pending", "in_progress", "completed"]
ChangeEventType: TypeAlias = Literal["CREATED", "UPDATED", "ACTION_EXECUTED"]
ConfigType: TypeAlias = Literal[
    "gmail",
    "gmail_output",
    "gmail_draft_output",
    "figma",
    "slack",
    "slack_output",
    "notion",
    "linear_input",
    "linear_output",
    "github",
    "jira",
    "confluence",
    "POSTHOG",
    "DATADOG",
    "time_trigger",
    "launchdarkly",
    "terse",
    "workos_input",
    "workos_output",
    "attio_output",
    "snowflake_output",
]
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
IntegrationType: TypeAlias = Literal[
    "github",
    "gmail",
    "linear",
    "atlassian",
    "slack",
    "notion",
    "figma",
    "terse",
    "posthog",
    "datadog",
    "cron_job",
    "launchdarkly",
    "workos",
    "attio",
    "snowflake",
]
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
    "SlackEventType",
    "TicketSystemType",
    "ToolCallExecutionStatus",
    "WorkOSEventType",
]
