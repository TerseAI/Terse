import { z } from "zod"

import {
    AttioEventType,
    GitHubEventType,
    HeyReachEventType,
    WorkOSEventType,
    attioEventTypeSchema,
    frequencyUnitSchema,
    gitHubEventTypeSchema,
    gmailEventTypeSchema,
    heyReachEventTypeSchema,
    linearEventTypeSchema,
    slackEventTypeSchema,
    workOSEventTypeSchema
} from "./Configs"
import { IntegrationType, integrationTypeEnum } from "./Integrations"
import { SlackAttachments, SlackBlocks, SlackChannelType, SlackFiles } from "./SlackTypes"
import { defineTrigger, defineTriggerUnion } from "./TriggerDefinition"
import type { ConcreteTriggerDefinition, TriggerDefinition, TriggerPresenter, TriggerPrintHints } from "./TriggerDefinition"
import {
    debugAttioTrigger,
    debugCronTrigger,
    debugGithubTrigger,
    debugGmailTrigger,
    debugHeyReachTrigger,
    debugLinearTrigger,
    debugManualSampleTrigger,
    debugSlackTrigger,
    debugWebMonitorTrigger,
    debugWebhookTrigger,
    debugWorkOSTrigger,
    displayManualSampleTrigger,
    formatAttioDisplay,
    formatAttioTrigger,
    formatCronDisplay,
    formatCronTrigger,
    formatGithubDisplay,
    formatGithubTrigger,
    formatGmailDisplay,
    formatGmailTrigger,
    formatHeyReachDisplay,
    formatHeyReachTrigger,
    formatLinearDisplay,
    formatLinearTrigger,
    formatManualSampleTrigger,
    formatSlackDisplay,
    formatSlackTrigger,
    formatWebMonitorDisplay,
    formatWebMonitorTrigger,
    formatWebhookDisplay,
    formatWebhookTrigger,
    formatWorkOSDisplay,
    formatWorkOSTrigger
} from "./TriggerPresenters"

const providerTriggerTypeSchema = z.union([
    slackEventTypeSchema,
    gitHubEventTypeSchema,
    linearEventTypeSchema,
    gmailEventTypeSchema,
    workOSEventTypeSchema,
    heyReachEventTypeSchema,
    attioEventTypeSchema
])

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
export type GithubPROpenedTrigger = z.infer<typeof GithubPROpenedTriggerSchema>

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

export const issueCommentTargetSchema = z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    body: z.string().optional(),
    state: z.enum(["open", "closed"]),
    url: z.string(),
    author: pullRequestUserSchema,
    isPullRequest: z.boolean()
})

export const issueCommentSchema = z.object({
    id: z.number(),
    body: z.string(),
    author: pullRequestUserSchema,
    url: z.string(),
    createdAt: z.string(),
    updatedAt: z.string()
})

export const GithubIssueCommentCreatedTriggerSchema = GithubTriggerBaseSchema.extend({
    eventType: z.literal(GitHubEventType.ISSUE_COMMENT_CREATED),
    issue: issueCommentTargetSchema,
    comment: issueCommentSchema
})
export type GithubIssueCommentCreatedTrigger = z.infer<typeof GithubIssueCommentCreatedTriggerSchema>

const pullRequestCommentTargetSchema = issueCommentTargetSchema.extend({ isPullRequest: z.literal(true) })

export const GithubPRCommentCreatedTriggerSchema = GithubTriggerBaseSchema.extend({
    eventType: z.literal(GitHubEventType.ISSUE_COMMENT_CREATED),
    issue: pullRequestCommentTargetSchema,
    comment: issueCommentSchema
})
export type GithubPRCommentCreatedTrigger = z.infer<typeof GithubPRCommentCreatedTriggerSchema>

export const GithubPRCommentEditedTriggerSchema = GithubTriggerBaseSchema.extend({
    eventType: z.literal(GitHubEventType.PR_COMMENT_EDITED),
    issue: pullRequestCommentTargetSchema,
    comment: issueCommentSchema
})
export type GithubPRCommentEditedTrigger = z.infer<typeof GithubPRCommentEditedTriggerSchema>

export const GithubPRCommentTriggerSchema = z.union([GithubPRCommentCreatedTriggerSchema, GithubPRCommentEditedTriggerSchema])
export type GithubPRCommentTrigger = z.infer<typeof GithubPRCommentTriggerSchema>

export const GithubPRTriggerSchema = z.discriminatedUnion("eventType", [GithubPROpenedTriggerSchema, GithubPRSynchronizedTriggerSchema, GithubPRClosedTriggerSchema, GithubPRMergedTriggerSchema])
export type GithubPRTrigger = z.infer<typeof GithubPRTriggerSchema>

export const GithubTriggerSchema = z.discriminatedUnion("eventType", [GithubPushTriggerSchema, GithubPRTriggerSchema, GithubIssueCommentCreatedTriggerSchema, GithubPRCommentEditedTriggerSchema])
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

