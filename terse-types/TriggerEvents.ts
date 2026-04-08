import { z } from "zod"

import { WorkOSEventType, gitHubEventTypeSchema, gmailEventTypeSchema, linearEventTypeSchema, slackEventTypeSchema, workOSEventTypeSchema } from "./Configs"
import { IntegrationType, integrationTypeEnum } from "./Integrations"
import { SlackAttachments, SlackBlocks, SlackChannelType, SlackFiles } from "./SlackTypes"

// Mark: Event Data

const eventTypeEnum = z.union([slackEventTypeSchema, gitHubEventTypeSchema, linearEventTypeSchema, gmailEventTypeSchema, workOSEventTypeSchema])

export const eventDataSchema = z.object({
    integrationType: integrationTypeEnum,
    eventType: eventTypeEnum
})

// Slack Event Data
export const slackEventDataSchema = eventDataSchema.extend({
    integrationType: z.literal(IntegrationType.SLACK),
    eventType: slackEventTypeSchema,
    channelId: z.string(),
    channelName: z.string().nullable(),
    userId: z.string(),
    userName: z.string().nullable(),
    text: z.string(),
    timestamp: z.string(),
    // Keep both names during migration; `threadTs` is the target shared field.
    threadTs: z.string().nullable().optional(),
    threadTimestamp: z.string().nullable(),
    teamId: z.string(),
    permalink: z.string().nullable(),
    channelType: z.enum(SlackChannelType).nullable(),
    blocks: z.array(z.unknown()).nullable(),
    attachments: z.array(z.unknown()).nullable(),
    files: z.array(z.unknown()).nullable()
})
type SlackEventDataSchemaShape = z.infer<typeof slackEventDataSchema>

export type SlackEventData = Omit<SlackEventDataSchemaShape, "blocks" | "attachments" | "files"> & {
    blocks: SlackBlocks | null
    attachments: SlackAttachments | null
    files: SlackFiles | null
}

// Github Event Data
export const fileDiffSchema = z.object({
    filename: z.string(),
    diff: z.string()
})

export const commitSchema = z.object({
    sha: z.string(),
    // Keep both names during migration; `message` is the target shared field.
    message: z.string().optional(),
    name: z.string(),
    fileDiffs: z.array(fileDiffSchema)
})

export const pullRequestUserSchema = z.object({
    login: z.string(),
    email: z.string().optional()
})

export const pullRequestRefSchema = z.object({
    ref: z.string(),
    sha: z.string()
})

export const pullRequestSchema = z.object({
    id: z.string(),
    number: z.number(),
    title: z.string(),
    body: z.string().optional(),
    state: z.enum(["open", "closed"]),
    merged: z.boolean(),
    head: pullRequestRefSchema,
    base: pullRequestRefSchema,
    // Keep both names during migration; `author` is the target shared field.
    user: pullRequestUserSchema,
    author: pullRequestUserSchema.optional(),
    url: z.string().optional()
})

export const githubRepositorySchema = z.object({
    id: z.number(),
    name: z.string(),
    owner: z.string(),
    defaultBranch: z.string()
})

export const senderSchema = z.object({
    login: z.string(),
    email: z.string().optional()
})

export const githubEventDataSchema = eventDataSchema.extend({
    integrationType: z.literal(IntegrationType.GITHUB),
    eventType: gitHubEventTypeSchema,
    username: z.string(),
    installationId: z.number(),
    repositoryName: z.string(),
    branch: z.string().optional(),
    commits: z.array(commitSchema),
    pullRequest: pullRequestSchema.optional(),
    repository: githubRepositorySchema,
    sender: senderSchema
})
export type GithubEventData = z.infer<typeof githubEventDataSchema>

// Gmail Event Data

export const GmailParsedAttachmentSchema = z.object({
    attachmentId: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    contentId: z.string().optional(),
    isInline: z.boolean()
})
export type GmailParsedAttachment = z.infer<typeof GmailParsedAttachmentSchema>

export const GmailEventDataSchema = z.object({
    id: z.string(),
    threadId: z.string(),
    subject: z.string(),
    from: z.string(),
    to: z.string(),
    date: z.string(),
    internalDate: z.string(),
    messageId: z.string(),
    body: z.string(),
    snippet: z.string(),
    labelIds: z.array(z.string()),
    attachments: z.array(GmailParsedAttachmentSchema).optional()
})

