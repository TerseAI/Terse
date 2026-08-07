import { KnownBlock, WebClient } from "@slack/web-api"
import axios from "axios"
import { SdkInputRequestMedia, SdkInputRequestRegisterBody, sdkInputRequestOptionSchema, sdkInputResponseTransportSchema } from "terse-types/types"
import { z } from "zod"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"

import { initializeSlackWebClient } from "./client"
import { describeSlackPostMessageError } from "./helpers"

export const TERSE_INPUT_REQUEST_EVENT_TYPE = "terse_input_request"
export const INPUT_REQUEST_ACTION_PREFIX = "terse_input__"
export const INPUT_REQUEST_MODAL_CALLBACK_ID = "terse_input_free_text_submit"
export const INPUT_REQUEST_FEEDBACK_BLOCK_ID = "terse_input_feedback_block"
export const INPUT_REQUEST_FEEDBACK_ACTION_ID = "feedback"

// The full request state rides the Slack message itself (metadata + button values),
// so responses can be processed without any input-request rows in our DB.
export const inputRequestMetadataSchema = z.object({
    token: z.string().min(1),
    run_id: z.string().min(1),
    options: z.array(sdkInputRequestOptionSchema).min(1),
    transport: sdkInputResponseTransportSchema
})
export type InputRequestMetadata = z.infer<typeof inputRequestMetadataSchema>

export const inputRequestModalMetadataSchema = inputRequestMetadataSchema.extend({
    option_id: z.string().min(1),
    channel_id: z.string().min(1),
    message_ts: z.string().min(1)
})
export type InputRequestModalMetadata = z.infer<typeof inputRequestModalMetadataSchema>

export function inputRequestActionId(optionId: string): string {
    return `${INPUT_REQUEST_ACTION_PREFIX}${optionId}`
}

export function parseInputRequestActionId(actionId: string): string | null {
    if (!actionId.startsWith(INPUT_REQUEST_ACTION_PREFIX)) return null
    return actionId.slice(INPUT_REQUEST_ACTION_PREFIX.length)
}

export async function getSlackBotClientForOrganization(organizationId: string): Promise<WebClient | null> {
    const integration = await db().user_slack_integrations.findFirst({
        where: { organization_id: organizationId, is_bot_user: true },
        include: { slack_integration: true }
    })
    if (!integration?.slack_integration) {
        logger.error("[SlackInputRequest] No bot Slack integration for organization", { organizationId })
        return null
    }
    return initializeSlackWebClient(integration)
}

export async function deliverSlackInputRequest(params: {
    organizationId: string
    jobName: string
    body: SdkInputRequestRegisterBody
}): Promise<{ ok: true; channelId: string; messageTs: string } | { ok: false; error: string }> {
    const { organizationId, jobName, body } = params

    const client = await getSlackBotClientForOrganization(organizationId)
    if (!client) return { ok: false, error: "No Slack integration is connected for this organization." }

    const metadata: InputRequestMetadata = {
        token: body.token,
        run_id: body.runId,
        options: body.options,
        transport: body.transport
    }

    // Videos are uploaded ahead of the request message so their players sit directly
    // above the buttons: Block Kit's video block only accepts an embeddable player page
    // on an unfurl-approved domain, which a signed asset URL is not.
    const unplayableVideos = await uploadInputRequestVideos(client, body.via.channelId, videosIn(body.media))

    try {
        const result = await client.chat.postMessage({
            channel: body.via.channelId,
            text: `Input required: ${body.prompt}`,
            blocks: buildInputRequestBlocks(jobName, body, unplayableVideos),
            metadata: {
                event_type: TERSE_INPUT_REQUEST_EVENT_TYPE,
                event_payload: metadata
            }
        })
        if (!result.ok || !result.ts) {
            return { ok: false, error: result.error ?? "Slack rejected the message." }
        }
        return { ok: true, channelId: result.channel ?? body.via.channelId, messageTs: result.ts }
    } catch (error) {
        logger.error("[SlackInputRequest] Failed to deliver input request", { error, organizationId, channelId: body.via.channelId })
        return { ok: false, error: describeSlackPostMessageError(error) ?? "Slack rejected the message." }
    }
}

