import { RunHistoryActionType } from "@prisma/client"
import { google } from "googleapis"
import { IntegrationType } from "terse-types"

import { GmailIntegrationManager, getOAuth2Client } from "../../../integrations/GmailIntegration"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { SecretField, getSecret } from "../../../services/SecretService"
import { defineSessionTool } from "../../../tools/toolUtils"

import { buildEmailContentWithAttachments, downloadImageAttachments, encodeSubjectHeader, sanitizeCustomHeaders } from "./mime"

/**
 * Tool for creating draft emails in Gmail.
 * Supports both creating new drafts and draft replies to existing threads.
 */
export const gmailCreateDraftTool = defineSessionTool({
    name: "gmail_create_draft",
    description: `Create a draft email in Gmail. Use thread_id (the Gmail Thread ID, not the Message-ID) to create a draft reply to an existing thread, or omit it to create a new draft email. The draft will appear in the user's Gmail Drafts folder for review before sending. IMPORTANT: Never put image URLs directly in html_body — remote URLs expire and will result in broken images. Always use image_urls to embed images as base64-encoded inline MIME parts (CID attachments), then reference them in html_body with <img src="cid:image-1.png">. image_urls must be signed URLs from our internal GCS image bucket.`,
    execute: async ({ integrationId, to, subject, body, html_body, thread_id, cc, bcc, image_urls, custom_headers }, runContext) => {
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

            const refreshToken = await getSecret(IntegrationType.GMAIL, gmailIntegration.id, SecretField.RefreshToken)

            // Set up OAuth2 client
            const oauth2Client = getOAuth2Client()
            oauth2Client.setCredentials({
                access_token: accessToken,
                ...(refreshToken ? { refresh_token: refreshToken } : {})
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

            // Add custom headers (e.g., List-Unsubscribe).
            // sanitizeCustomHeaders drops any keys that would override security-critical
            // headers (To, From, Cc, Bcc, Subject, …) and rejects values containing
            // CRLF characters to prevent header injection attacks.
            if (custom_headers) {
                for (const [key, value] of Object.entries(sanitizeCustomHeaders(custom_headers))) {
                    headers.push(`${key}: ${value}`)
                }
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
            const attachments = await downloadImageAttachments(image_urls ?? [])

            // Build the raw MIME email message
            const emailContent = buildEmailContentWithAttachments(headers, body, html_body, attachments)

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

            logger.debug("[gmail_create_draft] Returning action in result", {
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
