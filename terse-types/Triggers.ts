import { z } from "zod"

import { GitHubEventType, WorkOSEventType, frequencyUnitSchema, gitHubEventTypeSchema, gmailEventTypeSchema, linearEventTypeSchema, slackEventTypeSchema, workOSEventTypeSchema } from "./Configs"
import { IntegrationType, integrationTypeEnum } from "./Integrations"
import { SlackAttachments, SlackBlocks, SlackChannelType, SlackFiles } from "./SlackTypes"
import { debugTrigger as debugTriggerWithPresenter, formatTriggerForAgent as formatTriggerForAgentWithPresenter } from "./TriggerPresenters"

const providerTriggerTypeSchema = z.union([slackEventTypeSchema, gitHubEventTypeSchema, linearEventTypeSchema, gmailEventTypeSchema, workOSEventTypeSchema])

const TriggerHeaderSchema = z.object({
    integrationType: integrationTypeEnum,
    eventType: providerTriggerTypeSchema
})

const slackTriggerBaseSchema = TriggerHeaderSchema.extend({
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
export const slackMessageTriggerSchema = slackTriggerBaseSchema.extend({
    eventType: z.literal("message")
})
type SlackMessageTriggerSchemaShape = z.infer<typeof slackMessageTriggerSchema>
export type SlackMessageTrigger = Omit<SlackMessageTriggerSchemaShape, "blocks" | "attachments" | "files"> & {
    blocks: SlackBlocks | null
    attachments: SlackAttachments | null
    files: SlackFiles | null
}

export const slackAppMentionTriggerSchema = slackTriggerBaseSchema.extend({
    eventType: z.literal("app_mention")
})
type SlackAppMentionTriggerSchemaShape = z.infer<typeof slackAppMentionTriggerSchema>
export type SlackAppMentionTrigger = Omit<SlackAppMentionTriggerSchemaShape, "blocks" | "attachments" | "files"> & {
    blocks: SlackBlocks | null
    attachments: SlackAttachments | null
    files: SlackFiles | null
}

export const slackReactionAddedTriggerSchema = slackTriggerBaseSchema.extend({
    eventType: z.literal("reaction_added"),
    reaction: z.string(),
    itemType: z.string().nullable(),
    itemUserId: z.string().nullable(),
    itemChannelId: z.string().nullable(),
    itemTimestamp: z.string().nullable()
})
type SlackReactionAddedTriggerSchemaShape = z.infer<typeof slackReactionAddedTriggerSchema>
export type SlackReactionAddedTrigger = Omit<SlackReactionAddedTriggerSchemaShape, "blocks" | "attachments" | "files"> & {
    blocks: SlackBlocks | null
    attachments: SlackAttachments | null
    files: SlackFiles | null
}

export const slackTriggerSchema = z.discriminatedUnion("eventType", [slackMessageTriggerSchema, slackAppMentionTriggerSchema, slackReactionAddedTriggerSchema])
export type SlackTrigger = SlackMessageTrigger | SlackAppMentionTrigger | SlackReactionAddedTrigger

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

const GithubTriggerBaseSchema = z.object({
    integrationType: z.literal(IntegrationType.GITHUB),
    username: z.string(),
    installationId: z.number(),
    repositoryName: z.string(),
    repository: githubRepositorySchema,
    sender: senderSchema
})

export const GithubPushTriggerSchema = GithubTriggerBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PUSH),
    branch: z.string(),
    commits: z.array(commitSchema),
    pullRequest: z.undefined().optional()
})
export type GithubPushTrigger = z.infer<typeof GithubPushTriggerSchema>

const GithubPRTriggerBaseSchema = GithubTriggerBaseSchema.extend({
    pullRequest: pullRequestSchema,
    branch: z.string().optional(),
    commits: z.array(commitSchema)
})

export const GithubPROpenedTriggerSchema = GithubPRTriggerBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PR_OPENED)
})
export type GithubPROpenedTrigger = z.infer<typeof GithubPRMergedTriggerSchema>

