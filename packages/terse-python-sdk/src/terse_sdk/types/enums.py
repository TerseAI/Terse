"""Enum-like root models shared across SDK DTOs."""

from __future__ import annotations

from typing import Literal

from pydantic import RootModel


class ApprovalActionType(RootModel[Literal["open_run_history", "approve_action", "reject_action"]]):
    root: Literal["open_run_history", "approve_action", "reject_action"]


class ApprovalRequestStatus(RootModel[Literal["pending", "in_progress", "completed"]]):
    root: Literal["pending", "in_progress", "completed"]


class ChangeEventType(RootModel[Literal["CREATED", "UPDATED", "ACTION_EXECUTED"]]):
    root: Literal["CREATED", "UPDATED", "ACTION_EXECUTED"]


class ConfigType(
    RootModel[
        Literal[
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
    ]
):
    root: Literal[
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


class EntityType(RootModel[Literal["ticket", "comment", "user", "action_event", "run_history_action"]]):
    root: Literal["ticket", "comment", "user", "action_event", "run_history_action"]


class FigmaEventType(RootModel[Literal["file_comment"]]):
    root: Literal["file_comment"]


class GitHubEventType(
    RootModel[
        Literal["push", "pull_request.opened", "pull_request.merged", "pull_request.closed", "pull_request.synchronize"]
    ]
):
    root: Literal[
        "push",
        "pull_request.opened",
        "pull_request.merged",
        "pull_request.closed",
        "pull_request.synchronize",
    ]


class GmailEventType(RootModel[Literal["email.received"]]):
    root: Literal["email.received"]


class IntegrationType(
    RootModel[
        Literal[
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
    ]
):
    root: Literal[
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


class JiraEventType(RootModel[Literal["issue.created", "issue.updated"]]):
    root: Literal["issue.created", "issue.updated"]


class LinearEventType(RootModel[Literal["issue.created", "issue.updated", "comment.created"]]):
    root: Literal["issue.created", "issue.updated", "comment.created"]


class NotificationDestinationType(RootModel[Literal["email", "slack"]]):
    root: Literal["email", "slack"]


class RunHistoryActionType(RootModel[Literal["create", "update", "delete", "read", "approve", "error"]]):
    root: Literal["create", "update", "delete", "read", "approve", "error"]


class RunHistoryDecisionAction(RootModel[Literal["processed", "skipped"]]):
    root: Literal["processed", "skipped"]


class RunHistoryStatus(
    RootModel[Literal["success", "failed", "cancelled", "skipped", "in_progress", "awaiting_approval"]]
):
    root: Literal["success", "failed", "cancelled", "skipped", "in_progress", "awaiting_approval"]


class SlackEventType(RootModel[Literal["message", "app_mention", "reaction_added"]]):
    root: Literal["message", "app_mention", "reaction_added"]


class TicketSystemType(RootModel[Literal["jira", "linear"]]):
    root: Literal["jira", "linear"]


class ToolCallExecutionStatus(RootModel[Literal["completed", "incomplete", "failed", "unknown"]]):
    root: Literal["completed", "incomplete", "failed", "unknown"]


class WorkOSEventType(
    RootModel[
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
):
    root: Literal[
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
