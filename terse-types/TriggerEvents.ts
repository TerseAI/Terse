import { z } from "zod"

import { GitHubEventType, WorkOSEventType, gitHubEventTypeSchema, gmailEventTypeSchema, linearEventTypeSchema, slackEventTypeSchema, workOSEventTypeSchema } from "./Configs"
import { IntegrationType, integrationTypeEnum } from "./Integrations"
import { SlackAttachments, SlackBlocks, SlackChannelType, SlackFiles } from "./SlackTypes"
import { debugTriggerEvent as debugTriggerEventWithPresenter, formatTriggerEventForAgent as formatTriggerEventForAgentWithPresenter } from "./TriggerEventPresenters"

const providerTriggerEventTypeSchema = z.union([slackEventTypeSchema, gitHubEventTypeSchema, linearEventTypeSchema, gmailEventTypeSchema, workOSEventTypeSchema])

const triggerEventHeaderSchema = z.object({
    integrationType: integrationTypeEnum,
    eventType: providerTriggerEventTypeSchema
})

export const slackTriggerEventSchema = triggerEventHeaderSchema.extend({
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
type SlackTriggerEventSchemaShape = z.infer<typeof slackTriggerEventSchema>

export type SlackTriggerEvent = Omit<SlackTriggerEventSchemaShape, "blocks" | "attachments" | "files"> & {
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

const githubTriggerEventBaseSchema = z.object({
    integrationType: z.literal(IntegrationType.GITHUB),
    username: z.string(),
    installationId: z.number(),
    repositoryName: z.string(),
    repository: githubRepositorySchema,
    sender: senderSchema
})

export const githubPushTriggerEventSchema = githubTriggerEventBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PUSH),
    branch: z.string(),
    commits: z.array(commitSchema),
    pullRequest: z.undefined().optional()
})
export type GitHubPushTriggerEvent = z.infer<typeof githubPushTriggerEventSchema>

const githubPullRequestTriggerEventBaseSchema = githubTriggerEventBaseSchema.extend({
    pullRequest: pullRequestSchema,
    branch: z.string().optional(),
    commits: z.array(commitSchema)
})

export const githubPullRequestOpenedTriggerEventSchema = githubPullRequestTriggerEventBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PR_OPENED)
})
export type GitHubPullRequestOpenedTriggerEvent = z.infer<typeof githubPullRequestOpenedTriggerEventSchema>

export const githubPullRequestSynchronizedTriggerEventSchema = githubPullRequestTriggerEventBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PR_SYNCHRONIZE)
})
export type GitHubPullRequestSynchronizedTriggerEvent = z.infer<typeof githubPullRequestSynchronizedTriggerEventSchema>

export const githubPullRequestClosedTriggerEventSchema = githubPullRequestTriggerEventBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PR_CLOSED)
})
export type GitHubPullRequestClosedTriggerEvent = z.infer<typeof githubPullRequestClosedTriggerEventSchema>

export const githubPullRequestMergedTriggerEventSchema = githubPullRequestTriggerEventBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PR_MERGED)
})
export type GitHubPullRequestMergedTriggerEvent = z.infer<typeof githubPullRequestMergedTriggerEventSchema>

export const githubPullRequestTriggerEventSchema = z.discriminatedUnion("eventType", [
    githubPullRequestOpenedTriggerEventSchema,
    githubPullRequestSynchronizedTriggerEventSchema,
    githubPullRequestClosedTriggerEventSchema,
    githubPullRequestMergedTriggerEventSchema
])
export type GitHubPullRequestTriggerEvent = z.infer<typeof githubPullRequestTriggerEventSchema>

export const githubTriggerEventSchema = z.discriminatedUnion("eventType", [
    githubPushTriggerEventSchema,
    githubPullRequestOpenedTriggerEventSchema,
    githubPullRequestSynchronizedTriggerEventSchema,
    githubPullRequestClosedTriggerEventSchema,
    githubPullRequestMergedTriggerEventSchema
])
export type GitHubTriggerEvent = z.infer<typeof githubTriggerEventSchema>

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
    assignee: LinearWebhookAssigneeSchema.optional()
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

