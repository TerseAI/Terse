import type { z } from "zod"

import type { TriggerDisplay } from "./TriggerDefinition"
import type {
    AttioTrigger,
    CronTrigger,
    GithubTrigger,
    GmailTrigger,
    HeyReachTrigger,
    LinearTrigger,
    ManualSampleTrigger,
    WebMonitorTrigger,
    WebhookTrigger,
    WorkOSTrigger,
    slackTriggerSchema
} from "./Triggers"

export type { TriggerDisplay } from "./TriggerDefinition"

export function formatManualSampleTrigger(event: ManualSampleTrigger): string {
    return `Manual sample event for ${event.integrationType}.`
}

export function debugManualSampleTrigger(event: ManualSampleTrigger): string {
    return `${event.integrationType} ${event.eventType}`
}

export function displayManualSampleTrigger(event: ManualSampleTrigger): TriggerDisplay {
    return {
        title: `Manual ${event.integrationType} sample`,
        subtitle: event.eventType
    }
}

export function formatGithubTrigger(event: GithubTrigger): string {
    const indentMultiline = (text: string): string =>
        text
            .split("\n")
            .map(line => `        ${line}`)
            .join("\n")

    const eventTypeDescriptions: Record<string, string> = {
        push: "Code Push Event",
        "pull_request.opened": "Pull Request Opened",
        "pull_request.synchronize": "Pull Request Updated (new commits added)",
        "pull_request.closed": "Pull Request Closed",
        "pull_request.merged": "Pull Request Merged",
        "pull_request.comment.edited": "Pull Request Comment Edited",
        "issue_comment.created": "Issue Comment Created"
    }
    const eventDescription = event.eventType === "issue_comment.created" && event.issue.isPullRequest ? "Pull Request Comment Created" : eventTypeDescriptions[event.eventType] || event.eventType

    const repoInfo = [
        `Repository: ${event.repository.owner}/${event.repository.name}`,
        `Repository ID: ${event.repository.id}`,
        `Default Branch: ${event.repository.defaultBranch}`,
        `View on GitHub: https://github.com/${event.repository.owner}/${event.repository.name}`
    ].join("\n")

    const senderInfo = [`Actor: ${event.sender.login}`, ...(event.sender.email ? [`Email: ${event.sender.email}`] : [])].join("\n")
    const isCommentEvent = event.eventType === "issue_comment.created" || event.eventType === "pull_request.comment.edited"
    const branch = isCommentEvent ? undefined : event.branch
    const branchInfo = branch ? `Branch: ${branch}` : null

    let prInfo = ""
    if (!isCommentEvent && event.pullRequest) {
        const pr = event.pullRequest
        const author = pr.author ?? pr.user
        const prLines = [
            `Pull Request #${pr.number}: ${pr.title}`,
            `State: ${pr.state}${pr.merged ? " (merged)" : ""}`,
            `Author: ${author.login}${author.email ? ` (${author.email})` : ""}`,
            `Head Branch: ${pr.head.ref} (${pr.head.sha.substring(0, 7)})`,
            `Base Branch: ${pr.base.ref} (${pr.base.sha.substring(0, 7)})`,
            `View PR: ${pr.url}`
        ]
        if (pr.body) {
            prLines.push(`\nDescription:\n${indentMultiline(pr.body)}`)
        }
        prInfo = prLines.join("\n")
    }

    let commentInfo = ""
    if (isCommentEvent) {
        const c = event.comment
        const target = event.issue
        const kind = target.isPullRequest ? "Pull Request" : "Issue"
        const targetLines = [
            `${kind} #${target.number}: ${target.title}`,
            `State: ${target.state}`,
            `Author: ${target.author.login}${target.author.email ? ` (${target.author.email})` : ""}`,
            `View: ${target.url}`
        ]
        if (target.body) {
            targetLines.push(`\nDescription:\n${indentMultiline(target.body)}`)
        }
        prInfo = targetLines.join("\n")

        const commentLines = [`Comment #${c.id} by ${c.author.login}${c.author.email ? ` (${c.author.email})` : ""}`, `Posted: ${c.createdAt}`, `URL: ${c.url}`, `\nBody:\n${indentMultiline(c.body)}`]
        commentInfo = commentLines.join("\n")
    }

    let commitsInfo = ""
    const commits = isCommentEvent ? [] : event.commits
    if (commits.length > 0) {
        const commitLines: string[] = []
        commitLines.push(`Commits (${commits.length}):`)

        commits.forEach((commit, index) => {
            const shortSha = commit.sha.substring(0, 7)
            const commitUrl = `https://github.com/${event.repository.owner}/${event.repository.name}/commit/${commit.sha}`
            commitLines.push(`\n${index + 1}. Commit ${shortSha}: ${commit.message || (commit as { name?: string }).name || ""}`)
            commitLines.push(`   URL: ${commitUrl}`)

            if (commit.fileDiffs.length > 0) {
                commitLines.push(`   Files Changed: ${commit.fileDiffs.length}`)
                const fileList = commit.fileDiffs.map(f => `     - ${f.filename}`).join("\n")
                commitLines.push(`   Files:\n${fileList}`)
            }
        })

        commitsInfo = commitLines.join("\n")
    }

    const targetSectionLabel = isCommentEvent ? (event.issue.isPullRequest ? "Pull Request Information" : "Issue Information") : "Pull Request Information"

    return [
        `Incoming GitHub Event: ${eventDescription}`,
        `\nRepository Information:\n${indentMultiline(repoInfo)}`,
        `\nActor Information:\n${indentMultiline(senderInfo)}`,
        ...(branchInfo ? [`\nBranch Information:\n${indentMultiline(branchInfo)}`] : []),
        ...(prInfo ? [`\n${targetSectionLabel}:\n${indentMultiline(prInfo)}`] : []),
        ...(commentInfo ? [`\nComment Information:\n${indentMultiline(commentInfo)}`] : []),
        ...(commitsInfo ? [`\n${commitsInfo}`] : [])
    ].join("\n\n")
}