export const LinearWebhookDataSchema = z
    .object({
        id: z.string(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        number: z.number().optional(),
        title: z.string().optional(),
        priority: z.number().optional(),
        sortOrder: z.number().optional(),
        prioritySortOrder: z.number().optional(),
        slaType: z.string().optional(),
        addedToTeamAt: z.string().optional(),
        trashed: z.boolean().nullable().optional(),
        labelIds: z.array(z.string()).optional(),
        teamId: z.string().optional(),
        previousIdentifiers: z.array(z.string()).optional(),
        stateId: z.string().optional(),
        reactionData: z.array(z.any()).optional(),
        priorityLabel: z.string().optional(),
        botActor: z.string().nullable().optional(),
        identifier: z.string().optional(),
        url: z.string().optional(),
        subscriberIds: z.array(z.string()).optional(),
        state: LinearWebhookStateSchema.optional(),
        team: LinearWebhookTeamSchema.optional(),
        labels: z.array(z.any()).optional(),
        description: z.string().optional(),
        descriptionData: z.string().optional(),
        assignee: LinearWebhookAssigneeSchema.optional(),
        projectId: z.string().optional()
    })
    .passthrough()

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

export const webMonitorTriggerTypeSchema = z.literal("webmonitor")
export type WebMonitorTriggerType = z.infer<typeof webMonitorTriggerTypeSchema>

export const manualSampleTriggerTypeSchema = z.literal("manual_sample")
export type ManualSampleTriggerType = z.infer<typeof manualSampleTriggerTypeSchema>

export const TriggerTypeSchema = z.union([
    slackEventTypeSchema,
    gitHubEventTypeSchema,
    linearEventTypeSchema,
    gmailEventTypeSchema,
    workOSEventTypeSchema,
    heyReachEventTypeSchema,
    attioEventTypeSchema,
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

export const workOSTriggerSchema = z.discriminatedUnion("eventType", [workOSUserTriggerSchema, workOSMembershipTriggerSchema, workOSInvitationTriggerSchema, workOSOrganizationTriggerSchema])
export type WorkOSTrigger = z.infer<typeof workOSTriggerSchema>

// MARK: HeyReach Triggers

export const heyReachLeadSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    profile_url: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    full_name: z.string().optional(),
    location: z.string().optional(),
    summary: z.string().optional(),
    company_url: z.string().optional(),
    company_name: z.string().optional(),
    position: z.string().optional(),
    about: z.string().optional(),
    email_address: z.string().optional(),
    enriched_email: z.string().nullable().optional(),
    custom_email: z.string().nullable().optional(),
    tags: z.array(z.unknown()).optional(),
    lists: z.array(z.unknown()).optional()
})
export type HeyReachLead = z.infer<typeof heyReachLeadSchema>

export const heyReachCampaignSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    status: z.union([z.string(), z.null()]).optional()
})
export type HeyReachCampaign = z.infer<typeof heyReachCampaignSchema>

/** Sender / LinkedIn account as HeyReach sends it on webhooks (snake_case). */
export const heyReachLinkedInAccountSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    full_name: z.string().optional(),
    email_address: z.string().optional(),
    profile_url: z.string().optional()
})
export type HeyReachLinkedInAccount = z.infer<typeof heyReachLinkedInAccountSchema>

export const heyReachWebhookPayloadSchema = z.object({
    event_type: z.string(),
    correlation_id: z.string().optional(),
    timestamp: z.string().optional(),
    connection_message: z.string().optional(),
    campaign: heyReachCampaignSchema.optional(),
    sender: heyReachLinkedInAccountSchema.optional(),
    lead: heyReachLeadSchema.optional(),
    message_body: z.string().optional(),
    post_url: z.string().optional(),
    tags: z.array(z.unknown()).optional()
})
export type HeyReachWebhookPayload = z.infer<typeof heyReachWebhookPayloadSchema>

const heyReachTriggerBaseSchema = baseTriggerSchema.extend({
    integrationType: z.literal(IntegrationType.HEY_REACH),
    eventType: heyReachEventTypeSchema,
    eventId: z.string(),
    createdAt: z.string(),
    lead: heyReachLeadSchema.optional(),
    campaign: heyReachCampaignSchema.optional(),
    linkedInAccount: heyReachLinkedInAccountSchema.optional(),
    rawPayload: z.record(z.string(), z.unknown())
})

export const heyReachConnectionRequestSentTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.CONNECTION_REQUEST_SENT)
})
export type HeyReachConnectionRequestSentTrigger = z.infer<typeof heyReachConnectionRequestSentTriggerSchema>

export const heyReachConnectionRequestAcceptedTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.CONNECTION_REQUEST_ACCEPTED)
})
export type HeyReachConnectionRequestAcceptedTrigger = z.infer<typeof heyReachConnectionRequestAcceptedTriggerSchema>

export const heyReachMessageSentTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.MESSAGE_SENT),
    messageBody: z.string().optional()
})
export type HeyReachMessageSentTrigger = z.infer<typeof heyReachMessageSentTriggerSchema>

export const heyReachMessageReplyReceivedTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.MESSAGE_REPLY_RECEIVED),
    messageBody: z.string().optional()
})
export type HeyReachMessageReplyReceivedTrigger = z.infer<typeof heyReachMessageReplyReceivedTriggerSchema>

export const heyReachInmailSentTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.INMAIL_SENT),
    messageBody: z.string().optional()
})
export type HeyReachInmailSentTrigger = z.infer<typeof heyReachInmailSentTriggerSchema>

export const heyReachInmailReplyReceivedTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.INMAIL_REPLY_RECEIVED),
    messageBody: z.string().optional()
})
export type HeyReachInmailReplyReceivedTrigger = z.infer<typeof heyReachInmailReplyReceivedTriggerSchema>

export const heyReachFollowSentTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.FOLLOW_SENT)
})
export type HeyReachFollowSentTrigger = z.infer<typeof heyReachFollowSentTriggerSchema>

export const heyReachLikedPostTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.LIKED_POST),
    postUrl: z.string().optional()
})
export type HeyReachLikedPostTrigger = z.infer<typeof heyReachLikedPostTriggerSchema>

export const heyReachViewedProfileTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.VIEWED_PROFILE)
})
export type HeyReachViewedProfileTrigger = z.infer<typeof heyReachViewedProfileTriggerSchema>

export const heyReachCampaignCompletedTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.CAMPAIGN_COMPLETED)
})
export type HeyReachCampaignCompletedTrigger = z.infer<typeof heyReachCampaignCompletedTriggerSchema>

export const heyReachLeadTagUpdatedTriggerSchema = heyReachTriggerBaseSchema.extend({
    eventType: z.literal(HeyReachEventType.LEAD_TAG_UPDATED),
    tags: z.array(z.string()).optional()
})
export type HeyReachLeadTagUpdatedTrigger = z.infer<typeof heyReachLeadTagUpdatedTriggerSchema>

export const heyReachTriggerSchema = z.discriminatedUnion("eventType", [
    heyReachConnectionRequestSentTriggerSchema,
    heyReachConnectionRequestAcceptedTriggerSchema,
    heyReachMessageSentTriggerSchema,
    heyReachMessageReplyReceivedTriggerSchema,
    heyReachInmailSentTriggerSchema,
    heyReachInmailReplyReceivedTriggerSchema,
    heyReachFollowSentTriggerSchema,
    heyReachLikedPostTriggerSchema,
    heyReachViewedProfileTriggerSchema,
    heyReachCampaignCompletedTriggerSchema,
    heyReachLeadTagUpdatedTriggerSchema
])
export type HeyReachTrigger = z.infer<typeof heyReachTriggerSchema>