// Replaces the message's action buttons with a status line, keeping the request content.
// Pass the message blocks when the caller has them (button clicks include the message);
// otherwise they are fetched, which modal submissions and expiry need.
export async function finalizeSlackInputRequestMessage(client: WebClient, channelId: string, messageTs: string, statusLine: string, existingBlocks?: KnownBlock[]): Promise<boolean> {
    try {
        const blocks = existingBlocks ?? (await fetchMessageBlocks(client, channelId, messageTs))
        const withoutActions = (blocks ?? []).filter(block => block.type !== "actions")
        withoutActions.push({
            type: "context",
            elements: [{ type: "mrkdwn", text: statusLine }]
        })
        const result = await client.chat.update({
            channel: channelId,
            ts: messageTs,
            text: statusLine,
            blocks: withoutActions
        })
        return result.ok === true
    } catch (error) {
        logger.error("[SlackInputRequest] Failed to finalize input request message", { error, channelId, messageTs })
        return false
    }
}

export async function resolveSlackDisplayName(client: WebClient, slackUserId: string): Promise<string | undefined> {
    try {
        const info = await client.users.info({ user: slackUserId })
        return info.user?.profile?.real_name || info.user?.real_name || info.user?.name || undefined
    } catch {
        return undefined
    }
}

// helpers

function buildInputRequestBlocks(jobName: string, body: SdkInputRequestRegisterBody, unplayableVideos: VideoMedia[]): KnownBlock[] {
    const blocks: KnownBlock[] = [
        {
            type: "section",
            text: { type: "mrkdwn", text: `:inbox_tray: *${body.prompt}*` }
        }
    ]

    // Images go above the details so a reviewer sees what they are approving
    // before reading the copy that goes with it.
    imagesIn(body.media).forEach(image => {
        blocks.push({
            type: "image",
            image_url: image.url,
            alt_text: image.altText ?? "Attached image"
        })
    })

    // A video we could not upload still has to reach the reviewer, or they are
    // approving something they never saw.
    unplayableVideos.forEach(video => {
        blocks.push({
            type: "section",
            text: { type: "mrkdwn", text: `:movie_camera: <${video.url}|${video.altText ?? "Attached video"}>` }
        })
    })

    const details = Object.entries(body.details ?? {})
    if (details.length > 0) {
        blocks.push({
            type: "section",
            fields: details.slice(0, 10).map(([key, value]) => ({ type: "mrkdwn", text: `*${key}*\n${value}` }))
        })
    }

    blocks.push({
        type: "actions",
        elements: body.options.map(option => ({
            type: "button",
            action_id: inputRequestActionId(option.id),
            value: body.token,
            text: { type: "plain_text", text: option.label, emoji: true }
        }))
    })

    const source = body.transport === "poll" ? `${jobName} · terse test` : jobName
    blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `${source} · waiting for a response` }]
    })

    return blocks
}

function imagesIn(media: SdkInputRequestMedia[] | undefined): ImageMedia[] {
    return (media ?? []).filter(isImage)
}

function videosIn(media: SdkInputRequestMedia[] | undefined): VideoMedia[] {
    return (media ?? []).filter(isVideo)
}

function isImage(media: SdkInputRequestMedia): media is ImageMedia {
    return media.kind === "image"
}

function isVideo(media: SdkInputRequestMedia): media is VideoMedia {
    return media.kind === "video"
}

// Returns the videos that did not make it into the channel, so the caller can fall
// back to a link rather than dropping them.
async function uploadInputRequestVideos(client: WebClient, channelId: string, videos: VideoMedia[]): Promise<VideoMedia[]> {
    const results = await Promise.all(videos.map(async video => ({ video, uploaded: await uploadVideoToChannel(client, channelId, video) })))
    return results.filter(result => !result.uploaded).map(result => result.video)
}

async function uploadVideoToChannel(client: WebClient, channelId: string, video: VideoMedia): Promise<boolean> {
    try {
        const download = await axios.get<ArrayBuffer>(video.url, { responseType: "arraybuffer" })
        const result = await client.filesUploadV2({
            channel_id: channelId,
            file: Buffer.from(download.data),
            filename: videoFilename(video.url),
            title: video.altText ?? "Attached video"
        })
        return result.ok === true
    } catch (error) {
        logger.error("[SlackInputRequest] Failed to upload video", { error, channelId, url: video.url })
        return false
    }
}

function videoFilename(url: string): string {
    const name = new URL(url).pathname.split("/").pop()
    return name && name.includes(".") ? name : "creative.mp4"
}

async function fetchMessageBlocks(client: WebClient, channelId: string, messageTs: string): Promise<KnownBlock[] | undefined> {
    const history = await client.conversations.history({
        channel: channelId,
        latest: messageTs,
        inclusive: true,
        limit: 1
    })
    const message = history.messages?.[0]
    if (!message || message.ts !== messageTs) return undefined
    return message.blocks as KnownBlock[] | undefined
}

type ImageMedia = Extract<SdkInputRequestMedia, { kind: "image" }>
type VideoMedia = Extract<SdkInputRequestMedia, { kind: "video" }>
