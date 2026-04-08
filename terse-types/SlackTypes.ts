import type { ConversationsHistoryResponse } from "@slack/web-api"
import type { ConversationsInfoResponse } from "@slack/web-api"
import type { UsersInfoResponse } from "@slack/web-api"
import * as z from "zod"

export enum SlackChannelType {
    CHANNEL = "channel",
    GROUP = "group",
    MPIM = "mpim",
    IM = "im"
}
export const slackChannelTypeSchema = z.enum(SlackChannelType)

// The user from the API response
export type SlackUser = UsersInfoResponse["user"]

// The channel from the API response
export type SlackChannelResp = ConversationsInfoResponse["channel"]

// The messages from the API response
export type SlackMessages = NonNullable<ConversationsHistoryResponse["messages"]>
export type SlackMessage = SlackMessages[number]

// The files from the API response
export type SlackFiles = NonNullable<SlackMessage["files"]>
export type SlackFile = SlackFiles[number]

// The reactions from the API response
export type SlackReactions = NonNullable<SlackMessage["reactions"]>
export type SlackReaction = SlackReactions[number]

// The attachments from the API response
export type SlackAttachments = NonNullable<SlackMessage["attachments"]>
export type SlackAttachment = SlackAttachments[number]

// The blocks from the API response
export type SlackBlocks = NonNullable<SlackMessage["blocks"]>
export type SlackBlock = SlackBlocks[number]
