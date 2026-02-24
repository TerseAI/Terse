import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { google } from "googleapis"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { GmailIntegrationManager, getOAuth2Client } from "../../../integrations/GmailIntegration"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { createNeedsApprovalFunction } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

import { buildEmailContentWithAttachments, downloadImageAttachments, encodeSubjectHeader } from "./mime"

/**
 * Tool for creating draft emails in Gmail.
 * Supports both creating new drafts and draft replies to existing threads.
 */
export const gmailCreateDraftTool = tool({
    name: ToolName.GMAIL_CREATE_DRAFT,
    description: `Create a draft email in Gmail. Use thread_id (the Gmail Thread ID, not the Message-ID) to create a draft reply to an existing thread, or omit it to create a new draft email. The draft will appear in the user's Gmail Drafts folder for review before sending. IMPORTANT: Never put image URLs directly in html_body — remote URLs expire and will result in broken images. Always use image_urls to embed images as base64-encoded inline MIME parts (CID attachments), then reference them in html_body with <img src="cid:image-1.png">.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Gmail account to use."),
        to: z.string().describe("Recipient email address(es). Multiple addresses can be comma-separated."),
        subject: z.string().describe("Email subject line"),
        body: z.string().nullable().optional().describe("Plain text email body content. Do not include image URLs here — images cannot be embedded in plain text."),
        html_body: z.string().nullable().optional().describe("HTML email body content. If provided with body, sends multipart/alternative. NEVER use <img src=\"https://...\"> with remote URLs — they will expire. Images must be passed via image_urls and referenced as <img src=\"cid:image-1.png\">."),
        thread_id: z.string().nullable().optional().describe("Gmail Thread ID (numeric string from the email event, NOT the Message-ID header). Omit for new drafts."),
        cc: z.string().nullable().optional().describe("CC recipient email address(es). Multiple addresses can be comma-separated."),
        bcc: z.string().nullable().optional().describe("BCC recipient email address(es). Multiple addresses can be comma-separated."),
        image_urls: z
            .array(z.string())
            .nullable()
            .optional()
            .describe(
                "URLs of images to embed in the email. Each image is downloaded and base64-encoded as an inline MIME attachment with a Content-ID. Images are assigned sequential filenames: image-1.png, image-2.png, etc. (extension reflects actual MIME type). You MUST reference each one in html_body as <img src=\"cid:image-1.png\">, <img src=\"cid:image-2.png\">, etc. Do NOT put the raw URLs in html_body."
            )
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.GMAIL_CREATE_DRAFT),
    execute: async ({ integrationId, to, subject, body, html_body, thread_id, cc, bcc, image_urls }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        if (!to || !subject || (!body?.trim() && !html_body?.trim())) {
            throw new Error("to, subject, and at least one of body or html_body are required")
        }

        try {
            // Get Gmail integration to access refresh token
            const organizationId = runContext.context.user.organizationId
            const gmailIntegration = await db().gmail_integrations.findUnique({
                where: { id: integrationId, organization_id: organizationId }
            })

            if (!gmailIntegration || !gmailIntegration.is_active) {
                throw new Error(`Gmail integration ${integrationId} not found or is inactive`)
            }

            // Get access token (will refresh if needed)
            const gmailIntegrationManager = new GmailIntegrationManager()
            const accessToken = await gmailIntegrationManager.getAccessToken(integrationId)

            if (!accessToken) {
                throw new Error("Failed to get Gmail access token")
            }

            // Set up OAuth2 client
            const oauth2Client = getOAuth2Client()
            oauth2Client.setCredentials({
                access_token: accessToken,
                refresh_token: gmailIntegration.refresh_token
            })

            const gmail = google.gmail({ version: "v1", auth: oauth2Client })

            // Build email headers
            const headers: string[] = [`To: ${to}`, `Subject: ${encodeSubjectHeader(subject)}`]

            if (cc) {
                headers.push(`Cc: ${cc}`)
            }

            if (bcc) {
                headers.push(`Bcc: ${bcc}`)
            }

            // If replying, add In-Reply-To and References headers
            if (thread_id) {
                try {
                    const threadResponse = await gmail.users.threads.get({
                        userId: "me",
                        id: thread_id,
                        format: "metadata",
                        metadataHeaders: ["Message-ID", "References", "In-Reply-To"]
                    })

                    const messages = threadResponse.data.messages || []
                    if (messages.length > 0) {
                        const mostRecentMessage = messages[messages.length - 1]
                        const mostRecentHeaders = mostRecentMessage.payload?.headers || []

                        const getHeader = (name: string) => {
                            const header = mostRecentHeaders.find(h => h.name?.toLowerCase() === name.toLowerCase())
                            return header?.value || ""
                        }

                        const mostRecentMessageId = getHeader("Message-ID")
                        const mostRecentReferences = getHeader("References")
                        const mostRecentInReplyTo = getHeader("In-Reply-To")

                        let references = mostRecentReferences || ""

                        if (mostRecentMessageId) {
                            if (references) {
                                if (!references.includes(mostRecentMessageId)) {
                                    references = `${references} ${mostRecentMessageId}`
                                }
                            } else {
                                references = mostRecentInReplyTo || mostRecentMessageId
                                if (mostRecentMessageId && mostRecentInReplyTo && mostRecentInReplyTo !== mostRecentMessageId) {
                                    references = `${mostRecentInReplyTo} ${mostRecentMessageId}`
                                }
                            }
                        }

                        if (references) {
                            headers.push(`References: ${references}`)
                        }

                        if (mostRecentMessageId) {
                            headers.push(`In-Reply-To: ${mostRecentMessageId}`)
                        }
                    }
                } catch (error: any) {
                    logger.warn(`Failed to fetch original message for thread ${thread_id}`, { error, thread_id })
                }
            }

            // Download any image attachments
            logger.info("[gmail_create_draft] Downloading image attachments", {
                image_urls: image_urls ?? [],
                count: (image_urls ?? []).length
            })
            const attachments = await downloadImageAttachments(image_urls ?? [])
            logger.info("[gmail_create_draft] Downloaded attachments", {
                count: attachments.length,
                attachments: attachments.map(a => ({
                    filename: a.filename,
                    mimeType: a.mimeType,
                    bytes: a.data.length
                }))
            })

            // Check that all cid: references in html_body have a matching attachment
            if (html_body) {
                const cidRefs = [...html_body.matchAll(/cid:([^\s"'>]+)/g)].map(m => m[1])
                const assignedIds = attachments.map(a => a.filename)
                const unresolved = cidRefs.filter(cid => !assignedIds.includes(cid))
                logger.info("[gmail_create_draft] CID reference check", {
                    cidRefsInHtml: cidRefs,
                    assignedContentIds: assignedIds,
                    unresolvedCids: unresolved
                })
                if (unresolved.length > 0) {
                    logger.warn("[gmail_create_draft] Unresolved cid references — images will appear broken", {
                        unresolvedCids: unresolved
                    })
                }
            }

            // Build the raw MIME email message
            const emailContent = buildEmailContentWithAttachments(headers, body, html_body, attachments)

            // Log MIME structure (first 2000 chars, skipping base64 blobs)
            logger.info("[gmail_create_draft] Raw MIME preview (first 2000 chars)", {
                mimePreview: emailContent.slice(0, 2000)
            })

            // Encode the email in base64url format (required by Gmail API)
            const encodedMessage = Buffer.from(emailContent).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

            // Create the draft
            const createRequest: any = {
                userId: "me",
                requestBody: {
                    message: {
                        raw: encodedMessage
                    }
                }
            }

            // If replying, include the thread ID
            if (thread_id) {
                createRequest.requestBody.message.threadId = thread_id
            }

            const result = await gmail.users.drafts.create(createRequest)

            if (!result.data.id) {
                throw new Error("Failed to create draft: No draft ID returned")
            }

            const draftId = result.data.id
            const messageId = result.data.message?.id || ""
            const draftType = thread_id ? "draft reply" : "new draft"
            const previewSource =
                body?.trim() ||
                html_body
                    ?.replace(/<[^>]*>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim() ||
                ""
            const emailPreview = previewSource.length > 100 ? previewSource.substring(0, 100) + "..." : previewSource

            // Build Gmail draft URL
            const draftUrl = `https://mail.google.com/mail/u/0/#drafts?compose=${messageId}`

            // Return action as part of the result
            const action = {
                action: `Created Gmail ${draftType}`,
                integration: IntegrationType.GMAIL,
                target: to,
                details: `Created ${draftType} to ${to}: "${subject}" - ${emailPreview}`,
                url: draftUrl,
                type: RunHistoryActionType.create
            }

            logger.info("[gmail_create_draft] Returning action in result", {
                userId: runContext?.context?.user?.id || "unknown",
                action
            })

            logger.info(`[Gmail Draft Output] ${draftType} created`, {
                draftId,
                messageId,
                threadId: thread_id,
                to,
                subject,
                integrationId
            })

            return {
                success: true,
                draft_id: draftId,
                message_id: messageId,
                thread_id: thread_id || result.data.message?.threadId || "",
                draft_url: draftUrl,
                to,
                subject,
                summary: `${draftType} created for ${to}: "${subject}"`,
                is_reply: !!thread_id,
                actions: [action]
            }
        } catch (error: any) {
            logger.error(`[Gmail Draft Output] Failed to create draft`, {
                error,
                to,
                subject,
                thread_id,
                integrationId
            })

            // Provide helpful error messages
            if (error.code === 401 || error.message?.includes("Invalid Credentials")) {
                throw new Error(`Gmail authentication failed. Please reconnect your Gmail integration.`)
            } else if (error.code === 403) {
                throw new Error(`Gmail API permission denied. Please reconnect your Gmail integration to grant the required permissions.`)
            } else if (error.message?.includes("thread")) {
                throw new Error(`Invalid thread ID. The thread may not exist or you may not have access to it.`)
            }

            throw new Error(`Failed to create Gmail ${thread_id ? "draft reply" : "draft"}: ${error.message || error}`)
        }
    }
})