export type GmailEventData = z.infer<typeof GmailEventDataSchema>

export const LinearWebhookActionSchema = z.enum(["create", "update", "remove"])

export const LinearWebhookTypeSchema = z.union([z.literal("Issue"), z.literal("Comment"), z.literal("Project"), z.string()])

export const LinearWebhookActorSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    url: z.string(),
    type: z.string()
})

export const LinearWebhookStateSchema = z.object({
    id: z.string(),
    color: z.string(),
    name: z.string(),
    type: z.string()
})

export const LinearWebhookTeamSchema = z.object({
    id: z.string(),
    key: z.string(),
    name: z.string()
})

export const LinearWebhookAssigneeSchema = z.object({
    id: z.string(),
    name: z.string()
})

export const LinearWebhookDataSchema = z.object({
    id: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    number: z.number(),
    title: z.string(),
    priority: z.number(),
    sortOrder: z.number(),
    prioritySortOrder: z.number(),
    slaType: z.string(),
    addedToTeamAt: z.string(),
    trashed: z.boolean(),
    labelIds: z.array(z.string()),
    teamId: z.string(),
    previousIdentifiers: z.array(z.string()),
    stateId: z.string(),
    reactionData: z.array(z.any()),
    priorityLabel: z.string(),
    botActor: z.string().optional(),
    identifier: z.string(),
    url: z.string(),
    subscriberIds: z.array(z.string()),
    state: LinearWebhookStateSchema,
    team: LinearWebhookTeamSchema,
    labels: z.array(z.any()),
    description: z.string().optional(),
    descriptionData: z.string().optional(),
    assignee: LinearWebhookAssigneeSchema.optional()
})

export const linearWebhookEventDataSchema = z.object({
    action: LinearWebhookActionSchema,
    actor: LinearWebhookActorSchema,
    createdAt: z.string(),
    data: LinearWebhookDataSchema,
    type: LinearWebhookTypeSchema,
    url: z.string().optional(),
    organizationId: z.string(),
    webhookTimestamp: z.number(),
    webhookId: z.string()
})

export type LinearWebhookEventData = z.infer<typeof linearWebhookEventDataSchema>

export const WorkOSWebhookDataSchema = z.record(z.string(), z.any())

export const workOSWebhookPayloadSchema = z.object({
    id: z.string(),
    event: z.string(),
    data: WorkOSWebhookDataSchema,
    created_at: z.string()
})

export type WorkOSWebhookPayload = z.infer<typeof workOSWebhookPayloadSchema>

// MARK: Canonical Trigger Events

export const webhookTriggerEventTypeSchema = z.literal("webhook")
export type WebhookTriggerEventType = z.infer<typeof webhookTriggerEventTypeSchema>

export const cronTriggerEventTypeSchema = z.literal("cron")
export type CronTriggerEventType = z.infer<typeof cronTriggerEventTypeSchema>

export const manualSampleTriggerEventTypeSchema = z.literal("manual_sample")
export type ManualSampleTriggerEventType = z.infer<typeof manualSampleTriggerEventTypeSchema>

export const triggerEventTypeSchema = z.union([
    slackEventTypeSchema,
    gitHubEventTypeSchema,
    linearEventTypeSchema,
    gmailEventTypeSchema,
    workOSEventTypeSchema,
    webhookTriggerEventTypeSchema,
    cronTriggerEventTypeSchema,
    manualSampleTriggerEventTypeSchema
])
export type TriggerEventType = z.infer<typeof triggerEventTypeSchema>

export const baseTriggerEventSchema = z.object({
    integrationType: integrationTypeEnum,
    eventType: triggerEventTypeSchema
})
export type BaseTriggerEvent = z.infer<typeof baseTriggerEventSchema>

export const slackTriggerEventSchema = slackEventDataSchema
export type SlackTriggerEvent = SlackEventData

export const githubTriggerEventSchema = githubEventDataSchema
export type GithubTriggerEvent = GithubEventData