// MARK: Attio Triggers

export const AttioActorType = {
    API_TOKEN: "api-token",
    WORKSPACE_MEMBER: "workspace-member",
    SYSTEM: "system",
    APP: "app"
} as const
export const attioActorTypeSchema = z.enum(AttioActorType)
export type AttioActorType = z.infer<typeof attioActorTypeSchema>

export const attioWebhookActorSchema = z.object({
    type: attioActorTypeSchema.nullable(),
    id: z.string().nullable()
})
export type AttioWebhookActor = z.infer<typeof attioWebhookActorSchema>

export const attioWebhookEventIdSchema = z.object({
    workspace_id: z.string(),
    object_id: z.string().optional(),
    record_id: z.string().optional(),
    list_id: z.string().optional(),
    entry_id: z.string().optional(),
    note_id: z.string().optional(),
    task_id: z.string().optional(),
    comment_id: z.string().optional(),
    attribute_id: z.string().optional(),
    call_recording_id: z.string().optional(),
    meeting_id: z.string().optional(),
    workspace_member_id: z.string().optional()
})
export type AttioWebhookEventId = z.infer<typeof attioWebhookEventIdSchema>

export const attioWebhookEventSchema = z.object({
    event_type: attioEventTypeSchema,
    id: attioWebhookEventIdSchema,
    actor: attioWebhookActorSchema
})
export type AttioWebhookEvent = z.infer<typeof attioWebhookEventSchema>

export const attioWebhookPayloadSchema = z.object({
    webhook_id: z.string(),
    events: z.array(attioWebhookEventSchema)
})
export type AttioWebhookPayload = z.infer<typeof attioWebhookPayloadSchema>

export const attioRecordPayloadSchema = z.object({
    id: z.object({
        workspace_id: z.string(),
        object_id: z.string(),
        record_id: z.string()
    }),
    values: z.record(z.string(), z.unknown()),
    web_url: z.string().optional(),
    created_at: z.string().optional()
})
export type AttioRecordPayload = z.infer<typeof attioRecordPayloadSchema>

export const attioTriggerBaseSchema = baseTriggerSchema.extend({
    integrationType: z.literal(IntegrationType.ATTIO),
    eventType: attioEventTypeSchema,
    /** Set from the inbound `Idempotency-Key` header; Attio does not include an event id in the body. */
    eventId: z.string(),
    /** Server-side receipt timestamp; Attio does not include a timestamp in the body. */
    createdAt: z.string(),
    workspaceId: z.string(),
    resourceIds: attioWebhookEventIdSchema,
    /** Object slug resolved by the backend when the event targets a record. */
    objectSlug: z.string().nullable().optional(),
    actor: attioWebhookActorSchema,
    rawEvent: z.record(z.string(), z.unknown())
})
export type AttioTriggerBase = z.infer<typeof attioTriggerBaseSchema>

export const attioCallRecordingCreatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.CALL_RECORDING_CREATED) })
export type AttioCallRecordingCreatedTrigger = z.infer<typeof attioCallRecordingCreatedTriggerSchema>
export const attioCommentCreatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.COMMENT_CREATED) })
export type AttioCommentCreatedTrigger = z.infer<typeof attioCommentCreatedTriggerSchema>
export const attioCommentResolvedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.COMMENT_RESOLVED) })
export type AttioCommentResolvedTrigger = z.infer<typeof attioCommentResolvedTriggerSchema>
export const attioCommentUnresolvedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.COMMENT_UNRESOLVED) })
export type AttioCommentUnresolvedTrigger = z.infer<typeof attioCommentUnresolvedTriggerSchema>
export const attioCommentDeletedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.COMMENT_DELETED) })
export type AttioCommentDeletedTrigger = z.infer<typeof attioCommentDeletedTriggerSchema>
export const attioListCreatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.LIST_CREATED) })
export type AttioListCreatedTrigger = z.infer<typeof attioListCreatedTriggerSchema>
export const attioListUpdatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.LIST_UPDATED) })
export type AttioListUpdatedTrigger = z.infer<typeof attioListUpdatedTriggerSchema>
export const attioListDeletedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.LIST_DELETED) })
export type AttioListDeletedTrigger = z.infer<typeof attioListDeletedTriggerSchema>
export const attioListAttributeCreatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.LIST_ATTRIBUTE_CREATED) })
export type AttioListAttributeCreatedTrigger = z.infer<typeof attioListAttributeCreatedTriggerSchema>
export const attioListAttributeUpdatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.LIST_ATTRIBUTE_UPDATED) })
export type AttioListAttributeUpdatedTrigger = z.infer<typeof attioListAttributeUpdatedTriggerSchema>
export const attioListEntryCreatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.LIST_ENTRY_CREATED) })
export type AttioListEntryCreatedTrigger = z.infer<typeof attioListEntryCreatedTriggerSchema>
export const attioListEntryUpdatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.LIST_ENTRY_UPDATED) })
export type AttioListEntryUpdatedTrigger = z.infer<typeof attioListEntryUpdatedTriggerSchema>
export const attioListEntryDeletedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.LIST_ENTRY_DELETED) })
export type AttioListEntryDeletedTrigger = z.infer<typeof attioListEntryDeletedTriggerSchema>
export const attioObjectAttributeCreatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.OBJECT_ATTRIBUTE_CREATED) })
export type AttioObjectAttributeCreatedTrigger = z.infer<typeof attioObjectAttributeCreatedTriggerSchema>
export const attioObjectAttributeUpdatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.OBJECT_ATTRIBUTE_UPDATED) })
export type AttioObjectAttributeUpdatedTrigger = z.infer<typeof attioObjectAttributeUpdatedTriggerSchema>
export const attioNoteCreatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.NOTE_CREATED) })
export type AttioNoteCreatedTrigger = z.infer<typeof attioNoteCreatedTriggerSchema>
export const attioNoteContentUpdatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.NOTE_CONTENT_UPDATED) })
export type AttioNoteContentUpdatedTrigger = z.infer<typeof attioNoteContentUpdatedTriggerSchema>
export const attioNoteUpdatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.NOTE_UPDATED) })
export type AttioNoteUpdatedTrigger = z.infer<typeof attioNoteUpdatedTriggerSchema>
export const attioNoteDeletedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.NOTE_DELETED) })
export type AttioNoteDeletedTrigger = z.infer<typeof attioNoteDeletedTriggerSchema>
export const attioRecordCreatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.RECORD_CREATED), record: attioRecordPayloadSchema })
export type AttioRecordCreatedTrigger = z.infer<typeof attioRecordCreatedTriggerSchema>
export const attioRecordMergedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.RECORD_MERGED), record: attioRecordPayloadSchema })
export type AttioRecordMergedTrigger = z.infer<typeof attioRecordMergedTriggerSchema>
export const attioRecordUpdatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.RECORD_UPDATED), record: attioRecordPayloadSchema })
export type AttioRecordUpdatedTrigger = z.infer<typeof attioRecordUpdatedTriggerSchema>
export const attioRecordDeletedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.RECORD_DELETED) })
export type AttioRecordDeletedTrigger = z.infer<typeof attioRecordDeletedTriggerSchema>
export const attioTaskCreatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.TASK_CREATED) })
export type AttioTaskCreatedTrigger = z.infer<typeof attioTaskCreatedTriggerSchema>
export const attioTaskUpdatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.TASK_UPDATED) })
export type AttioTaskUpdatedTrigger = z.infer<typeof attioTaskUpdatedTriggerSchema>
export const attioTaskDeletedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.TASK_DELETED) })
export type AttioTaskDeletedTrigger = z.infer<typeof attioTaskDeletedTriggerSchema>
export const attioWorkspaceMemberCreatedTriggerSchema = attioTriggerBaseSchema.extend({ eventType: z.literal(AttioEventType.WORKSPACE_MEMBER_CREATED) })
export type AttioWorkspaceMemberCreatedTrigger = z.infer<typeof attioWorkspaceMemberCreatedTriggerSchema>