export function debugGithubTrigger(event: GithubTrigger): string {
    return `GitHub Event: ${event.eventType} - ${event.repository.owner}/${event.repository.name} - ${event.sender.login}`
}

export function formatGithubDisplay(event: GithubTrigger): TriggerDisplay {
    if (event.eventType === "issue_comment.created" || event.eventType === "pull_request.comment.edited") {
        const kind = event.issue.isPullRequest ? "PR" : "Issue"
        return {
            title: `Comment on #${event.issue.number} ${truncateForDisplay(event.issue.title, 80)}`,
            subtitle: `${event.repository.owner}/${event.repository.name} · ${kind} comment by ${event.sender.login}`
        }
    }

    if (event.pullRequest) {
        return {
            title: `#${event.pullRequest.number} ${truncateForDisplay(event.pullRequest.title, 80)}`,
            subtitle: `${event.repository.owner}/${event.repository.name} · ${event.eventType} by ${event.sender.login}`
        }
    }

    if (event.commits.length > 0) {
        const latestCommit = event.commits[event.commits.length - 1]
        const commitMessage = latestCommit.message || (latestCommit as { name?: string }).name || latestCommit.sha.slice(0, 7)
        return {
            title: truncateForDisplay(commitMessage, 80),
            subtitle: `${event.repository.owner}/${event.repository.name} · ${event.commits.length} commit${event.commits.length === 1 ? "" : "s"} on ${event.branch || "branch"}`
        }
    }

    return {
        title: `${event.repository.owner}/${event.repository.name}`,
        subtitle: `${event.eventType} by ${event.sender.login}`
    }
}

