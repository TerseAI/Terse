import type * as z from "zod"

import {
    GithubIssueCommentCreatedTriggerSchema,
    GithubPRClosedTriggerSchema,
    GithubPRMergedTriggerSchema,
    GithubPROpenedTriggerSchema,
    GithubPRSynchronizedTriggerSchema,
    GithubPushTriggerSchema,
    attioCallRecordingCreatedTriggerSchema,
    attioCommentCreatedTriggerSchema,
    attioCommentDeletedTriggerSchema,
    attioCommentResolvedTriggerSchema,
    attioCommentUnresolvedTriggerSchema,
    attioListAttributeCreatedTriggerSchema,
    attioListAttributeUpdatedTriggerSchema,
    attioListCreatedTriggerSchema,
    attioListDeletedTriggerSchema,
    attioListEntryCreatedTriggerSchema,
    attioListEntryDeletedTriggerSchema,
    attioListEntryUpdatedTriggerSchema,
    attioListUpdatedTriggerSchema,
    attioNoteContentUpdatedTriggerSchema,
    attioNoteCreatedTriggerSchema,
    attioNoteDeletedTriggerSchema,
    attioNoteUpdatedTriggerSchema,
    attioObjectAttributeCreatedTriggerSchema,
    attioObjectAttributeUpdatedTriggerSchema,
    attioRecordCreatedTriggerSchema,
    attioRecordDeletedTriggerSchema,
    attioRecordMergedTriggerSchema,
    attioRecordUpdatedTriggerSchema,
    attioTaskCreatedTriggerSchema,
    attioTaskDeletedTriggerSchema,
    attioTaskUpdatedTriggerSchema,
    attioWorkspaceMemberCreatedTriggerSchema,
    cronTriggerSchema,
    gmailTriggerSchema,
    heyReachCampaignCompletedTriggerSchema,
    heyReachConnectionRequestAcceptedTriggerSchema,
    heyReachConnectionRequestSentTriggerSchema,
    heyReachFollowSentTriggerSchema,
    heyReachInmailReplyReceivedTriggerSchema,
    heyReachInmailSentTriggerSchema,
    heyReachLeadTagUpdatedTriggerSchema,
    heyReachLikedPostTriggerSchema,
    heyReachMessageReplyReceivedTriggerSchema,
    heyReachMessageSentTriggerSchema,
    heyReachViewedProfileTriggerSchema,
    linearCommentCreatedTriggerSchema,
    linearIssueCreatedTriggerSchema,
    linearIssueUpdatedTriggerSchema,
    slackAppMentionTriggerSchema,
    slackMessageTriggerSchema,
    slackReactionAddedTriggerSchema,
    webMonitorTriggerSchema,
    webhookTriggerSchema,
    workOSInvitationAcceptedTriggerSchema,
    workOSInvitationCreatedTriggerSchema,
    workOSInvitationResentTriggerSchema,
    workOSInvitationRevokedTriggerSchema,
    workOSOrganizationMembershipCreatedTriggerSchema,
    workOSOrganizationMembershipDeletedTriggerSchema,
    workOSOrganizationMembershipUpdatedTriggerSchema,
    workOSOrganizationTriggerSchema,
    workOSUserCreatedTriggerSchema,
    workOSUserDeletedTriggerSchema,
    workOSUserUpdatedTriggerSchema
} from "./Triggers"

// The hand-written SlackMessageTrigger et al. widen these schema fields (z.array(z.unknown()))
// to the structured Slack types, so projections must print the widened form.
const slackWidenedFields: Record<string, string> = {
    blocks: "SlackBlocks | null",
    attachments: "SlackAttachments | null",
    files: "SlackFiles | null"
}
const slackSdkImports = ["SlackAttachments", "SlackBlocks", "SlackFiles"]

const attioRecordProjection = (schema: z.ZodType): TriggerPayloadProjection => ({
    kind: "schema",
    schema,
    typeParams: "<TValues = Record<string, unknown>>",
    // The registered attio event transform flattens record.values before handlers run,
    // matching the SDK-level generic, not the raw wire shape.
    fieldOverrides: { "record.values": "TValues" }
})