export const gmailTriggerEventSchema = baseTriggerEventSchema
    .extend({
        integrationType: z.literal(IntegrationType.GMAIL),
        eventType: gmailEventTypeSchema
    })
    .merge(GmailEventDataSchema)
export type GmailTriggerEvent = z.infer<typeof gmailTriggerEventSchema>

export const linearTriggerEventSchema = baseTriggerEventSchema
    .extend({
        integrationType: z.literal(IntegrationType.LINEAR),
        eventType: linearEventTypeSchema
    })
    .merge(linearWebhookEventDataSchema)
export type LinearTriggerEvent = z.infer<typeof linearTriggerEventSchema>

export const workOSTriggerUserSchema = z.object({
    id: z.string(),
    email: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    emailVerified: z.boolean(),
    profilePictureUrl: z.string().optional()
})
export type WorkOSTriggerUser = z.infer<typeof workOSTriggerUserSchema>

export const workOSTriggerMembershipSchema = z.object({
    id: z.string(),
    userId: z.string(),
    organizationId: z.string(),
    role: z.object({
        slug: z.string()
    }),
    status: z.string()
})
export type WorkOSTriggerMembership = z.infer<typeof workOSTriggerMembershipSchema>

export const workOSTriggerInvitationSchema = z.object({
    id: z.string(),
    email: z.string(),
    organizationId: z.string(),
    inviterEmail: z.string().optional(),
    state: z.string(),
    acceptedAt: z.string().optional()
})
export type WorkOSTriggerInvitation = z.infer<typeof workOSTriggerInvitationSchema>

export const workOSTriggerOrganizationSchema = z.object({
    id: z.string(),
    name: z.string()
})
export type WorkOSTriggerOrganization = z.infer<typeof workOSTriggerOrganizationSchema>

export const workOSBaseTriggerEventSchema = baseTriggerEventSchema.extend({
    integrationType: z.literal(IntegrationType.WORKOS),
    eventType: workOSEventTypeSchema,
    eventId: z.string(),
    createdAt: z.string()
})
export type WorkOSBaseTriggerEvent = z.infer<typeof workOSBaseTriggerEventSchema>

export const workOSUserTriggerEventSchema = workOSBaseTriggerEventSchema.extend({
    eventType: z.union([z.literal(WorkOSEventType.USER_CREATED), z.literal(WorkOSEventType.USER_UPDATED), z.literal(WorkOSEventType.USER_DELETED)]),
    user: workOSTriggerUserSchema
})
export type WorkOSUserTriggerEvent = z.infer<typeof workOSUserTriggerEventSchema>

export const workOSMembershipTriggerEventSchema = workOSBaseTriggerEventSchema.extend({
    eventType: z.union([
        z.literal(WorkOSEventType.ORGANIZATION_MEMBERSHIP_CREATED),
        z.literal(WorkOSEventType.ORGANIZATION_MEMBERSHIP_UPDATED),
        z.literal(WorkOSEventType.ORGANIZATION_MEMBERSHIP_DELETED)
    ]),
    membership: workOSTriggerMembershipSchema
})
export type WorkOSMembershipTriggerEvent = z.infer<typeof workOSMembershipTriggerEventSchema>

export const workOSInvitationTriggerEventSchema = workOSBaseTriggerEventSchema.extend({
    eventType: z.union([
        z.literal(WorkOSEventType.INVITATION_CREATED),
        z.literal(WorkOSEventType.INVITATION_ACCEPTED),
        z.literal(WorkOSEventType.INVITATION_RESENT),
        z.literal(WorkOSEventType.INVITATION_REVOKED)
    ]),
    invitation: workOSTriggerInvitationSchema,
    user: workOSTriggerUserSchema.optional()
})
export type WorkOSInvitationTriggerEvent = z.infer<typeof workOSInvitationTriggerEventSchema>

export const workOSOrganizationTriggerEventSchema = workOSBaseTriggerEventSchema.extend({
    eventType: z.literal(WorkOSEventType.ORGANIZATION_CREATED),
    organization: workOSTriggerOrganizationSchema
})
export type WorkOSOrganizationTriggerEvent = z.infer<typeof workOSOrganizationTriggerEventSchema>