export function formatSlackTrigger(event: SlackTriggerEvent): string {
    const blockContent = JSON.stringify(event.blocks)
    const attachmentContent = JSON.stringify(event.attachments)
    const messageText = event.text || "(no plain text)"
    const threadTs = event.threadTs ?? event.threadTimestamp ?? null
    const eventLabel =
        event.eventType === "app_mention" ? "Incoming Slack App Mention Event." : event.eventType === "reaction_added" ? "Incoming Slack Reaction Added Event." : "Incoming Slack Message Event."
    const reactionInfo =
        event.eventType === "reaction_added"
            ? `Reaction: ${event.reaction || "unknown"}\n        Target Message Timestamp: ${event.itemTimestamp || "unknown"}\n        Target User: ${event.itemUserId || "unknown"}`
            : ""

    return `
        ${eventLabel}

        Slack Event:
        Event Type: ${event.eventType}
        Channel: ${event.channelName || event.channelId}
        User: ${event.userName || event.userId}
        Message: ${messageText}
        Timestamp: ${event.timestamp}
        ${threadTs ? `Thread: ${threadTs}` : ""}
        Team ID: ${event.teamId}
        ${reactionInfo}
        ${
            blockContent
                ? `
        Rich Content (from blocks):
        ${blockContent}`
                : ""
        }
        ${
            attachmentContent
                ? `
        Attachment Content:
        ${attachmentContent}`
                : ""
        }
        `
}

export function debugSlackTrigger(event: SlackTriggerEvent): string {
    const isDM = event.channelType === "im"
    return `Slack Event: ${event.eventType} - ${isDM ? "DM" : event.channelName || event.channelId} - ${event.userName || event.userId}`
}

export function formatSlackDisplay(event: SlackTriggerEvent): TriggerDisplay {
    const channelLabel = event.channelType === "im" ? "DM" : event.channelName || event.channelId
    const actorLabel = event.userName || event.userId

    if (event.eventType === "reaction_added") {
        return {
            title: `:${event.reaction || "reaction"}: reaction`,
            subtitle: `${channelLabel} by ${actorLabel}`
        }
    }

    const messageText = event.text?.trim()
    return {
        title: messageText && messageText.length > 0 ? truncateForDisplay(messageText, 80) : "(no message text)",
        subtitle: `${channelLabel} by ${actorLabel}`
    }
}

export function formatGmailTrigger(event: GmailTrigger): string {
    const attachmentInfo = event.attachments?.map(attachment => `- ${attachment.filename} ${attachment.isInline ? "Inline" : "Attachment"} (${attachment.mimeType})`).join("\n") || "No attachments"

    return `
        Incoming Email Event.

        Gmail Event:
        Subject: ${event.subject}
        From: ${event.from}
        To: ${event.to}
        Date: ${event.date}
        Message ID: ${event.messageId}
        Thread ID: ${event.threadId}
        Body: ${event.body}
        Snippet: ${event.snippet}
        Attachments (if any listed, actual files should be added below):
        ${attachmentInfo}
        `
}

export function debugGmailTrigger(event: GmailTrigger): string {
    return `Gmail Event: ${event.subject} message ID: ${event.messageId}`
}

export function formatGmailDisplay(event: GmailTrigger): TriggerDisplay {
    return {
        title: event.subject || "(no subject)",
        subtitle: `from ${event.from}`
    }
}