export const triggerPayloadProjections: Readonly<Record<string, TriggerPayloadProjection>> = {
    SlackMessageTrigger: { kind: "schema", schema: slackMessageTriggerSchema, fieldOverrides: slackWidenedFields, sdkImports: slackSdkImports },
    SlackAppMentionTrigger: { kind: "schema", schema: slackAppMentionTriggerSchema, fieldOverrides: slackWidenedFields, sdkImports: slackSdkImports },
    SlackReactionAddedTrigger: { kind: "schema", schema: slackReactionAddedTriggerSchema, fieldOverrides: slackWidenedFields, sdkImports: slackSdkImports },
    SlackTrigger: { kind: "union", members: ["SlackMessageTrigger", "SlackAppMentionTrigger", "SlackReactionAddedTrigger"] },

    GithubPushTrigger: { kind: "schema", schema: GithubPushTriggerSchema },
    GithubPROpenedTrigger: { kind: "schema", schema: GithubPROpenedTriggerSchema },
    GithubPRSynchronizedTrigger: { kind: "schema", schema: GithubPRSynchronizedTriggerSchema },
    GithubPRClosedTrigger: { kind: "schema", schema: GithubPRClosedTriggerSchema },
    GithubPRMergedTrigger: { kind: "schema", schema: GithubPRMergedTriggerSchema },
    GithubIssueCommentCreatedTrigger: { kind: "schema", schema: GithubIssueCommentCreatedTriggerSchema },
    GithubPRTrigger: { kind: "union", members: ["GithubPROpenedTrigger", "GithubPRSynchronizedTrigger", "GithubPRClosedTrigger", "GithubPRMergedTrigger"] },
    GithubTrigger: {
        kind: "union",
        members: ["GithubPushTrigger", "GithubPROpenedTrigger", "GithubPRSynchronizedTrigger", "GithubPRClosedTrigger", "GithubPRMergedTrigger", "GithubIssueCommentCreatedTrigger"]
    },

    GmailTrigger: { kind: "schema", schema: gmailTriggerSchema },

    LinearIssueCreatedTrigger: { kind: "schema", schema: linearIssueCreatedTriggerSchema },
    LinearIssueUpdatedTrigger: { kind: "schema", schema: linearIssueUpdatedTriggerSchema },
    LinearCommentCreatedTrigger: { kind: "schema", schema: linearCommentCreatedTriggerSchema },
    LinearTrigger: { kind: "union", members: ["LinearIssueCreatedTrigger", "LinearIssueUpdatedTrigger", "LinearCommentCreatedTrigger"] },

    WorkOSUserCreatedTrigger: { kind: "schema", schema: workOSUserCreatedTriggerSchema },
    WorkOSUserUpdatedTrigger: { kind: "schema", schema: workOSUserUpdatedTriggerSchema },
    WorkOSUserDeletedTrigger: { kind: "schema", schema: workOSUserDeletedTriggerSchema },
    WorkOSUserTrigger: { kind: "union", members: ["WorkOSUserCreatedTrigger", "WorkOSUserUpdatedTrigger", "WorkOSUserDeletedTrigger"] },
    WorkOSOrganizationMembershipCreatedTrigger: { kind: "schema", schema: workOSOrganizationMembershipCreatedTriggerSchema },
    WorkOSOrganizationMembershipUpdatedTrigger: { kind: "schema", schema: workOSOrganizationMembershipUpdatedTriggerSchema },
    WorkOSOrganizationMembershipDeletedTrigger: { kind: "schema", schema: workOSOrganizationMembershipDeletedTriggerSchema },
    WorkOSMembershipTrigger: {
        kind: "union",
        members: ["WorkOSOrganizationMembershipCreatedTrigger", "WorkOSOrganizationMembershipUpdatedTrigger", "WorkOSOrganizationMembershipDeletedTrigger"]
    },
    WorkOSInvitationCreatedTrigger: { kind: "schema", schema: workOSInvitationCreatedTriggerSchema },
    WorkOSInvitationAcceptedTrigger: { kind: "schema", schema: workOSInvitationAcceptedTriggerSchema },
    WorkOSInvitationResentTrigger: { kind: "schema", schema: workOSInvitationResentTriggerSchema },
    WorkOSInvitationRevokedTrigger: { kind: "schema", schema: workOSInvitationRevokedTriggerSchema },
    WorkOSInvitationTrigger: {
        kind: "union",
        members: ["WorkOSInvitationCreatedTrigger", "WorkOSInvitationAcceptedTrigger", "WorkOSInvitationResentTrigger", "WorkOSInvitationRevokedTrigger"]
    },
    WorkOSOrganizationTrigger: { kind: "schema", schema: workOSOrganizationTriggerSchema },
    WorkOSTrigger: {
        kind: "union",
        members: [
            "WorkOSUserCreatedTrigger",
            "WorkOSUserUpdatedTrigger",
            "WorkOSUserDeletedTrigger",
            "WorkOSOrganizationMembershipCreatedTrigger",
            "WorkOSOrganizationMembershipUpdatedTrigger",
            "WorkOSOrganizationMembershipDeletedTrigger",
            "WorkOSInvitationCreatedTrigger",
            "WorkOSInvitationAcceptedTrigger",
            "WorkOSInvitationResentTrigger",
            "WorkOSInvitationRevokedTrigger",
            "WorkOSOrganizationTrigger"
        ]
    },

    HeyReachConnectionRequestSentTrigger: { kind: "schema", schema: heyReachConnectionRequestSentTriggerSchema },
    HeyReachConnectionRequestAcceptedTrigger: { kind: "schema", schema: heyReachConnectionRequestAcceptedTriggerSchema },
    HeyReachMessageSentTrigger: { kind: "schema", schema: heyReachMessageSentTriggerSchema },
    HeyReachMessageReplyReceivedTrigger: { kind: "schema", schema: heyReachMessageReplyReceivedTriggerSchema },
    HeyReachInmailSentTrigger: { kind: "schema", schema: heyReachInmailSentTriggerSchema },
    HeyReachInmailReplyReceivedTrigger: { kind: "schema", schema: heyReachInmailReplyReceivedTriggerSchema },
    HeyReachFollowSentTrigger: { kind: "schema", schema: heyReachFollowSentTriggerSchema },
    HeyReachLikedPostTrigger: { kind: "schema", schema: heyReachLikedPostTriggerSchema },
    HeyReachViewedProfileTrigger: { kind: "schema", schema: heyReachViewedProfileTriggerSchema },
    HeyReachCampaignCompletedTrigger: { kind: "schema", schema: heyReachCampaignCompletedTriggerSchema },
    HeyReachLeadTagUpdatedTrigger: { kind: "schema", schema: heyReachLeadTagUpdatedTriggerSchema },
    HeyReachTrigger: {
        kind: "union",
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
        ]
    },

    AttioCallRecordingCreatedTrigger: { kind: "schema", schema: attioCallRecordingCreatedTriggerSchema },
    AttioCommentCreatedTrigger: { kind: "schema", schema: attioCommentCreatedTriggerSchema },
    AttioCommentResolvedTrigger: { kind: "schema", schema: attioCommentResolvedTriggerSchema },
    AttioCommentUnresolvedTrigger: { kind: "schema", schema: attioCommentUnresolvedTriggerSchema },
    AttioCommentDeletedTrigger: { kind: "schema", schema: attioCommentDeletedTriggerSchema },
    AttioListCreatedTrigger: { kind: "schema", schema: attioListCreatedTriggerSchema },
    AttioListUpdatedTrigger: { kind: "schema", schema: attioListUpdatedTriggerSchema },
    AttioListDeletedTrigger: { kind: "schema", schema: attioListDeletedTriggerSchema },
    AttioListAttributeCreatedTrigger: { kind: "schema", schema: attioListAttributeCreatedTriggerSchema },
    AttioListAttributeUpdatedTrigger: { kind: "schema", schema: attioListAttributeUpdatedTriggerSchema },
    AttioListEntryCreatedTrigger: { kind: "schema", schema: attioListEntryCreatedTriggerSchema },
    AttioListEntryUpdatedTrigger: { kind: "schema", schema: attioListEntryUpdatedTriggerSchema },
    AttioListEntryDeletedTrigger: { kind: "schema", schema: attioListEntryDeletedTriggerSchema },
    AttioObjectAttributeCreatedTrigger: { kind: "schema", schema: attioObjectAttributeCreatedTriggerSchema },
    AttioObjectAttributeUpdatedTrigger: { kind: "schema", schema: attioObjectAttributeUpdatedTriggerSchema },
    AttioNoteCreatedTrigger: { kind: "schema", schema: attioNoteCreatedTriggerSchema },
    AttioNoteContentUpdatedTrigger: { kind: "schema", schema: attioNoteContentUpdatedTriggerSchema },
    AttioNoteUpdatedTrigger: { kind: "schema", schema: attioNoteUpdatedTriggerSchema },
    AttioNoteDeletedTrigger: { kind: "schema", schema: attioNoteDeletedTriggerSchema },
    AttioRecordCreatedTrigger: attioRecordProjection(attioRecordCreatedTriggerSchema),
    AttioRecordMergedTrigger: attioRecordProjection(attioRecordMergedTriggerSchema),
    AttioRecordUpdatedTrigger: attioRecordProjection(attioRecordUpdatedTriggerSchema),
    AttioRecordDeletedTrigger: { kind: "schema", schema: attioRecordDeletedTriggerSchema },
    AttioTaskCreatedTrigger: { kind: "schema", schema: attioTaskCreatedTriggerSchema },
    AttioTaskUpdatedTrigger: { kind: "schema", schema: attioTaskUpdatedTriggerSchema },
    AttioTaskDeletedTrigger: { kind: "schema", schema: attioTaskDeletedTriggerSchema },
    AttioWorkspaceMemberCreatedTrigger: { kind: "schema", schema: attioWorkspaceMemberCreatedTriggerSchema },
    AttioTrigger: {
        kind: "union",
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
        ]
    },

    CronTrigger: { kind: "schema", schema: cronTriggerSchema },
    WebhookTrigger: { kind: "schema", schema: webhookTriggerSchema, typeParams: "<TBody = unknown>", fieldOverrides: { body: "TBody" } },
    WebMonitorTrigger: { kind: "schema", schema: webMonitorTriggerSchema, typeParams: "<TPayload = unknown>", fieldOverrides: { payload: "TPayload" } }
}

export function isProjectedTriggerName(name: string): boolean {
    return name in triggerPayloadProjections
}

export type TriggerPayloadSchemaProjection = {
    kind: "schema"
    schema: z.ZodType
    /** Printed verbatim after the payload interface name, e.g. "<TBody = unknown>". */
    typeParams?: string
    /** Dot-path within the payload -> TypeScript type expression printed instead of the schema field. */
    fieldOverrides?: Record<string, string>
    /** Extra terse-sdk type imports the overrides reference. */
    sdkImports?: string[]
}

export type TriggerPayloadUnionProjection = {
    kind: "union"
    members: string[]
}

export type TriggerPayloadProjection = TriggerPayloadSchemaProjection | TriggerPayloadUnionProjection