export const attioTriggerSchema = z.discriminatedUnion("eventType", [
    attioCallRecordingCreatedTriggerSchema,
    attioCommentCreatedTriggerSchema,
    attioCommentResolvedTriggerSchema,
    attioCommentUnresolvedTriggerSchema,
    attioCommentDeletedTriggerSchema,
    attioListCreatedTriggerSchema,
    attioListUpdatedTriggerSchema,
    attioListDeletedTriggerSchema,
    attioListAttributeCreatedTriggerSchema,
    attioListAttributeUpdatedTriggerSchema,
    attioListEntryCreatedTriggerSchema,
    attioListEntryUpdatedTriggerSchema,
    attioListEntryDeletedTriggerSchema,
    attioObjectAttributeCreatedTriggerSchema,
    attioObjectAttributeUpdatedTriggerSchema,
    attioNoteCreatedTriggerSchema,
    attioNoteContentUpdatedTriggerSchema,
    attioNoteUpdatedTriggerSchema,
    attioNoteDeletedTriggerSchema,
    attioRecordCreatedTriggerSchema,
    attioRecordMergedTriggerSchema,
    attioRecordUpdatedTriggerSchema,
    attioRecordDeletedTriggerSchema,
    attioTaskCreatedTriggerSchema,
    attioTaskUpdatedTriggerSchema,
    attioTaskDeletedTriggerSchema,
    attioWorkspaceMemberCreatedTriggerSchema
])
export type AttioTrigger = z.infer<typeof attioTriggerSchema>

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
    heyReachTriggerSchema,
    attioTriggerSchema,
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
    if (event.eventType === "manual_sample") {
        return formatManualSampleTrigger(event)
    }
    return resolveTriggerPresenter(event).formatForAgent(event)
}

export function debugTrigger(event: Trigger): string {
    if (event.eventType === "manual_sample") {
        return debugManualSampleTrigger(event)
    }
    return resolveTriggerPresenter(event).debug(event)
}

export function displayTrigger(event: Trigger): SerializedEventDisplay {
    if (event.eventType === "manual_sample") {
        return displayManualSampleTrigger(event)
    }
    return resolveTriggerPresenter(event).display(event)
}

export const TriggerArraySchema = z.array(TriggerSchema)

export const serializedEventDisplaySchema = z.object({
    title: z.string(),
    subtitle: z.string()
})
export type SerializedEventDisplay = z.infer<typeof serializedEventDisplaySchema>

export const serializedEventSchema = z.object({
    integrationType: integrationTypeEnum,
    eventType: TriggerTypeSchema,
    formattedContent: z.string(),
    debugLog: z.string(),
    triggeredAt: z.iso.datetime({ offset: true }).default(() => new Date().toISOString()),
    display: serializedEventDisplaySchema.optional(),
    data: TriggerSchema
})
export type SerializedEvent = z.infer<typeof serializedEventSchema>

export const eventFixtureOverridesSchema = z.object({
    formattedContent: z.string().optional(),
    debugLog: z.string().optional(),
    triggeredAt: z.iso.datetime({ offset: true }).optional()
})
export const eventFixtureSchema = z.intersection(TriggerSchema, eventFixtureOverridesSchema)
export type EventFixture = z.infer<typeof eventFixtureSchema>

export function hydrateSerializedEvent(fixture: EventFixture): SerializedEvent {
    // re-parse through TriggerSchema so override keys are stripped from data
    const trigger = TriggerSchema.parse(fixture)
    return {
        integrationType: trigger.integrationType,
        eventType: trigger.eventType,
        formattedContent: fixture.formattedContent ?? formatTriggerForAgent(trigger),
        debugLog: fixture.debugLog ?? debugTrigger(trigger),
        triggeredAt: fixture.triggeredAt ?? new Date().toISOString(),
        display: displayTrigger(trigger),
        data: trigger
    }
}

export function toEventFixture(event: SerializedEvent): EventFixture {
    return {
        ...event.data,
        formattedContent: event.formattedContent,
        debugLog: event.debugLog,
        triggeredAt: event.triggeredAt
    }
}