export function formatLinearTrigger(event: LinearTrigger): string {
    const indentMultiline = (text: string): string =>
        text
            .split("\n")
            .map(line => `        ${line}`)
            .join("\n")

    const sections: string[] = []
    sections.push(`Incoming Linear ${event.type} Event`)
    sections.push(`Action: ${event.action}`)
    sections.push(`Actor: ${event.actor.name} (${event.actor.email})`)
    sections.push(`Created: ${event.createdAt}`)

    if (event.type === "Issue" && event.data) {
        const issue = event.data
        const issueSections: string[] = []
        issueSections.push(`Issue: ${issue.identifier} - ${issue.title}`)
        if (issue.description) issueSections.push(`Description:\n${indentMultiline(issue.description)}`)
        issueSections.push(`Priority: ${issue.priorityLabel || issue.priority}`)
        issueSections.push(`State: ${issue.state?.name || "Unknown"}`)
        issueSections.push(`Team: ${issue.team?.name || "Unknown"}`)
        if (issue.assignee) issueSections.push(`Assignee: ${issue.assignee.name}`)
        if (issue.labels?.length) issueSections.push(`Labels: ${issue.labels.map((label: any) => label.name || label).join(", ")}`)
        if (issue.url) issueSections.push(`URL: ${issue.url}`)
        sections.push(issueSections.join("\n"))
    } else if (event.type === "Comment" && event.data) {
        const commentSections = [`Comment on Issue: ${event.data.issueId || "Unknown"}`]
        if (event.data.body) commentSections.push(`Comment:\n${indentMultiline(event.data.body)}`)
        sections.push(commentSections.join("\n"))
    } else {
        sections.push(`Event Data:\n${indentMultiline(JSON.stringify(event.data, null, 2))}`)
    }

    if (event.organizationId) {
        sections.push(`Organization ID: ${event.organizationId}`)
    }

    return sections.join("\n\n")
}

export function debugLinearTrigger(event: LinearTrigger): string {
    if (event.type === "Issue") {
        return `Linear ${event.type} Event: ${event.data.identifier} - ${event.data.title} (${event.action})`
    }
    return `Linear ${event.type} Event: Comment on issue ${event.data.issueId || "Unknown"} (${event.action})`
}

export function formatLinearDisplay(event: LinearTrigger): TriggerDisplay {
    if (event.type === "Issue") {
        return {
            title: `${event.data.identifier} ${event.data.title}`,
            subtitle: `${event.data.team?.name || "Linear"} · ${event.action} issue`
        }
    }
    return {
        title: `Comment on ${event.data.issueId || "Unknown issue"}`,
        subtitle: `${event.actor.name} · ${event.action} comment`
    }
}

export function formatWorkOSTrigger(event: WorkOSTrigger): string {
    const parts = [`WorkOS Event: ${event.eventType}`]

    if ("user" in event && event.user) {
        parts.push(`User Email: ${event.user.email}`)
        if (event.user.firstName || event.user.lastName) {
            parts.push(`User Name: ${[event.user.firstName, event.user.lastName].filter(Boolean).join(" ")}`)
        }
        parts.push(`User ID: ${event.user.id}`)
    }

    parts.push(`\nFull Event Data:\n${JSON.stringify(event, null, 2)}`)
    return parts.join("\n")
}

export function debugWorkOSTrigger(event: WorkOSTrigger): string {
    return `WorkOS ${event.eventType}`
}

export function formatWorkOSDisplay(event: WorkOSTrigger): TriggerDisplay {
    if ("user" in event && event.user) {
        return {
            title: event.user.email,
            subtitle: humanizeWorkOSEventType(event.eventType)
        }
    }

    if ("organization" in event && event.organization) {
        return {
            title: event.organization.name,
            subtitle: humanizeWorkOSEventType(event.eventType)
        }
    }

    if ("invitation" in event && event.invitation) {
        return {
            title: event.invitation.email,
            subtitle: humanizeWorkOSEventType(event.eventType)
        }
    }

    if ("membership" in event && event.membership) {
        return {
            title: event.membership.role.slug,
            subtitle: humanizeWorkOSEventType(event.eventType)
        }
    }

    return {
        title: "WorkOS event",
        subtitle: humanizeWorkOSEventType(event.eventType)
    }
}

function humanizeWorkOSEventType(eventType: string): string {
    return eventType.replaceAll(".", " ")
}

