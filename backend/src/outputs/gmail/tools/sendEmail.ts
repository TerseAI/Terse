import { tool, RunContext } from "@openai/agents";
import { z } from "zod";
import { google } from "googleapis";
import { db } from "../../../prismaClient";
import { GmailSession } from "../GmailOutput";
import logger from "../../../logger";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { getOAuth2Client } from "../../../integrations/GmailIntegration";

/**
 * Tool for sending emails or replying to email threads via Gmail.
 * Supports both sending new emails and replying to existing threads.
 */
export const gmailSendEmailTool = tool({
    name: "gmail_send_email",
    description: `Send email or reply to an existing email thread via Gmail. Use thread_id to reply to an existing thread, or omit it to send a new email.`,
    parameters: z.object({
        to: z.string().describe("Recipient email address(es). Multiple addresses can be comma-separated."),
        subject: z.string().describe("Email subject line"),
        body: z.string().describe("Email body content (plain text)"),
        thread_id: z.string().nullable().optional().describe("Gmail thread ID to reply to. Omit for new emails."),
        cc: z.string().nullable().optional().describe("CC recipient email address(es). Multiple addresses can be comma-separated."),
        bcc: z.string().nullable().optional().describe("BCC recipient email address(es). Multiple addresses can be comma-separated."),
    }),
    execute: async (args, runContext?: RunContext<SessionWithTracking<GmailSession>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }
        const session = runContext.context;
        
        if (!session.gmailIntegration || !session.gmailConfig) {
            throw new Error("Gmail session is not properly configured");
        }

        const { to, subject, body, thread_id, cc, bcc } = args;

        if (!to || !subject || !body) {
            throw new Error("to, subject, and body are required");
        }

        try {
            // Get access token (will refresh if needed)
            const gmailIntegrationManager = await import("../../../integrations/GmailIntegration").then(m => new m.GmailIntegrationManager());
            const accessToken = await gmailIntegrationManager.getAccessToken(session.gmailIntegration.id);

            if (!accessToken) {
                throw new Error("Failed to get Gmail access token");
            }

            // Set up OAuth2 client
            const oauth2Client = getOAuth2Client();
            oauth2Client.setCredentials({
                access_token: accessToken,
                refresh_token: session.gmailIntegration.refresh_token,
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
                        const originalMessage = messages[0];
                        const originalHeaders = originalMessage.payload?.headers || [];
                        
                        const getHeader = (name: string) => {
                            const header = originalHeaders.find(
                                (h) => h.name?.toLowerCase() === name.toLowerCase()
                            );
                            return header?.value || "";
                        };

                        const originalMessageId = getHeader('Message-ID');
                        const originalReferences = getHeader('References');
                        const originalInReplyTo = getHeader('In-Reply-To');

                        // Build References header (includes all previous message IDs)
                        const references = originalReferences 
                            ? `${originalReferences} ${originalMessageId}`
                            : (originalInReplyTo || originalMessageId);

                        if (references) {
                            headers.push(`References: ${references}`);
                        }

                        if (originalMessageId) {
                            headers.push(`In-Reply-To: ${originalMessageId}`);
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
            
            // Build Gmail message URL
            const gmailUrl = thread_id
                ? `https://mail.google.com/mail/u/0/#inbox/${thread_id}`
                : `https://mail.google.com/mail/u/0/#inbox/${messageId}`;
            
            // Track the action
            runContext.context.trackAction({
                action: `Sent Gmail ${emailType}`,
                integration: IntegrationType.GMAIL,
                target: to,
                details: `Sent ${emailType} to ${to}: "${subject}" - ${emailPreview}`,
                url: gmailUrl,
                type: RunHistoryActionType.create,
            });
            
            logger.info(`[Gmail Output] ${emailType} sent`, { 
                messageId,
                threadId: thread_id,
                to,
                subject,
                integrationId: session.gmailIntegration.id,
            });

            return {
                success: true,
                message_id: messageId,
                thread_id: thread_id || result.data.threadId || messageId,
                to,
                subject,
                summary: `${emailType} sent to ${to}: "${subject}"`,
                is_reply: !!thread_id,
            };
        } catch (error: any) {
            logger.error(`[Gmail Output] Failed to send email`, { 
                error,
                to,
                subject,
                thread_id,
                integrationId: session.gmailIntegration.id,
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