export const workOSTriggerEventSchema = z.union([
    workOSUserTriggerEventSchema,
    workOSMembershipTriggerEventSchema,
    workOSInvitationTriggerEventSchema,
    workOSOrganizationTriggerEventSchema,
    workOSBaseTriggerEventSchema
])
export type WorkOSTriggerEvent = z.infer<typeof workOSTriggerEventSchema>

export const webhookTriggerEventSchema = baseTriggerEventSchema.extend({
    integrationType: z.literal(IntegrationType.WEBHOOK),
    eventType: webhookTriggerEventTypeSchema,
    body: z.record(z.string(), z.unknown()),
    headers: z.record(z.string(), z.string()),
    method: z.string()
})
export type WebhookTriggerEvent = z.infer<typeof webhookTriggerEventSchema>

export const cronTriggerEventSchema = baseTriggerEventSchema.extend({
    integrationType: z.literal(IntegrationType.CRON_JOB),
    eventType: cronTriggerEventTypeSchema,
    inputId: z.string(),
    isManualTrigger: z.boolean().optional(),
    manualContext: z.string().optional()
})
export type CronTriggerEvent = z.infer<typeof cronTriggerEventSchema>

export const manualSampleTriggerEventSchema = baseTriggerEventSchema.extend({
    eventType: manualSampleTriggerEventTypeSchema
})
export type ManualSampleTriggerEvent = z.infer<typeof manualSampleTriggerEventSchema>

export const triggerEventSchema = z.union([
    slackTriggerEventSchema,
    githubTriggerEventSchema,
    gmailTriggerEventSchema,
    linearTriggerEventSchema,
    workOSTriggerEventSchema,
    webhookTriggerEventSchema,
    cronTriggerEventSchema,
    manualSampleTriggerEventSchema
])
export type TriggerEvent = z.infer<typeof triggerEventSchema>

export function parseTriggerEvent(value: unknown): TriggerEvent {
    return triggerEventSchema.parse(value)
}

export function createManualTriggerEvent(
    params: {
        integrationType?: IntegrationType
    } = {}
): TriggerEvent {
    return parseTriggerEvent({
        integrationType: params.integrationType ?? IntegrationType.TERSE,
        eventType: "manual_sample"
    })
}

export function formatTriggerEventForAgent(event: TriggerEvent): string {
    if (event.eventType === "manual_sample") return `Manual sample event for ${event.integrationType}.`
    if (isGithubTriggerEvent(event)) return formatGithubTriggerEvent(event)
    if (isSlackTriggerEvent(event)) return formatSlackTriggerEvent(event)
    if (isGmailTriggerEvent(event)) return formatGmailTriggerEvent(event)
    if (isLinearTriggerEvent(event)) return formatLinearTriggerEvent(event)
    if (isWorkOSTriggerEvent(event)) return formatWorkOSTriggerEvent(event)
    if (isWebhookTriggerEvent(event)) return formatWebhookTriggerEvent(event)
    if (isCronTriggerEvent(event)) return formatCronTriggerEvent(event)
    return `Manual sample event for ${event.integrationType}.`
}

export function debugTriggerEvent(event: TriggerEvent): string {
    if (event.eventType === "manual_sample") return `${event.integrationType} ${event.eventType}`
    if (isGithubTriggerEvent(event)) return `GitHub Event: ${event.eventType} - ${event.repository.owner}/${event.repository.name} - ${event.sender.login}`
    if (isSlackTriggerEvent(event)) {
        const isDM = event.channelType === "im"
        return `Slack Event: ${isDM ? "DM" : event.channelName || event.channelId} - ${event.userName || event.userId}`
    }
    if (isGmailTriggerEvent(event)) return `Gmail Event: ${event.subject} message ID: ${event.messageId}`
    if (isLinearTriggerEvent(event)) {
        if (event.type === "Issue") {
            return `Linear ${event.type} Event: ${event.data.identifier} - ${event.data.title} (${event.action})`
        }
        if (event.type === "Comment") {
            const comment = event.data as Record<string, unknown>
            return `Linear ${event.type} Event: Comment on issue ${String(comment.issueId || "Unknown")} (${event.action})`
        }
        return `Linear ${event.type} Event: ${event.action}`
    }
    if (isWorkOSTriggerEvent(event)) return `WorkOS ${event.eventType}`
    if (isWebhookTriggerEvent(event)) return `Webhook Trigger (${event.method})`
    if (isCronTriggerEvent(event)) return event.isManualTrigger ? "Manual Trigger" : "Scheduled Event"
    return `${event.integrationType} ${event.eventType}`
}