export const gmailTriggerEventSchema = baseTriggerEventSchema
    .extend({
        integrationType: z.literal(IntegrationType.GMAIL),
        eventType: gmailEventTypeSchema
    })
    .merge(gmailMessagePayloadSchema)
export type GmailTriggerEvent = z.infer<typeof gmailTriggerEventSchema>

const linearTriggerEventBaseSchema = z.object({
    integrationType: z.literal(IntegrationType.LINEAR),
    action: LinearWebhookActionSchema,
    actor: LinearWebhookActorSchema,
    createdAt: z.string(),
    url: z.string().optional(),
    organizationId: z.string(),
    webhookTimestamp: z.number(),
    webhookId: z.string()
})

export const linearIssueCreatedTriggerEventSchema = linearTriggerEventBaseSchema.extend({
    eventType: z.literal("issue.created"),
    action: z.literal("create"),
    type: z.literal("Issue"),
    data: LinearWebhookDataSchema
})
export type LinearIssueCreatedTriggerEvent = z.infer<typeof linearIssueCreatedTriggerEventSchema>

export const linearIssueUpdatedTriggerEventSchema = linearTriggerEventBaseSchema.extend({
    eventType: z.literal("issue.updated"),
    action: z.literal("update"),
    type: z.literal("Issue"),
    data: LinearWebhookDataSchema
})
export type LinearIssueUpdatedTriggerEvent = z.infer<typeof linearIssueUpdatedTriggerEventSchema>

export const linearCommentCreatedTriggerEventSchema = linearTriggerEventBaseSchema.extend({
    eventType: z.literal("comment.created"),
    action: z.literal("create"),
    type: z.literal("Comment"),
    data: LinearWebhookCommentDataSchema
})
export type LinearCommentCreatedTriggerEvent = z.infer<typeof linearCommentCreatedTriggerEventSchema>

export const linearTriggerEventSchema = z.discriminatedUnion("eventType", [
    linearIssueCreatedTriggerEventSchema,
    linearIssueUpdatedTriggerEventSchema,
    linearCommentCreatedTriggerEventSchema
])
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

const workOSTriggerEventBaseSchema = baseTriggerEventSchema.extend({
    integrationType: z.literal(IntegrationType.WORKOS),
    eventType: workOSEventTypeSchema,
    eventId: z.string(),
    createdAt: z.string()
})

export const workOSUserCreatedTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.USER_CREATED),
    user: workOSTriggerUserSchema
})
export type WorkOSUserCreatedTriggerEvent = z.infer<typeof workOSUserCreatedTriggerEventSchema>

export const workOSUserUpdatedTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.USER_UPDATED),
    user: workOSTriggerUserSchema
})
export type WorkOSUserUpdatedTriggerEvent = z.infer<typeof workOSUserUpdatedTriggerEventSchema>

export const workOSUserDeletedTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.USER_DELETED),
    user: workOSTriggerUserSchema
})
export type WorkOSUserDeletedTriggerEvent = z.infer<typeof workOSUserDeletedTriggerEventSchema>

export const workOSUserTriggerEventSchema = z.discriminatedUnion("eventType", [
    workOSUserCreatedTriggerEventSchema,
    workOSUserUpdatedTriggerEventSchema,
    workOSUserDeletedTriggerEventSchema
])
export type WorkOSUserTriggerEvent = z.infer<typeof workOSUserTriggerEventSchema>

export const workOSOrganizationMembershipCreatedTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.ORGANIZATION_MEMBERSHIP_CREATED),
    membership: workOSTriggerMembershipSchema
})
export type WorkOSOrganizationMembershipCreatedTriggerEvent = z.infer<typeof workOSOrganizationMembershipCreatedTriggerEventSchema>

export const workOSOrganizationMembershipUpdatedTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.ORGANIZATION_MEMBERSHIP_UPDATED),
    membership: workOSTriggerMembershipSchema
})
export type WorkOSOrganizationMembershipUpdatedTriggerEvent = z.infer<typeof workOSOrganizationMembershipUpdatedTriggerEventSchema>

export const workOSOrganizationMembershipDeletedTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.ORGANIZATION_MEMBERSHIP_DELETED),
    membership: workOSTriggerMembershipSchema
})
export type WorkOSOrganizationMembershipDeletedTriggerEvent = z.infer<typeof workOSOrganizationMembershipDeletedTriggerEventSchema>

export const workOSMembershipTriggerEventSchema = z.discriminatedUnion("eventType", [
    workOSOrganizationMembershipCreatedTriggerEventSchema,
    workOSOrganizationMembershipUpdatedTriggerEventSchema,
    workOSOrganizationMembershipDeletedTriggerEventSchema
])
export type WorkOSMembershipTriggerEvent = z.infer<typeof workOSMembershipTriggerEventSchema>

export const workOSInvitationCreatedTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.INVITATION_CREATED),
    invitation: workOSTriggerInvitationSchema,
    user: workOSTriggerUserSchema.optional()
})
export type WorkOSInvitationCreatedTriggerEvent = z.infer<typeof workOSInvitationCreatedTriggerEventSchema>

export const workOSInvitationAcceptedTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.INVITATION_ACCEPTED),
    invitation: workOSTriggerInvitationSchema,
    user: workOSTriggerUserSchema.optional()
})
export type WorkOSInvitationAcceptedTriggerEvent = z.infer<typeof workOSInvitationAcceptedTriggerEventSchema>

export const workOSInvitationResentTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.INVITATION_RESENT),
    invitation: workOSTriggerInvitationSchema,
    user: workOSTriggerUserSchema.optional()
})
export type WorkOSInvitationResentTriggerEvent = z.infer<typeof workOSInvitationResentTriggerEventSchema>

export const workOSInvitationRevokedTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.INVITATION_REVOKED),
    invitation: workOSTriggerInvitationSchema,
    user: workOSTriggerUserSchema.optional()
})
export type WorkOSInvitationRevokedTriggerEvent = z.infer<typeof workOSInvitationRevokedTriggerEventSchema>

export const workOSInvitationTriggerEventSchema = z.discriminatedUnion("eventType", [
    workOSInvitationCreatedTriggerEventSchema,
    workOSInvitationAcceptedTriggerEventSchema,
    workOSInvitationResentTriggerEventSchema,
    workOSInvitationRevokedTriggerEventSchema
])
export type WorkOSInvitationTriggerEvent = z.infer<typeof workOSInvitationTriggerEventSchema>

export const workOSOrganizationTriggerEventSchema = workOSTriggerEventBaseSchema.extend({
    eventType: z.literal(WorkOSEventType.ORGANIZATION_CREATED),
    organization: workOSTriggerOrganizationSchema
})
export type WorkOSOrganizationTriggerEvent = z.infer<typeof workOSOrganizationTriggerEventSchema>

export const workOSTriggerEventSchema = z.discriminatedUnion("eventType", [
    workOSUserCreatedTriggerEventSchema,
    workOSUserUpdatedTriggerEventSchema,
    workOSUserDeletedTriggerEventSchema,
    workOSOrganizationMembershipCreatedTriggerEventSchema,
    workOSOrganizationMembershipUpdatedTriggerEventSchema,
    workOSOrganizationMembershipDeletedTriggerEventSchema,
    workOSInvitationCreatedTriggerEventSchema,
    workOSInvitationAcceptedTriggerEventSchema,
    workOSInvitationResentTriggerEventSchema,
    workOSInvitationRevokedTriggerEventSchema,
    workOSOrganizationTriggerEventSchema
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
    return formatTriggerEventForAgentWithPresenter(event)
}

export function debugTriggerEvent(event: TriggerEvent): string {
    return debugTriggerEventWithPresenter(event)
}

export const triggerEventArraySchema = z.array(triggerEventSchema)