export const GithubPRSynchronizedTriggerSchema = GithubPRTriggerBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PR_SYNCHRONIZE)
})
export type GithubPRSynchronizedTrigger = z.infer<typeof GithubPRSynchronizedTriggerSchema>

export const GithubPRClosedTriggerSchema = GithubPRTriggerBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PR_CLOSED)
})
export type GithubPRClosedTrigger = z.infer<typeof GithubPRClosedTriggerSchema>

export const GithubPRMergedTriggerSchema = GithubPRTriggerBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PR_MERGED)
})
export type GithubPRMergedTrigger = z.infer<typeof GithubPRMergedTriggerSchema>

export const GithubPRTriggerSchema = z.discriminatedUnion("eventType", [GithubPROpenedTriggerSchema, GithubPRSynchronizedTriggerSchema, GithubPRClosedTriggerSchema, GithubPRMergedTriggerSchema])
export type GithubPRTrigger = z.infer<typeof GithubPRTriggerSchema>

export const GithubTriggerSchema = z.discriminatedUnion("eventType", [
    GithubPushTriggerSchema,
    GithubPROpenedTriggerSchema,
    GithubPRSynchronizedTriggerSchema,
    GithubPRClosedTriggerSchema,
    GithubPRMergedTriggerSchema
])
export type GithubTrigger = z.infer<typeof GithubTriggerSchema>

export const GmailParsedAttachmentSchema = z.object({
    attachmentId: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    contentId: z.string().optional(),
    isInline: z.boolean()
})
export type GmailParsedAttachment = z.infer<typeof GmailParsedAttachmentSchema>

const gmailMessagePayloadSchema = z.object({
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

export type GmailMessagePayload = z.infer<typeof gmailMessagePayloadSchema>

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
    assignee: LinearWebhookAssigneeSchema.optional(),
    /** Present on many issue webhooks; used for trigger scoping */
    projectId: z.string().optional()
})

export const LinearWebhookCommentDataSchema = z
    .object({
        id: z.string(),
        body: z.string().optional(),
        issueId: z.string().optional()
    })
    .passthrough()

