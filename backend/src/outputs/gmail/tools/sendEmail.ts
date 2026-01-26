import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import { google } from "googleapis";
import { db } from "../../../prismaClient";
import logger from "../../../logger";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner";
import { getOAuth2Client, GmailIntegrationManager } from "../../../integrations/GmailIntegration";
import { formatError, createNeedsApprovalFunction } from "../../../tools/toolUtils";
import { ToolName } from "../../../tools/ToolNames";
import { Session } from "../../../types/session";

/**
 * Tool for sending emails or replying to email threads via Gmail.
 * Supports both sending new emails and replying to existing threads.
 */
export const gmailSendEmailTool = tool({
    name: ToolName.GMAIL_SEND_EMAIL,
    description: `Send email or reply to an existing email thread via Gmail. Use thread_id (the Gmail Thread ID, not the Message-ID) to reply to an existing thread, or omit it to send a new email.`,
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the Gmail account to use.'),
        to: z.string().describe("Recipient email address(es). Multiple addresses can be comma-separated."),
        subject: z.string().describe("Email subject line"),
        body: z.string().describe("Email body content (plain text)"),
        thread_id: z.string().nullable().optional().describe("Gmail Thread ID (numeric string from the email event, NOT the Message-ID header). Omit for new emails."),
        cc: z.string().nullable().optional().describe("CC recipient email address(es). Multiple addresses can be comma-separated."),
        bcc: z.string().nullable().optional().describe("BCC recipient email address(es). Multiple addresses can be comma-separated."),
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.GMAIL_SEND_EMAIL),
    execute: async ({ integrationId, to, subject, body, thread_id, cc, bcc }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (!to || !subject || !body) {
            throw new Error("to, subject, and body are required");
        }

        try {
            // Get Gmail integration to access refresh token
            const gmailIntegration = await db().gmail_integrations.findUnique({
                where: { id: integrationId },
            });

            if (!gmailIntegration || !gmailIntegration.is_active) {
                throw new Error(`Gmail integration ${integrationId} not found or is inactive`);
            }

            // Get access token (will refresh if needed)
            const gmailIntegrationManager = new GmailIntegrationManager();
            const accessToken = await gmailIntegrationManager.getAccessToken(integrationId);

            if (!accessToken) {
                throw new Error("Failed to get Gmail access token");
            }

            // Set up OAuth2 client
            const oauth2Client = getOAuth2Client();
            oauth2Client.setCredentials({
                access_token: accessToken,
                refresh_token: gmailIntegration.refresh_token,
            });

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Build email headers
            const headers: string[] = [
                `To: ${to}`,
                `Subject: ${subject}`,
            ];

            if (cc) {
                headers.push(`Cc: ${cc}`);
            }

            if (bcc) {
                headers.push(`Bcc: ${bcc}`);
            }

            // If replying, add In-Reply-To and References headers
            if (thread_id) {
                // Fetch the original message to get its Message-ID
                try {
                    const threadResponse = await gmail.users.threads.get({
                        userId: 'me',
                        id: thread_id,
                        format: 'metadata',
                        metadataHeaders: ['Message-ID', 'References', 'In-Reply-To'],
                    });

                    const messages = threadResponse.data.messages || [];
                    if (messages.length > 0) {
                        // Get the most recent message (last in array) for proper threading
                        // Gmail API returns messages in chronological order, so the last one is most recent
                        const mostRecentMessage = messages[messages.length - 1];
                        const mostRecentHeaders = mostRecentMessage.payload?.headers || [];
                        
                        const getHeader = (name: string) => {
                            const header = mostRecentHeaders.find(
                                (h) => h.name?.toLowerCase() === name.toLowerCase()
                            );
                            return header?.value || "";
                        };

                        const mostRecentMessageId = getHeader('Message-ID');
                        const mostRecentReferences = getHeader('References');
                        const mostRecentInReplyTo = getHeader('In-Reply-To');

                        // Build References header: include all previous message IDs from the thread
                        // Start with existing References from the most recent message, then add its Message-ID
                        let references = mostRecentReferences || '';
                        
                        // If the most recent message has a Message-ID, add it to References
                        if (mostRecentMessageId) {
                            if (references) {
                                // Append the most recent Message-ID if it's not already in References
                                if (!references.includes(mostRecentMessageId)) {
                                    references = `${references} ${mostRecentMessageId}`;
                                }
                            } else {
                                // If no References header exists, use In-Reply-To or Message-ID
                                references = mostRecentInReplyTo || mostRecentMessageId;
                                if (mostRecentMessageId && mostRecentInReplyTo && mostRecentInReplyTo !== mostRecentMessageId) {
                                    references = `${mostRecentInReplyTo} ${mostRecentMessageId}`;
                                }
                            }
                        }

                        if (references) {
                            headers.push(`References: ${references}`);
                        }

                        // In-Reply-To should reference the most recent message's Message-ID
                        if (mostRecentMessageId) {
                            headers.push(`In-Reply-To: ${mostRecentMessageId}`);
                        }
                    }
                } catch (error: any) {
                    logger.warn(`Failed to fetch original message for thread ${thread_id}`, { error, thread_id });
                    // Continue without In-Reply-To/References headers if we can't fetch them
                }
            }

            // Build the raw email message
            const emailContent = [
                ...headers,
                '', // Empty line between headers and body
                body,
            ].join('\r\n');

            // Encode the email in base64url format (required by Gmail API)
            const encodedMessage = Buffer.from(emailContent)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Send the email
            const sendRequest: any = {
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            };

            // If replying, include the thread ID
            if (thread_id) {
                sendRequest.requestBody.threadId = thread_id;
            }

            const result = await gmail.users.messages.send(sendRequest);

            if (!result.data.id) {
                throw new Error('Failed to send email: No message ID returned');
            }

            const messageId = result.data.id;
            const emailType = thread_id ? 'reply' : 'new email';
            const emailPreview = body.length > 100 ? body.substring(0, 100) + '...' : body;
            
            // Build Gmail message URL using the thread ID with #all
            // Format: https://mail.google.com/mail/u/0/#all/{threadId}
            // Using #all instead of #inbox ensures the link works regardless of label
            // Fallback to messageId if threadId is not available (rare but possible edge case)
            const sentThreadId = thread_id || result.data.threadId || messageId;
            const gmailUrl = `https://mail.google.com/mail/u/0/#all/${sentThreadId}`;
            
            // Return action as part of the result
            const action = {
                action: `Sent Gmail ${emailType}`,
                integration: IntegrationType.GMAIL,
                target: to,
                details: `Sent ${emailType} to ${to}: "${subject}" - ${emailPreview}`,
                url: gmailUrl,
                type: RunHistoryActionType.create,
            };
            
            logger.debug('[gmail_send_email] Returning action in result', {
                userId: runContext?.context?.user?.id || 'unknown',
                action,
            });
            
            logger.info(`[Gmail Output] ${emailType} sent`, { 
                messageId,
                threadId: thread_id,
                to,
                subject,
                integrationId,
            });

            return {
                success: true,
                message_id: messageId,
                thread_id: thread_id || result.data.threadId || messageId,
                to,
                subject,
                summary: `${emailType} sent to ${to}: "${subject}"`,
                is_reply: !!thread_id,
                actions: [action],
            };
        } catch (error: any) {
            logger.error(`[Gmail Output] Failed to send email`, { 
                error,
                to,
                subject,
                thread_id,
                integrationId,
            });
            
            // Provide helpful error messages
            if (error.code === 401 || error.message?.includes('Invalid Credentials')) {
                throw new Error(`Gmail authentication failed. Please reconnect your Gmail integration.`);
            } else if (error.code === 403) {
                throw new Error(`Gmail API permission denied. Please ensure the integration has send permissions.`);
            } else if (error.message?.includes('thread')) {
                throw new Error(`Invalid thread ID. The thread may not exist or you may not have access to it.`);
            }
            
            throw new Error(`Failed to send Gmail ${thread_id ? 'reply' : 'email'}: ${error.message || error}`);
        }
    },
});