export function formatHeyReachTrigger(event: HeyReachTrigger): string {
    const lines = [`HeyReach Event: ${event.eventType}`, `Event ID: ${event.eventId}`, `Created At: ${event.createdAt}`]
    const leadName = heyReachLeadFullName(event)
    if (leadName) lines.push(`Lead: ${leadName}`)
    if (event.lead?.profile_url) lines.push(`LinkedIn URL: ${event.lead.profile_url}`)
    const company = event.lead?.company_name
    if (company) lines.push(`Company: ${company}`)
    if (event.lead?.position) lines.push(`Position: ${event.lead.position}`)
    if (event.campaign) lines.push(`Campaign: ${event.campaign.name || event.campaign.id || "unknown"}`)
    if (event.linkedInAccount) {
        const acc = event.linkedInAccount
        const accountName = [acc.first_name, acc.last_name].filter(Boolean).join(" ").trim() || acc.full_name?.trim()
        if (accountName) lines.push(`LinkedIn Account: ${accountName}`)
    }
    if ("messageBody" in event && event.messageBody) lines.push(`Message:\n${event.messageBody}`)
    if ("postUrl" in event && event.postUrl) lines.push(`Post URL: ${event.postUrl}`)
    if ("tags" in event && event.tags?.length) lines.push(`Tags: ${event.tags.join(", ")}`)
    lines.push(`\nFull Payload:\n${JSON.stringify(event.rawPayload, null, 2)}`)
    return lines.join("\n")
}

export function debugHeyReachTrigger(event: HeyReachTrigger): string {
    return `HeyReach ${event.eventType}${event.lead?.id != null ? ` lead=${event.lead.id}` : ""}`
}

export function formatHeyReachDisplay(event: HeyReachTrigger): TriggerDisplay {
    const subtitle = humanizeHeyReachEventType(event.eventType)
    const leadName = heyReachLeadFullName(event)
    if (leadName) {
        return { title: leadName, subtitle }
    }
    if (event.campaign?.name) {
        return { title: event.campaign.name, subtitle }
    }
    return { title: "HeyReach event", subtitle }
}

function heyReachLeadFullName(event: HeyReachTrigger): string | null {
    const lead = event.lead
    if (!lead) return null
    const composed = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || lead.full_name?.trim() || ""
    const idStr = lead.id != null ? String(lead.id) : null
    return composed || idStr
}

function humanizeHeyReachEventType(eventType: string): string {
    return eventType
        .split("_")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")
}

export function formatAttioTrigger(event: AttioTrigger): string {
    const lines = [`Attio Event: ${event.eventType}`, `Event ID: ${event.eventId}`, `Created At: ${event.createdAt}`, `Workspace ID: ${event.workspaceId}`]
    if (event.objectSlug) lines.push(`Object: ${event.objectSlug}`)
    const resource = attioResourceLabel(event)
    if (resource) lines.push(`Resource: ${resource}`)
    if (event.actor.type) lines.push(`Actor: ${event.actor.type}${event.actor.id ? ` (${event.actor.id})` : ""}`)
    lines.push(`\nFull Event:\n${JSON.stringify(event.rawEvent, null, 2)}`)
    return lines.join("\n")
}

export function debugAttioTrigger(event: AttioTrigger): string {
    return `Attio ${event.eventType}${event.objectSlug ? ` object=${event.objectSlug}` : ""}`
}

export function formatAttioDisplay(event: AttioTrigger): TriggerDisplay {
    const subtitle = humanizeAttioEventType(event.eventType)
    const resource = attioResourceLabel(event)
    return { title: resource ?? "Attio event", subtitle }
}

