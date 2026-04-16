import { IntegrationType } from "./Integrations"
import type { CronTrigger, GithubTrigger, GmailTrigger, LinearTrigger, ManualSampleTrigger, SlackTrigger, Trigger, WebhookTrigger, WorkOSTrigger } from "./Triggers"

interface TriggerPresenter<TEvent extends Trigger> {
    formatForAgent(event: TEvent): string
    debug(event: TEvent): string
}

type IntegrationTrigger = Exclude<Trigger, ManualSampleTrigger>
type SupportedIntegrationType = IntegrationTrigger["integrationType"]

type TriggerPresenterRegistry = {
    manual_sample: TriggerPresenter<ManualSampleTrigger>
} & {
    [K in SupportedIntegrationType]: TriggerPresenter<Extract<IntegrationTrigger, { integrationType: K }>>
}

const TriggerPresenters = {
    manual_sample: {
        formatForAgent: (event: ManualSampleTrigger): string => `Manual sample event for ${event.integrationType}.`,
        debug: (event: ManualSampleTrigger): string => `${event.integrationType} ${event.eventType}`
    },
    [IntegrationType.GITHUB]: {
        formatForAgent: formatGithubTrigger,
        debug: (event: GithubTrigger): string => `GitHub Event: ${event.eventType} - ${event.repository.owner}/${event.repository.name} - ${event.sender.login}`
    },
    [IntegrationType.SLACK]: {
        formatForAgent: formatSlackTrigger,
        debug: (event: SlackTrigger): string => {
            const isDM = event.channelType === "im"
            return `Slack Event: ${event.eventType} - ${isDM ? "DM" : event.channelName || event.channelId} - ${event.userName || event.userId}`
        }
    },
    [IntegrationType.GMAIL]: {
        formatForAgent: formatGmailTrigger,
        debug: (event: GmailTrigger): string => `Gmail Event: ${event.subject} message ID: ${event.messageId}`
    },
    [IntegrationType.LINEAR]: {
        formatForAgent: formatLinearTrigger,
        debug: (event: LinearTrigger): string => {
            if (event.type === "Issue") {
                return `Linear ${event.type} Event: ${event.data.identifier} - ${event.data.title} (${event.action})`
            }
            return `Linear ${event.type} Event: Comment on issue ${event.data.issueId || "Unknown"} (${event.action})`
        }
    },
    [IntegrationType.WORKOS]: {
        formatForAgent: formatWorkOSTrigger,
        debug: (event: WorkOSTrigger): string => `WorkOS ${event.eventType}`
    },
    [IntegrationType.WEBHOOK]: {
        formatForAgent: formatWebhookTrigger,
        debug: (event: WebhookTrigger): string => `Webhook Trigger (${event.method})`
    },
    [IntegrationType.CRON_JOB]: {
        formatForAgent: formatCronTrigger,
        debug: (event: CronTrigger): string => (event.isManualTrigger ? "Manual Trigger" : "Scheduled Event")
    }
} as TriggerPresenterRegistry

function dispatchPresenter(event: IntegrationTrigger, method: keyof TriggerPresenter<Trigger>): string {
    switch (event.integrationType) {
        case IntegrationType.GITHUB:
            return TriggerPresenters[IntegrationType.GITHUB][method](event)
        case IntegrationType.SLACK:
            return TriggerPresenters[IntegrationType.SLACK][method](event)
        case IntegrationType.GMAIL:
            return TriggerPresenters[IntegrationType.GMAIL][method](event)
        case IntegrationType.LINEAR:
            return TriggerPresenters[IntegrationType.LINEAR][method](event)
        case IntegrationType.WORKOS:
            return TriggerPresenters[IntegrationType.WORKOS][method](event)
        case IntegrationType.WEBHOOK:
            return TriggerPresenters[IntegrationType.WEBHOOK][method](event)
        case IntegrationType.CRON_JOB:
            return TriggerPresenters[IntegrationType.CRON_JOB][method](event)
    }
}

export function formatTriggerForAgent(event: Trigger): string {
    if (event.eventType === "manual_sample") {
        return TriggerPresenters.manual_sample.formatForAgent(event)
    }
    return dispatchPresenter(event, "formatForAgent")
}

export function debugTrigger(event: Trigger): string {
    if (event.eventType === "manual_sample") {
        return TriggerPresenters.manual_sample.debug(event)
    }
    return dispatchPresenter(event, "debug")
}

function formatGithubTrigger(event: GithubTrigger): string {
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
        "pull_request.merged": "Pull Request Merged"
    }
    const eventDescription = eventTypeDescriptions[event.eventType] || event.eventType

    const repoInfo = [
        `Repository: ${event.repository.owner}/${event.repository.name}`,
        `Repository ID: ${event.repository.id}`,
        `Default Branch: ${event.repository.defaultBranch}`,
        `View on GitHub: https://github.com/${event.repository.owner}/${event.repository.name}`
    ].join("\n")

    const senderInfo = [`Actor: ${event.sender.login}`, ...(event.sender.email ? [`Email: ${event.sender.email}`] : [])].join("\n")
    const branchInfo = event.branch ? `Branch: ${event.branch}` : null

    let prInfo = ""
    if (event.pullRequest) {
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

    let commitsInfo = ""
    if (event.commits.length > 0) {
        const commitLines: string[] = []
        commitLines.push(`Commits (${event.commits.length}):`)

        event.commits.forEach((commit, index) => {
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

    return [
        `Incoming GitHub Event: ${eventDescription}`,
        `\nRepository Information:\n${indentMultiline(repoInfo)}`,
        `\nActor Information:\n${indentMultiline(senderInfo)}`,
        ...(branchInfo ? [`\nBranch Information:\n${indentMultiline(branchInfo)}`] : []),
        ...(prInfo ? [`\nPull Request Information:\n${indentMultiline(prInfo)}`] : []),
        ...(commitsInfo ? [`\n${commitsInfo}`] : [])
    ].join("\n\n")
}

function formatSlackTrigger(event: SlackTrigger): string {
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

function formatGmailTrigger(event: GmailTrigger): string {
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

function formatLinearTrigger(event: LinearTrigger): string {
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

function formatWorkOSTrigger(event: WorkOSTrigger): string {
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

function formatWebhookTrigger(event: WebhookTrigger): string {
    return `Webhook request received.\n\nMethod: ${event.method}\n\nPayload:\n${JSON.stringify(event.body, null, 2)}`
}

function formatCronTrigger(event: CronTrigger): string {
    if (event.isManualTrigger) {
        let message = `This is a manually triggered event for the channel input ${event.inputId}.`
        if (event.manualContext) {
            message += `\n\nUser provided context for this manual trigger:\n${event.manualContext}`
        }
        return message
    }
    return `This is a scheduled event for the channel input ${event.inputId}. The channel input is configured to run at the following cron expression.`
}