const slackPresenter = {
    formatForAgent: formatSlackTrigger,
    debug: debugSlackTrigger,
    display: formatSlackDisplay
}

const githubPresenter = {
    formatForAgent: formatGithubTrigger,
    debug: debugGithubTrigger,
    display: formatGithubDisplay
}

const gmailPresenter = {
    formatForAgent: formatGmailTrigger,
    debug: debugGmailTrigger,
    display: formatGmailDisplay
}

const linearPresenter = {
    formatForAgent: formatLinearTrigger,
    debug: debugLinearTrigger,
    display: formatLinearDisplay
}

const workOSPresenter = {
    formatForAgent: formatWorkOSTrigger,
    debug: debugWorkOSTrigger,
    display: formatWorkOSDisplay
}

const heyReachPresenter = {
    formatForAgent: formatHeyReachTrigger,
    debug: debugHeyReachTrigger,
    display: formatHeyReachDisplay
}

const attioPresenter = {
    formatForAgent: formatAttioTrigger,
    debug: debugAttioTrigger,
    display: formatAttioDisplay
}

const webhookPresenter = {
    formatForAgent: formatWebhookTrigger,
    debug: debugWebhookTrigger,
    display: formatWebhookDisplay
}

const cronPresenter = {
    formatForAgent: formatCronTrigger,
    debug: debugCronTrigger,
    display: formatCronDisplay
}

const webMonitorPresenter = {
    formatForAgent: formatWebMonitorTrigger,
    debug: debugWebMonitorTrigger,
    display: formatWebMonitorDisplay
}

const slackMessagePrintHints: TriggerPrintHints = {
    fieldOverrides: {
        blocks: "SlackBlocks | null",
        attachments: "SlackAttachments | null",
        files: "SlackFiles | null"
    },
    imports: ["SlackBlocks", "SlackAttachments", "SlackFiles"]
}

const attioRecordPrintHints: TriggerPrintHints = {
    typeParams: "<TValues = Record<string, unknown>>",
    aliasArgs: "<TValues>",
    fieldOverrides: { "record.values": "TValues" }
}