export const linearWebhookPayloadSchema = z.object({
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

export type LinearWebhookPayload = z.infer<typeof linearWebhookPayloadSchema>

export const WorkOSWebhookDataSchema = z.record(z.string(), z.any())

export const workOSWebhookPayloadSchema = z.object({
    id: z.string(),
    event: z.string(),
    data: WorkOSWebhookDataSchema,
    created_at: z.string()
})

export type WorkOSWebhookPayload = z.infer<typeof workOSWebhookPayloadSchema>

// MARK: Canonical Trigger Events

export const webhookTriggerTypeSchema = z.literal("webhook")
export type WebhookTriggerType = z.infer<typeof webhookTriggerTypeSchema>

export const cronTriggerTypeSchema = z.literal("cron")
export type CronTriggerType = z.infer<typeof cronTriggerTypeSchema>

export const webMonitorTriggerTypeSchema = z.literal("web_event")
export type WebMonitorTriggerType = z.infer<typeof webMonitorTriggerTypeSchema>

export const manualSampleTriggerTypeSchema = z.literal("manual_sample")
export type ManualSampleTriggerType = z.infer<typeof manualSampleTriggerTypeSchema>

export const TriggerTypeSchema = z.union([
    slackEventTypeSchema,
    gitHubEventTypeSchema,
    linearEventTypeSchema,
    gmailEventTypeSchema,
    workOSEventTypeSchema,
    webhookTriggerTypeSchema,
    cronTriggerTypeSchema,
    webMonitorTriggerTypeSchema,
    manualSampleTriggerTypeSchema
])
export type TriggerType = z.infer<typeof TriggerTypeSchema>

export const baseTriggerSchema = z.object({
    integrationType: integrationTypeEnum,
    eventType: TriggerTypeSchema
})
export type BaseTrigger = z.infer<typeof baseTriggerSchema>

export const gmailTriggerSchema = baseTriggerSchema
    .extend({
        integrationType: z.literal(IntegrationType.GMAIL),
        eventType: gmailEventTypeSchema
    })
    .merge(gmailMessagePayloadSchema)
export type GmailTrigger = z.infer<typeof gmailTriggerSchema>

const linearTriggerBaseSchema = z.object({
    integrationType: z.literal(IntegrationType.LINEAR),
    action: LinearWebhookActionSchema,
    actor: LinearWebhookActorSchema,
    createdAt: z.string(),
    url: z.string().optional(),
    organizationId: z.string(),
    webhookTimestamp: z.number(),
    webhookId: z.string()
})

export const linearIssueCreatedTriggerSchema = linearTriggerBaseSchema.extend({
    eventType: z.literal("issue.created"),
    action: z.literal("create"),
    type: z.literal("Issue"),
    data: LinearWebhookDataSchema
})
export type LinearIssueCreatedTrigger = z.infer<typeof linearIssueCreatedTriggerSchema>

export const linearIssueUpdatedTriggerSchema = linearTriggerBaseSchema.extend({
    eventType: z.literal("issue.updated"),
    action: z.literal("update"),
    type: z.literal("Issue"),
    data: LinearWebhookDataSchema
})
export type LinearIssueUpdatedTrigger = z.infer<typeof linearIssueUpdatedTriggerSchema>

export const linearCommentCreatedTriggerSchema = linearTriggerBaseSchema.extend({
    eventType: z.literal("comment.created"),
    action: z.literal("create"),
    type: z.literal("Comment"),
    data: LinearWebhookCommentDataSchema
})
export type LinearCommentCreatedTrigger = z.infer<typeof linearCommentCreatedTriggerSchema>

export const linearTriggerSchema = z.discriminatedUnion("eventType", [linearIssueCreatedTriggerSchema, linearIssueUpdatedTriggerSchema, linearCommentCreatedTriggerSchema])
export type LinearTrigger = z.infer<typeof linearTriggerSchema>

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

const workOSTriggerBaseSchema = baseTriggerSchema.extend({
    integrationType: z.literal(IntegrationType.WORKOS),
    eventType: workOSEventTypeSchema,
    eventId: z.string(),
    createdAt: z.string()
})

export const workOSUserCreatedTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.USER_CREATED),
    user: workOSTriggerUserSchema
})
export type WorkOSUserCreatedTrigger = z.infer<typeof workOSUserCreatedTriggerSchema>

export const workOSUserUpdatedTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.USER_UPDATED),
    user: workOSTriggerUserSchema
})
export type WorkOSUserUpdatedTrigger = z.infer<typeof workOSUserUpdatedTriggerSchema>

export const workOSUserDeletedTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.USER_DELETED),
    user: workOSTriggerUserSchema
})
export type WorkOSUserDeletedTrigger = z.infer<typeof workOSUserDeletedTriggerSchema>

export const workOSUserTriggerSchema = z.discriminatedUnion("eventType", [workOSUserCreatedTriggerSchema, workOSUserUpdatedTriggerSchema, workOSUserDeletedTriggerSchema])
export type WorkOSUserTrigger = z.infer<typeof workOSUserTriggerSchema>

export const workOSOrganizationMembershipCreatedTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.ORGANIZATION_MEMBERSHIP_CREATED),
    membership: workOSTriggerMembershipSchema
})
export type WorkOSOrganizationMembershipCreatedTrigger = z.infer<typeof workOSOrganizationMembershipCreatedTriggerSchema>

export const workOSOrganizationMembershipUpdatedTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.ORGANIZATION_MEMBERSHIP_UPDATED),
    membership: workOSTriggerMembershipSchema
})
export type WorkOSOrganizationMembershipUpdatedTrigger = z.infer<typeof workOSOrganizationMembershipUpdatedTriggerSchema>

export const workOSOrganizationMembershipDeletedTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.ORGANIZATION_MEMBERSHIP_DELETED),
    membership: workOSTriggerMembershipSchema
})
export type WorkOSOrganizationMembershipDeletedTrigger = z.infer<typeof workOSOrganizationMembershipDeletedTriggerSchema>

export const workOSMembershipTriggerSchema = z.discriminatedUnion("eventType", [
    workOSOrganizationMembershipCreatedTriggerSchema,
    workOSOrganizationMembershipUpdatedTriggerSchema,
    workOSOrganizationMembershipDeletedTriggerSchema
])
export type WorkOSMembershipTrigger = z.infer<typeof workOSMembershipTriggerSchema>

export const workOSInvitationCreatedTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.INVITATION_CREATED),
    invitation: workOSTriggerInvitationSchema,
    user: workOSTriggerUserSchema.optional()
})
export type WorkOSInvitationCreatedTrigger = z.infer<typeof workOSInvitationCreatedTriggerSchema>

export const workOSInvitationAcceptedTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.INVITATION_ACCEPTED),
    invitation: workOSTriggerInvitationSchema,
    user: workOSTriggerUserSchema.optional()
})
export type WorkOSInvitationAcceptedTrigger = z.infer<typeof workOSInvitationAcceptedTriggerSchema>

export const workOSInvitationResentTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.INVITATION_RESENT),
    invitation: workOSTriggerInvitationSchema,
    user: workOSTriggerUserSchema.optional()
})
export type WorkOSInvitationResentTrigger = z.infer<typeof workOSInvitationResentTriggerSchema>

export const workOSInvitationRevokedTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.INVITATION_REVOKED),
    invitation: workOSTriggerInvitationSchema,
    user: workOSTriggerUserSchema.optional()
})
export type WorkOSInvitationRevokedTrigger = z.infer<typeof workOSInvitationRevokedTriggerSchema>

export const workOSInvitationTriggerSchema = z.discriminatedUnion("eventType", [
    workOSInvitationCreatedTriggerSchema,
    workOSInvitationAcceptedTriggerSchema,
    workOSInvitationResentTriggerSchema,
    workOSInvitationRevokedTriggerSchema
])
export type WorkOSInvitationTrigger = z.infer<typeof workOSInvitationTriggerSchema>

export const workOSOrganizationTriggerSchema = workOSTriggerBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.ORGANIZATION_CREATED),
    organization: workOSTriggerOrganizationSchema
})
export type WorkOSOrganizationTrigger = z.infer<typeof workOSOrganizationTriggerSchema>

export const workOSTriggerSchema = z.discriminatedUnion("eventType", [
    workOSUserCreatedTriggerSchema,
    workOSUserUpdatedTriggerSchema,
    workOSUserDeletedTriggerSchema,
    workOSOrganizationMembershipCreatedTriggerSchema,
    workOSOrganizationMembershipUpdatedTriggerSchema,
    workOSOrganizationMembershipDeletedTriggerSchema,
    workOSInvitationCreatedTriggerSchema,
    workOSInvitationAcceptedTriggerSchema,
    workOSInvitationResentTriggerSchema,
    workOSInvitationRevokedTriggerSchema,
    workOSOrganizationTriggerSchema
])
export type WorkOSTrigger = z.infer<typeof workOSTriggerSchema>

export const webhookTriggerSchema = baseTriggerSchema.extend({
    integrationType: z.literal(IntegrationType.WEBHOOK),
    eventType: webhookTriggerTypeSchema,
    body: z.unknown(),
    headers: z.record(z.string(), z.string()),
    method: z.string()
})
export type WebhookTrigger<TBody = unknown> = Omit<z.infer<typeof webhookTriggerSchema>, "body"> & { body: TBody }

export const cronTriggerSchema = baseTriggerSchema.extend({
    integrationType: z.literal(IntegrationType.CRON_JOB),
    eventType: cronTriggerTypeSchema,
    inputId: z.string(),
    isManualTrigger: z.boolean().optional(),
    manualContext: z.string().optional()
})
export type CronTrigger = z.infer<typeof cronTriggerSchema>