function isGithubTriggerEvent(event: TriggerEvent): event is GithubTriggerEvent {
    return event.integrationType === IntegrationType.GITHUB
}

function isSlackTriggerEvent(event: TriggerEvent): event is SlackTriggerEvent {
    return event.integrationType === IntegrationType.SLACK
}

function isGmailTriggerEvent(event: TriggerEvent): event is Extract<TriggerEvent, { integrationType: IntegrationType.GMAIL }> {
    return event.integrationType === IntegrationType.GMAIL
}

function isLinearTriggerEvent(event: TriggerEvent): event is LinearTriggerEvent {
    return event.integrationType === IntegrationType.LINEAR
}

function isWorkOSTriggerEvent(event: TriggerEvent): event is WorkOSTriggerEvent {
    return event.integrationType === IntegrationType.WORKOS
}

function isWebhookTriggerEvent(event: TriggerEvent): event is WebhookTriggerEvent {
    return event.integrationType === IntegrationType.WEBHOOK
}

function isCronTriggerEvent(event: TriggerEvent): event is CronTriggerEvent {
    return event.integrationType === IntegrationType.CRON_JOB
}

function formatGithubTriggerEvent(event: GithubTriggerEvent): string {
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

function formatSlackTriggerEvent(event: SlackTriggerEvent): string {
    const blockContent = JSON.stringify(event.blocks)
    const attachmentContent = JSON.stringify(event.attachments)
    const messageText = event.text || "(no plain text)"
    const threadTs = event.threadTs ?? event.threadTimestamp ?? null

    return `
        Incoming Slack Message Event.

        Slack Event:
        Channel: ${event.channelName || event.channelId}
        User: ${event.userName || event.userId}
        Message: ${messageText}
        Timestamp: ${event.timestamp}
        ${threadTs ? `Thread: ${threadTs}` : ""}
        Team ID: ${event.teamId}
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

function formatGmailTriggerEvent(event: Extract<TriggerEvent, { integrationType: IntegrationType.GMAIL }>): string {
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

function formatLinearTriggerEvent(event: LinearTriggerEvent): string {
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
        if (issue.labels?.length) issueSections.push(`Labels: ${issue.labels.map((l: any) => l.name || l).join(", ")}`)
        if (issue.url) issueSections.push(`URL: ${issue.url}`)
        sections.push(issueSections.join("\n"))
    } else if (event.type === "Comment" && event.data) {
        const comment = event.data as Record<string, unknown>
        const commentSections = [`Comment on Issue: ${String(comment.issueId || "Unknown")}`]
        if (comment.body) commentSections.push(`Comment:\n${indentMultiline(String(comment.body))}`)
        sections.push(commentSections.join("\n"))
    } else {
        sections.push(`Event Data:\n${indentMultiline(JSON.stringify(event.data, null, 2))}`)
    }

    if (event.organizationId) {
        sections.push(`Organization ID: ${event.organizationId}`)
    }

    return sections.join("\n\n")
}

function formatWorkOSTriggerEvent(event: WorkOSTriggerEvent): string {
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

function formatWebhookTriggerEvent(event: WebhookTriggerEvent): string {
    return `Webhook request received.\n\nMethod: ${event.method}\n\nPayload:\n${JSON.stringify(event.body, null, 2)}`
}

function formatCronTriggerEvent(event: CronTriggerEvent): string {
    if (event.isManualTrigger) {
        let message = `This is a manually triggered event for the channel input ${event.inputId}.`
        if (event.manualContext) {
            message += `\n\nUser provided context for this manual trigger:\n${event.manualContext}`
        }
        return message
    }
    return `This is a scheduled event for the channel input ${event.inputId}. The channel input is configured to run at the following cron expression.`
}

export const triggerEventArraySchema = z.array(triggerEventSchema)
