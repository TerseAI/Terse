import { App as SlackApp } from "@slack/bolt"
import { KnownBlock } from "@slack/web-api"
import { SdkInputRequestOption, SdkInputResponsePayload } from "terse-types/types"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { resolveInputRequest } from "../../services/InputRequestService"

import { createFeedbackModal } from "./blockKitHelpers"
import {
    INPUT_REQUEST_ACTION_PREFIX,
    INPUT_REQUEST_FEEDBACK_ACTION_ID,
    INPUT_REQUEST_FEEDBACK_BLOCK_ID,
    INPUT_REQUEST_MODAL_CALLBACK_ID,
    InputRequestModalMetadata,
    finalizeSlackInputRequestMessage,
    inputRequestMetadataSchema,
    inputRequestModalMetadataSchema,
    parseInputRequestActionId,
    resolveSlackDisplayName
} from "./inputRequests"

export function registerInputRequestHandlers(slack: SlackApp): void {
    slack.action(new RegExp(`^${INPUT_REQUEST_ACTION_PREFIX}.+$`), async ({ ack, body, action, respond, client }) => {
        await ack()

        try {
            if (!("action_id" in action)) return
            const optionId = parseInputRequestActionId(action.action_id)
            if (!optionId) return

            const message = (body as any).message as { ts?: string; blocks?: KnownBlock[]; metadata?: { event_payload?: unknown } } | undefined
            const channelId = (body as any).channel?.id as string | undefined
            const parsedMetadata = inputRequestMetadataSchema.safeParse(message?.metadata?.event_payload)
            if (!parsedMetadata.success || !channelId || !message?.ts) {
                logger.error("[SlackInputRequest] Button click without readable request metadata", { actionId: action.action_id })
                await respond({ text: "Error: This input request is missing its metadata and can't be processed.", response_type: "ephemeral" })
                return
            }
            const metadata = parsedMetadata.data
            const option = metadata.options.find(candidate => candidate.id === optionId)
            if (!option) {
                await respond({ text: "Error: Unknown option for this input request.", response_type: "ephemeral" })
                return
            }

            const organizationId = await resolveRunOrganization(metadata.run_id)
            if (!organizationId) {
                await respond({ text: "Error: The run behind this request no longer exists.", response_type: "ephemeral" })
                return
            }

            // v1 authorization: anyone in the connected workspace's channel may respond;
            // the workspace itself must belong to the org that owns the run.
            const workspaceOk = await verifySlackWorkspaceInOrganization(body, organizationId)
            if (!workspaceOk) {
                logger.warn("[SlackInputRequest] Click from a workspace not linked to the run's organization", { runId: metadata.run_id })
                await respond({ text: "Error: You don't have permission to respond to this request.", response_type: "ephemeral" })
                return
            }

            if (option.freeText) {
                const triggerId = (body as any).trigger_id as string | undefined
                if (!triggerId) {
                    await respond({ text: "Error: Unable to open the response form.", response_type: "ephemeral" })
                    return
                }
                const modalMetadata: InputRequestModalMetadata = {
                    token: metadata.token,
                    run_id: metadata.run_id,
                    options: metadata.options,
                    option_id: option.id,
                    channel_id: channelId,
                    message_ts: message.ts
                }
                await client.views.open({
                    trigger_id: triggerId,
                    view: {
                        ...createFeedbackModal({
                            title: option.label,
                            submitText: "Submit",
                            cancelText: "Cancel",
                            privateMetadata: JSON.stringify(modalMetadata),
                            blockId: INPUT_REQUEST_FEEDBACK_BLOCK_ID,
                            actionId: INPUT_REQUEST_FEEDBACK_ACTION_ID,
                            placeholder: "Enter your response..."
                        }),
                        callback_id: INPUT_REQUEST_MODAL_CALLBACK_ID
                    }
                })
                return
            }

            const displayName = await resolveSlackDisplayName(client, body.user.id)
            const response: SdkInputResponsePayload = {
                choice: option.id,
                respondent: { provider: "slack", userId: body.user.id, displayName }
            }
            await deliverResponse({
                client,
                organizationId,
                runId: metadata.run_id,
                token: metadata.token,
                option,
                response,
                channelId,
                messageTs: message.ts,
                existingBlocks: message.blocks
            })
        } catch (error) {
            logger.error("[SlackInputRequest] Error processing input response", { error })
            await respond({ text: "Error processing your response.", response_type: "ephemeral" })
        }
    })

    slack.view(INPUT_REQUEST_MODAL_CALLBACK_ID, async ({ ack, body, view, client }) => {
        // Slack requires view submissions to be acknowledged within 3 seconds;
        // everything async happens after ack().
        const text = view.state.values[INPUT_REQUEST_FEEDBACK_BLOCK_ID]?.[INPUT_REQUEST_FEEDBACK_ACTION_ID]?.value
        if (!text || text.trim().length === 0) {
            await ack({ response_action: "errors", errors: { [INPUT_REQUEST_FEEDBACK_BLOCK_ID]: "A response is required" } })
            return
        }

        const parsedMetadata = parseModalMetadata(view.private_metadata)
        if (!parsedMetadata) {
            await ack({ response_action: "errors", errors: { [INPUT_REQUEST_FEEDBACK_BLOCK_ID]: "Invalid request data" } })
            return
        }
        await ack()

        void (async () => {
            try {
                const metadata = parsedMetadata
                const option = metadata.options.find(candidate => candidate.id === metadata.option_id)
                const organizationId = await resolveRunOrganization(metadata.run_id)
                if (!option || !organizationId) return

                const workspaceOk = await verifySlackWorkspaceInOrganization(body, organizationId)
                if (!workspaceOk) {
                    logger.warn("[SlackInputRequest] Modal submission from a workspace not linked to the run's organization", { runId: metadata.run_id })
                    return
                }

                const displayName = await resolveSlackDisplayName(client, body.user.id)
                const response: SdkInputResponsePayload = {
                    choice: option.id,
                    text: text.trim(),
                    respondent: { provider: "slack", userId: body.user.id, displayName }
                }
                await deliverResponse({
                    client,
                    organizationId,
                    runId: metadata.run_id,
                    token: metadata.token,
                    option,
                    response,
                    channelId: metadata.channel_id,
                    messageTs: metadata.message_ts
                })
            } catch (error) {
                logger.error("[SlackInputRequest] Error processing modal response", { error })
            }
        })()
    })
}