export const ParallelMonitorDetectedWebhookPayloadSchema = z.object({
    type: z.literal("monitor.event.detected"),
    timestamp: z.string(),
    data: z.object({
        event: z.object({
            event_group_id: z.string()
        }),
        metadata: z.record(z.string(), z.string()),
        monitor_id: z.string()
    })
})
export type ParallelMonitorDetectedWebhookPayload = z.infer<typeof ParallelMonitorDetectedWebhookPayloadSchema>

export const ParallelMonitorTextResultSchema = z.object({
    type: z.literal("text"),
    content: z.string()
})
export type ParallelMonitorTextResult = z.infer<typeof ParallelMonitorTextResultSchema>

export const ParallelMonitorJsonResultSchema = z.object({
    type: z.literal("json"),
    content: z.unknown()
})
export type ParallelMonitorJsonResult<TStructured = unknown> = Omit<z.infer<typeof ParallelMonitorJsonResultSchema>, "content"> & {
    content: TStructured
}

export const ParallelMonitorEventSchema = z.object({
    type: z.literal("event"),
    event_group_id: z.string(),
    output: z.string(),
    event_date: z.string(),
    source_urls: z.array(z.string()),
    result: z.discriminatedUnion("type", [ParallelMonitorTextResultSchema, ParallelMonitorJsonResultSchema])
})
export type ParallelMonitorEvent<TStructured = unknown> = Omit<z.infer<typeof ParallelMonitorEventSchema>, "result"> & {
    result: ParallelMonitorTextResult | ParallelMonitorJsonResult<TStructured>
}

export const webMonitorTriggerSchema = baseTriggerSchema.extend({
    integrationType: z.literal(IntegrationType.WEBMONITOR),
    eventType: webMonitorTriggerTypeSchema,
    inputId: z.string(),
    query: z.string(),
    frequency: z.object({
        number: z.number().min(1).max(30).int(),
        unit: frequencyUnitSchema
    }),
    monitorId: z.string(),
    eventGroupId: z.string(),
    metadata: z.record(z.string(), z.string()),
    outputType: z.enum(["text", "json"]),
    rawPayload: z.string().optional(),
    payload: z.unknown(),
    eventDate: z.string(),
    sourceUrls: z.array(z.string())
})
export type WebMonitorTrigger<TPayload = string> = Omit<z.infer<typeof webMonitorTriggerSchema>, "payload"> & {
    payload: TPayload
}

export const manualSampleTriggerSchema = baseTriggerSchema.extend({
    eventType: manualSampleTriggerTypeSchema
})
export type ManualSampleTrigger = z.infer<typeof manualSampleTriggerSchema>

export const TriggerSchema = z.union([
    slackTriggerSchema,
    GithubTriggerSchema,
    gmailTriggerSchema,
    linearTriggerSchema,
    workOSTriggerSchema,
    webhookTriggerSchema,
    cronTriggerSchema,
    webMonitorTriggerSchema,
    manualSampleTriggerSchema
])
export type Trigger = z.infer<typeof TriggerSchema>

export function createManualTrigger(
    params: {
        integrationType?: IntegrationType
    } = {}
): Trigger {
    return TriggerSchema.parse({
        integrationType: params.integrationType ?? IntegrationType.TERSE,
        eventType: "manual_sample"
    })
}

export function formatTriggerForAgent(event: Trigger): string {
    return formatTriggerForAgentWithPresenter(event)
}

export function debugTrigger(event: Trigger): string {
    return debugTriggerWithPresenter(event)
}

export const TriggerArraySchema = z.array(TriggerSchema)

export const serializedEventSchema = z.object({
    integrationType: integrationTypeEnum,
    eventType: TriggerTypeSchema,
    formattedContent: z.string(),
    debugLog: z.string(),
    data: TriggerSchema
})
export type SerializedEvent = z.infer<typeof serializedEventSchema>