// The public trigger type surface: map key is the exported type name.
// Union definitions whose members are all registered here print as unions of those names.
export const TriggerDefinitions = {
    SlackMessageTrigger: defineTrigger({
        integration: IntegrationType.SLACK,
        schema: slackMessageTriggerSchema,
        eventTypes: ["message"],
        printHints: slackMessagePrintHints,
        presenter: slackPresenter
    }),
    SlackAppMentionTrigger: defineTrigger({
        integration: IntegrationType.SLACK,
        schema: slackAppMentionTriggerSchema,
        eventTypes: ["app_mention"],
        printHints: slackMessagePrintHints,
        presenter: slackPresenter
    }),
    SlackReactionAddedTrigger: defineTrigger({
        integration: IntegrationType.SLACK,
        schema: slackReactionAddedTriggerSchema,
        eventTypes: ["reaction_added"],
        printHints: slackMessagePrintHints,
        presenter: slackPresenter
    }),
    SlackTrigger: defineTriggerUnion({
        integration: IntegrationType.SLACK,
        members: ["SlackMessageTrigger", "SlackAppMentionTrigger", "SlackReactionAddedTrigger"],
        presenter: slackPresenter
    }),
    GithubPushTrigger: defineTrigger({
        integration: IntegrationType.GITHUB,
        schema: GithubPushTriggerSchema,
        eventTypes: [GitHubEventType.PUSH],
        presenter: githubPresenter
    }),
    GithubPROpenedTrigger: defineTrigger({
        integration: IntegrationType.GITHUB,
        schema: GithubPROpenedTriggerSchema,
        eventTypes: [GitHubEventType.PR_OPENED],
        presenter: githubPresenter
    }),
    GithubPRSynchronizedTrigger: defineTrigger({
        integration: IntegrationType.GITHUB,
        schema: GithubPRSynchronizedTriggerSchema,
        eventTypes: [GitHubEventType.PR_SYNCHRONIZE],
        presenter: githubPresenter
    }),
    GithubPRClosedTrigger: defineTrigger({
        integration: IntegrationType.GITHUB,
        schema: GithubPRClosedTriggerSchema,
        eventTypes: [GitHubEventType.PR_CLOSED],
        presenter: githubPresenter
    }),
    GithubPRMergedTrigger: defineTrigger({
        integration: IntegrationType.GITHUB,
        schema: GithubPRMergedTriggerSchema,
        eventTypes: [GitHubEventType.PR_MERGED],
        presenter: githubPresenter
    }),
    GithubIssueCommentCreatedTrigger: defineTrigger({
        integration: IntegrationType.GITHUB,
        schema: GithubIssueCommentCreatedTriggerSchema,
        eventTypes: [GitHubEventType.ISSUE_COMMENT_CREATED],
        presenter: githubPresenter
    }),
    GithubPRCommentCreatedTrigger: defineTrigger({
        integration: IntegrationType.GITHUB,
        schema: GithubPRCommentCreatedTriggerSchema,
        eventTypes: [GitHubEventType.PR_COMMENT_CREATED],
        presenter: githubPresenter
    }),
    GithubPRCommentEditedTrigger: defineTrigger({
        integration: IntegrationType.GITHUB,
        schema: GithubPRCommentEditedTriggerSchema,
        eventTypes: [GitHubEventType.PR_COMMENT_EDITED],
        presenter: githubPresenter
    }),
    GithubPRCommentTrigger: defineTriggerUnion({
        integration: IntegrationType.GITHUB,
        members: ["GithubPRCommentCreatedTrigger", "GithubPRCommentEditedTrigger"]
    }),
    GithubPRTrigger: defineTriggerUnion({
        integration: IntegrationType.GITHUB,
        members: ["GithubPROpenedTrigger", "GithubPRSynchronizedTrigger", "GithubPRClosedTrigger", "GithubPRMergedTrigger"]
    }),
    GithubTrigger: defineTriggerUnion({
        integration: IntegrationType.GITHUB,
        members: ["GithubPushTrigger", "GithubPRTrigger", "GithubIssueCommentCreatedTrigger", "GithubPRCommentEditedTrigger"],
        presenter: githubPresenter
    }),
    GmailTrigger: defineTrigger({
        integration: IntegrationType.GMAIL,
        schema: gmailTriggerSchema,
        eventTypes: ["email.received"],
        presenter: gmailPresenter
    }),
    LinearIssueCreatedTrigger: defineTrigger({
        integration: IntegrationType.LINEAR,
        schema: linearIssueCreatedTriggerSchema,
        eventTypes: ["issue.created"],
        presenter: linearPresenter
    }),
    LinearIssueUpdatedTrigger: defineTrigger({
        integration: IntegrationType.LINEAR,
        schema: linearIssueUpdatedTriggerSchema,
        eventTypes: ["issue.updated"],
        presenter: linearPresenter
    }),
    LinearCommentCreatedTrigger: defineTrigger({
        integration: IntegrationType.LINEAR,
        schema: linearCommentCreatedTriggerSchema,
        eventTypes: ["comment.created"],
        presenter: linearPresenter
    }),
    LinearTrigger: defineTriggerUnion({
        integration: IntegrationType.LINEAR,
        members: ["LinearIssueCreatedTrigger", "LinearIssueUpdatedTrigger", "LinearCommentCreatedTrigger"],
        presenter: linearPresenter
    }),
    WorkOSUserCreatedTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSUserCreatedTriggerSchema,
        eventTypes: [WorkOSEventType.USER_CREATED],
        presenter: workOSPresenter
    }),
    WorkOSUserUpdatedTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSUserUpdatedTriggerSchema,
        eventTypes: [WorkOSEventType.USER_UPDATED],
        presenter: workOSPresenter
    }),
    WorkOSUserDeletedTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSUserDeletedTriggerSchema,
        eventTypes: [WorkOSEventType.USER_DELETED],
        presenter: workOSPresenter
    }),
    WorkOSUserTrigger: defineTriggerUnion({
        integration: IntegrationType.WORKOS,
        members: ["WorkOSUserCreatedTrigger", "WorkOSUserUpdatedTrigger", "WorkOSUserDeletedTrigger"]
    }),
    WorkOSOrganizationMembershipCreatedTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSOrganizationMembershipCreatedTriggerSchema,
        eventTypes: [WorkOSEventType.ORGANIZATION_MEMBERSHIP_CREATED],
        presenter: workOSPresenter
    }),
    WorkOSOrganizationMembershipUpdatedTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSOrganizationMembershipUpdatedTriggerSchema,
        eventTypes: [WorkOSEventType.ORGANIZATION_MEMBERSHIP_UPDATED],
        presenter: workOSPresenter
    }),
    WorkOSOrganizationMembershipDeletedTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSOrganizationMembershipDeletedTriggerSchema,
        eventTypes: [WorkOSEventType.ORGANIZATION_MEMBERSHIP_DELETED],
        presenter: workOSPresenter
    }),
    WorkOSMembershipTrigger: defineTriggerUnion({
        integration: IntegrationType.WORKOS,
        members: ["WorkOSOrganizationMembershipCreatedTrigger", "WorkOSOrganizationMembershipUpdatedTrigger", "WorkOSOrganizationMembershipDeletedTrigger"]
    }),
    WorkOSInvitationCreatedTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSInvitationCreatedTriggerSchema,
        eventTypes: [WorkOSEventType.INVITATION_CREATED],
        presenter: workOSPresenter
    }),
    WorkOSInvitationAcceptedTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSInvitationAcceptedTriggerSchema,
        eventTypes: [WorkOSEventType.INVITATION_ACCEPTED],
        presenter: workOSPresenter
    }),
    WorkOSInvitationResentTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSInvitationResentTriggerSchema,
        eventTypes: [WorkOSEventType.INVITATION_RESENT],
        presenter: workOSPresenter
    }),
    WorkOSInvitationRevokedTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSInvitationRevokedTriggerSchema,
        eventTypes: [WorkOSEventType.INVITATION_REVOKED],
        presenter: workOSPresenter
    }),
    WorkOSInvitationTrigger: defineTriggerUnion({
        integration: IntegrationType.WORKOS,
        members: ["WorkOSInvitationCreatedTrigger", "WorkOSInvitationAcceptedTrigger", "WorkOSInvitationResentTrigger", "WorkOSInvitationRevokedTrigger"]
    }),
    WorkOSOrganizationTrigger: defineTrigger({
        integration: IntegrationType.WORKOS,
        schema: workOSOrganizationTriggerSchema,
        eventTypes: [WorkOSEventType.ORGANIZATION_CREATED],
        presenter: workOSPresenter
    }),
    WorkOSTrigger: defineTriggerUnion({
        integration: IntegrationType.WORKOS,
        members: ["WorkOSUserTrigger", "WorkOSMembershipTrigger", "WorkOSInvitationTrigger", "WorkOSOrganizationTrigger"],
        presenter: workOSPresenter
    }),
    HeyReachConnectionRequestSentTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachConnectionRequestSentTriggerSchema,
        eventTypes: [HeyReachEventType.CONNECTION_REQUEST_SENT],
        presenter: heyReachPresenter
    }),
    HeyReachConnectionRequestAcceptedTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachConnectionRequestAcceptedTriggerSchema,
        eventTypes: [HeyReachEventType.CONNECTION_REQUEST_ACCEPTED],
        presenter: heyReachPresenter
    }),
    HeyReachMessageSentTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachMessageSentTriggerSchema,
        eventTypes: [HeyReachEventType.MESSAGE_SENT],
        presenter: heyReachPresenter
    }),
    HeyReachMessageReplyReceivedTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachMessageReplyReceivedTriggerSchema,
        eventTypes: [HeyReachEventType.MESSAGE_REPLY_RECEIVED],
        presenter: heyReachPresenter
    }),
    HeyReachInmailSentTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachInmailSentTriggerSchema,
        eventTypes: [HeyReachEventType.INMAIL_SENT],
        presenter: heyReachPresenter
    }),
    HeyReachInmailReplyReceivedTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachInmailReplyReceivedTriggerSchema,
        eventTypes: [HeyReachEventType.INMAIL_REPLY_RECEIVED],
        presenter: heyReachPresenter
    }),
    HeyReachFollowSentTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachFollowSentTriggerSchema,
        eventTypes: [HeyReachEventType.FOLLOW_SENT],
        presenter: heyReachPresenter
    }),
    HeyReachLikedPostTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachLikedPostTriggerSchema,
        eventTypes: [HeyReachEventType.LIKED_POST],
        presenter: heyReachPresenter
    }),
    HeyReachViewedProfileTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachViewedProfileTriggerSchema,
        eventTypes: [HeyReachEventType.VIEWED_PROFILE],
        presenter: heyReachPresenter
    }),
    HeyReachCampaignCompletedTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachCampaignCompletedTriggerSchema,
        eventTypes: [HeyReachEventType.CAMPAIGN_COMPLETED],
        presenter: heyReachPresenter
    }),
    HeyReachLeadTagUpdatedTrigger: defineTrigger({
        integration: IntegrationType.HEY_REACH,
        schema: heyReachLeadTagUpdatedTriggerSchema,
        eventTypes: [HeyReachEventType.LEAD_TAG_UPDATED],
        presenter: heyReachPresenter
    }),
    HeyReachTrigger: defineTriggerUnion({
        integration: IntegrationType.HEY_REACH,
        members: [
            "HeyReachConnectionRequestSentTrigger",
            "HeyReachConnectionRequestAcceptedTrigger",
            "HeyReachMessageSentTrigger",
            "HeyReachMessageReplyReceivedTrigger",
            "HeyReachInmailSentTrigger",
            "HeyReachInmailReplyReceivedTrigger",
            "HeyReachFollowSentTrigger",
            "HeyReachLikedPostTrigger",
            "HeyReachViewedProfileTrigger",
            "HeyReachCampaignCompletedTrigger",
            "HeyReachLeadTagUpdatedTrigger"
        ],
        presenter: heyReachPresenter
    }),
    AttioCallRecordingCreatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioCallRecordingCreatedTriggerSchema,
        eventTypes: [AttioEventType.CALL_RECORDING_CREATED],
        presenter: attioPresenter
    }),
    AttioCommentCreatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioCommentCreatedTriggerSchema,
        eventTypes: [AttioEventType.COMMENT_CREATED],
        presenter: attioPresenter
    }),
    AttioCommentResolvedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioCommentResolvedTriggerSchema,
        eventTypes: [AttioEventType.COMMENT_RESOLVED],
        presenter: attioPresenter
    }),
    AttioCommentUnresolvedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioCommentUnresolvedTriggerSchema,
        eventTypes: [AttioEventType.COMMENT_UNRESOLVED],
        presenter: attioPresenter
    }),
    AttioCommentDeletedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioCommentDeletedTriggerSchema,
        eventTypes: [AttioEventType.COMMENT_DELETED],
        presenter: attioPresenter
    }),
    AttioListCreatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioListCreatedTriggerSchema,
        eventTypes: [AttioEventType.LIST_CREATED],
        presenter: attioPresenter
    }),
    AttioListUpdatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioListUpdatedTriggerSchema,
        eventTypes: [AttioEventType.LIST_UPDATED],
        presenter: attioPresenter
    }),
    AttioListDeletedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioListDeletedTriggerSchema,
        eventTypes: [AttioEventType.LIST_DELETED],
        presenter: attioPresenter
    }),
    AttioListAttributeCreatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioListAttributeCreatedTriggerSchema,
        eventTypes: [AttioEventType.LIST_ATTRIBUTE_CREATED],
        presenter: attioPresenter
    }),
    AttioListAttributeUpdatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioListAttributeUpdatedTriggerSchema,
        eventTypes: [AttioEventType.LIST_ATTRIBUTE_UPDATED],
        presenter: attioPresenter
    }),
    AttioListEntryCreatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioListEntryCreatedTriggerSchema,
        eventTypes: [AttioEventType.LIST_ENTRY_CREATED],
        presenter: attioPresenter
    }),
    AttioListEntryUpdatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioListEntryUpdatedTriggerSchema,
        eventTypes: [AttioEventType.LIST_ENTRY_UPDATED],
        presenter: attioPresenter
    }),
    AttioListEntryDeletedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioListEntryDeletedTriggerSchema,
        eventTypes: [AttioEventType.LIST_ENTRY_DELETED],
        presenter: attioPresenter
    }),
    AttioObjectAttributeCreatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioObjectAttributeCreatedTriggerSchema,
        eventTypes: [AttioEventType.OBJECT_ATTRIBUTE_CREATED],
        presenter: attioPresenter
    }),
    AttioObjectAttributeUpdatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioObjectAttributeUpdatedTriggerSchema,
        eventTypes: [AttioEventType.OBJECT_ATTRIBUTE_UPDATED],
        presenter: attioPresenter
    }),
    AttioNoteCreatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioNoteCreatedTriggerSchema,
        eventTypes: [AttioEventType.NOTE_CREATED],
        presenter: attioPresenter
    }),
    AttioNoteContentUpdatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioNoteContentUpdatedTriggerSchema,
        eventTypes: [AttioEventType.NOTE_CONTENT_UPDATED],
        presenter: attioPresenter
    }),
    AttioNoteUpdatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioNoteUpdatedTriggerSchema,
        eventTypes: [AttioEventType.NOTE_UPDATED],
        presenter: attioPresenter
    }),
    AttioNoteDeletedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioNoteDeletedTriggerSchema,
        eventTypes: [AttioEventType.NOTE_DELETED],
        presenter: attioPresenter
    }),
    AttioRecordCreatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioRecordCreatedTriggerSchema,
        eventTypes: [AttioEventType.RECORD_CREATED],
        printHints: attioRecordPrintHints,
        presenter: attioPresenter
    }),
    AttioRecordMergedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioRecordMergedTriggerSchema,
        eventTypes: [AttioEventType.RECORD_MERGED],
        printHints: attioRecordPrintHints,
        presenter: attioPresenter
    }),
    AttioRecordUpdatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioRecordUpdatedTriggerSchema,
        eventTypes: [AttioEventType.RECORD_UPDATED],
        printHints: attioRecordPrintHints,
        presenter: attioPresenter
    }),
    AttioRecordDeletedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioRecordDeletedTriggerSchema,
        eventTypes: [AttioEventType.RECORD_DELETED],
        presenter: attioPresenter
    }),
    AttioTaskCreatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioTaskCreatedTriggerSchema,
        eventTypes: [AttioEventType.TASK_CREATED],
        presenter: attioPresenter
    }),
    AttioTaskUpdatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioTaskUpdatedTriggerSchema,
        eventTypes: [AttioEventType.TASK_UPDATED],
        presenter: attioPresenter
    }),
    AttioTaskDeletedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioTaskDeletedTriggerSchema,
        eventTypes: [AttioEventType.TASK_DELETED],
        presenter: attioPresenter
    }),
    AttioWorkspaceMemberCreatedTrigger: defineTrigger({
        integration: IntegrationType.ATTIO,
        schema: attioWorkspaceMemberCreatedTriggerSchema,
        eventTypes: [AttioEventType.WORKSPACE_MEMBER_CREATED],
        presenter: attioPresenter
    }),
    AttioTrigger: defineTriggerUnion({
        integration: IntegrationType.ATTIO,
        members: [
            "AttioCallRecordingCreatedTrigger",
            "AttioCommentCreatedTrigger",
            "AttioCommentResolvedTrigger",
            "AttioCommentUnresolvedTrigger",
            "AttioCommentDeletedTrigger",
            "AttioListCreatedTrigger",
            "AttioListUpdatedTrigger",
            "AttioListDeletedTrigger",
            "AttioListAttributeCreatedTrigger",
            "AttioListAttributeUpdatedTrigger",
            "AttioListEntryCreatedTrigger",
            "AttioListEntryUpdatedTrigger",
            "AttioListEntryDeletedTrigger",
            "AttioObjectAttributeCreatedTrigger",
            "AttioObjectAttributeUpdatedTrigger",
            "AttioNoteCreatedTrigger",
            "AttioNoteContentUpdatedTrigger",
            "AttioNoteUpdatedTrigger",
            "AttioNoteDeletedTrigger",
            "AttioRecordCreatedTrigger",
            "AttioRecordMergedTrigger",
            "AttioRecordUpdatedTrigger",
            "AttioRecordDeletedTrigger",
            "AttioTaskCreatedTrigger",
            "AttioTaskUpdatedTrigger",
            "AttioTaskDeletedTrigger",
            "AttioWorkspaceMemberCreatedTrigger"
        ],
        presenter: attioPresenter
    }),
    CronTrigger: defineTrigger({
        integration: IntegrationType.CRON_JOB,
        schema: cronTriggerSchema,
        eventTypes: ["cron"],
        presenter: cronPresenter
    }),
    WebhookTrigger: defineTrigger({
        integration: IntegrationType.WEBHOOK,
        schema: webhookTriggerSchema,
        eventTypes: ["webhook"],
        printHints: {
            typeParams: "<TBody = unknown>",
            aliasArgs: "<TBody>",
            fieldOverrides: { body: "TBody" }
        },
        presenter: webhookPresenter
    }),
    WebMonitorTrigger: defineTrigger({
        integration: IntegrationType.WEBMONITOR,
        schema: webMonitorTriggerSchema,
        eventTypes: ["webmonitor"],
        printHints: {
            typeParams: "<TStructured = unknown>",
            aliasArgs: "<TStructured>",
            fieldOverrides: { payload: "TStructured" }
        },
        presenter: webMonitorPresenter
    })
} satisfies Record<string, TriggerDefinition>