// helpers

type DeliverResponseParams = {
    client: Parameters<typeof finalizeSlackInputRequestMessage>[0]
    organizationId: string
    runId: string
    token: string
    option: SdkInputRequestOption
    response: SdkInputResponsePayload
    channelId: string
    messageTs: string
    existingBlocks?: KnownBlock[]
}

async function deliverResponse(params: DeliverResponseParams): Promise<void> {
    const { client, organizationId, runId, token, option, response, channelId, messageTs, existingBlocks } = params

    const respondedBy = response.respondent.displayName ?? `<@${response.respondent.userId}>`
    const summary = response.text ? `:white_check_mark: *${option.label}* by ${respondedBy}: ${response.text}` : `:white_check_mark: *${option.label}* by ${respondedBy}`
    await finalizeSlackInputRequestMessage(client, channelId, messageTs, summary, existingBlocks)

    const outcome = await resolveInputRequest({ organizationId, runId, token, response })
    if (outcome === "resumed") return

    const failureLine = outcome === "run_finished" ? ":warning: This response arrived after the run had already finished." : ":warning: The run never reached a resumable state; the response was not delivered."
    await finalizeSlackInputRequestMessage(client, channelId, messageTs, failureLine)
}

async function verifySlackWorkspaceInOrganization(body: { user: { id: string; team_id?: string }; team?: { id?: string } | null }, organizationId: string): Promise<boolean> {
    const teamId = body.user.team_id ?? body.team?.id
    if (!teamId) return false
    const link = await db().user_slack_integrations.findFirst({
        where: { slack_team_id: teamId, organization_id: organizationId },
        select: { id: true }
    })
    return link !== null
}

async function resolveRunOrganization(runId: string): Promise<string | null> {
    const run = await db().run_history_records.findUnique({
        where: { id: runId },
        select: { automation: { select: { organization_id: true } } }
    })
    return run?.automation?.organization_id ?? null
}

function parseModalMetadata(privateMetadata: string): InputRequestModalMetadata | null {
    try {
        const parsed = inputRequestModalMetadataSchema.safeParse(JSON.parse(privateMetadata))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}