export function humanizeAttioEventType(eventType: string): string {
    return eventType
        .replace(/[-.]/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")
}

function attioResourceLabel(event: AttioTrigger): string | null {
    const ids = event.resourceIds
    if (ids.record_id) return `${event.objectSlug ?? "record"} ${ids.record_id}`
    if (ids.entry_id) return `list entry ${ids.entry_id}`
    if (ids.list_id) return `list ${ids.list_id}`
    if (ids.note_id) return `note ${ids.note_id}`
    if (ids.task_id) return `task ${ids.task_id}`
    if (ids.comment_id) return `comment ${ids.comment_id}`
    if (ids.call_recording_id) return `call recording ${ids.call_recording_id}`
    if (ids.workspace_member_id) return `workspace member ${ids.workspace_member_id}`
    if (ids.attribute_id) return `attribute ${ids.attribute_id}`
    return null
}

export function formatWebhookTrigger(event: WebhookTrigger): string {
    return `Webhook request received.\n\nMethod: ${event.method}\n\nPayload:\n${JSON.stringify(event.body, null, 2)}`
}

export function debugWebhookTrigger(event: WebhookTrigger): string {
    return `Webhook Trigger (${event.method})`
}

export function formatWebhookDisplay(event: WebhookTrigger): TriggerDisplay {
    const bodyPreview = summarizeUnknown(event.body)
    return {
        title: bodyPreview || "Webhook trigger",
        subtitle: event.method
    }
}

export function formatCronTrigger(event: CronTrigger): string {
    if (event.isManualTrigger) {
        let message = `This is a manually triggered event for the channel input ${event.inputId}.`
        if (event.manualContext) {
            message += `\n\nUser provided context for this manual trigger:\n${event.manualContext}`
        }
        return message
    }
    return `This is a scheduled event for the channel input ${event.inputId}. The channel input is configured to run at the following cron expression.`
}

export function debugCronTrigger(event: CronTrigger): string {
    return event.isManualTrigger ? "Manual Trigger" : "Scheduled Event"
}

export function formatCronDisplay(event: CronTrigger): TriggerDisplay {
    return {
        title: event.isManualTrigger ? "Manual trigger" : "Scheduled event",
        subtitle: event.manualContext ? truncateForDisplay(event.manualContext, 80) : event.inputId
    }
}

export function formatWebMonitorTrigger(event: WebMonitorTrigger): string {
    const lines = [
        `Web event for monitored query (frequency: ${event.frequency.number}${event.frequency.unit}).`,
        `Query: ${event.query}`,
        `Monitor ID: ${event.monitorId}`,
        `Event Group ID: ${event.eventGroupId}`,
        `Output Type: ${event.outputType}`
    ]

    if (Object.keys(event.metadata).length > 0) {
        lines.push(`Metadata:\n${JSON.stringify(event.metadata, null, 2)}`)
    }

    lines.push(`Payload:\n${JSON.stringify(event.payload, null, 2)}`)
    if (event.rawPayload) {
        lines.push(`Raw Payload:\n${event.rawPayload}`)
    }
    return lines.join("\n\n")
}

export function debugWebMonitorTrigger(event: WebMonitorTrigger): string {
    return `${event.query.slice(0, 80)}${event.query.length > 80 ? "…" : ""}`
}

export function formatWebMonitorDisplay(event: WebMonitorTrigger): TriggerDisplay {
    const sourceLabel = firstHost(event.sourceUrls)
    const outputPreview = typeof event.payload === "string" ? event.payload : typeof event.rawPayload === "string" ? event.rawPayload : ""

    return {
        title: sourceLabel ? `Change detected on ${sourceLabel}` : "Web monitor match",
        subtitle: truncateForDisplay(outputPreview || event.query, 100)
    }
}

function firstHost(urls: string[]): string | null {
    const first = urls[0]
    if (!first) return null

    try {
        return new URL(first).host
    } catch {
        return first
    }
}

function summarizeUnknown(value: unknown): string {
    if (typeof value === "string") {
        return truncateForDisplay(value.trim() || "Webhook trigger", 80)
    }

    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>
        const preferred = [record.title, record.subject, record.name, record.action, record.type, record.event].find(v => typeof v === "string" && v.trim().length > 0)
        if (typeof preferred === "string") {
            return truncateForDisplay(preferred, 80)
        }
    }

    return "Webhook trigger"
}

function truncateForDisplay(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

type SlackTriggerEvent = z.infer<typeof slackTriggerSchema>