export function isTriggerDefinitionName(name: string): name is TriggerDefinitionName {
    return name in TriggerDefinitions
}

const concreteTriggerDefinitionsByEvent = collectConcreteTriggerDefinitions()
const fallbackTriggerPresentersByIntegration = collectFallbackTriggerPresenters()

function collectConcreteTriggerDefinitions(): Map<string, ConcreteTriggerDefinition> {
    const definitionsByEvent = new Map<string, ConcreteTriggerDefinition>()
    Object.values(TriggerDefinitions).forEach(definition => {
        if (definition.kind !== "concrete") return
        definition.eventTypes.forEach(eventType => {
            const key = triggerEventKey(definition.integration, eventType)
            if (definitionsByEvent.has(key)) {
                throw new DuplicateTriggerDefinitionError(key)
            }
            definitionsByEvent.set(key, definition)
        })
    })
    return definitionsByEvent
}

function collectFallbackTriggerPresenters(): Map<IntegrationType, TriggerPresenter<unknown>> {
    const presentersByIntegration = new Map<IntegrationType, TriggerPresenter<unknown>>()
    Object.values(TriggerDefinitions).forEach(definition => {
        if (definition.kind !== "union" || !definition.presenter) return
        if (presentersByIntegration.has(definition.integration)) {
            throw new DuplicateTriggerDefinitionError(`fallback presenter for ${definition.integration}`)
        }
        presentersByIntegration.set(definition.integration, definition.presenter)
    })
    return presentersByIntegration
}

function resolveTriggerPresenter(event: Trigger): TriggerPresenter<unknown> {
    const definition = concreteTriggerDefinitionsByEvent.get(triggerEventKey(event.integrationType, event.eventType))
    if (definition?.presenter) {
        return definition.presenter
    }
    const fallback = fallbackTriggerPresentersByIntegration.get(event.integrationType)
    if (fallback) {
        return fallback
    }
    throw new TriggerPresenterNotFoundError(event.integrationType, event.eventType)
}

function triggerEventKey(integration: IntegrationType, eventType: string): string {
    return `${integration}:${eventType}`
}

export class DuplicateTriggerDefinitionError extends Error {
    constructor(key: string) {
        super(`Duplicate trigger definition: ${key}`)
        this.name = "DuplicateTriggerDefinitionError"
    }
}

export class TriggerPresenterNotFoundError extends Error {
    constructor(integrationType: string, eventType: string) {
        super(`No trigger presenter registered for ${integrationType}:${eventType}`)
        this.name = "TriggerPresenterNotFoundError"
    }
}

export type TriggerDefinitionName = keyof typeof TriggerDefinitions
