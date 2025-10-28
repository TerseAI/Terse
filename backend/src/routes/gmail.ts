import chalk from "chalk";
import crypto from "crypto";
import { Request, Response } from "express";
import { gmail_v1, google } from "googleapis";
import { GmailEvent } from "../Updater/InputEvents";
import { EventProcessor } from "../agent/AutomationAgent/EventProcessor";
import { db } from "../prismaClient";
import { GmailIntegration } from "../types/prisma";

// Validate required environment variables
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI;
const GMAIL_PUBSUB_TOPIC = process.env.GMAIL_PUBSUB_TOPIC;
const GMAIL_FRONTEND_REDIRECT = process.env.GMAIL_FRONTEND_REDIRECT;

if (!GMAIL_CLIENT_ID) {
  throw new Error("GMAIL_CLIENT_ID is not set in environment variables");
}
if (!GMAIL_CLIENT_SECRET) {
  throw new Error("GMAIL_CLIENT_SECRET is not set in environment variables");
}
if (!GMAIL_REDIRECT_URI) {
  throw new Error("GMAIL_REDIRECT_URI is not set in environment variables");
}
if (!GMAIL_PUBSUB_TOPIC) {
  throw new Error("GMAIL_PUBSUB_TOPIC is not set in environment variables");
}
if (!GMAIL_FRONTEND_REDIRECT) {
  throw new Error(
    "GMAIL_FRONTEND_REDIRECT is not set in environment variables"
  );
}

// OAuth2 scopes for Gmail
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

// Create OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  );
}

/**
 * Generate Gmail OAuth URL
 */
export async function getGmailOAuthUrl(req: Request, res: Response) {
  console.log("getGmailOAuthUrl route hit");

  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const oauth2Client = getOAuth2Client();

    // Generate state for security (include user ID)
    const state = Buffer.from(
      JSON.stringify({
        userId: req.session.user.id,
        random: crypto.randomBytes(16).toString("hex"),
      })
    ).toString("base64");

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Get refresh token
      scope: SCOPES,
      state: state,
      prompt: "consent", // Force consent screen to get refresh token
    });

    res.json({ url: authUrl });
  } catch (error) {
    console.error("Error generating Gmail OAuth URL:", error);
    res.status(500).json({ error: "Failed to generate OAuth URL" });
  }
}

/**
 * Handle Gmail OAuth callback
 */
export async function gmailCallback(req: Request, res: Response) {
  const { code, state } = req.query as { code?: string; state?: string };

  console.log("Gmail OAuth callback received");

  if (!code || !state) {
    return res.status(400).send("Invalid OAuth state");
  }

  try {
    // Decode state to get user ID
    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const userId = stateData.userId;

    if (!userId) {
      return res.status(400).send("Invalid state: missing user ID");
    }

    const oauth2Client = getOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.access_token || !tokens.refresh_token) {
      return res.status(400).send("Failed to obtain tokens");
    }

    // Get user's email address
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const emailAddress = profile.data.emailAddress;

    if (!emailAddress) {
      return res.status(400).send("Failed to get email address");
    }

    // Set up Gmail watch
    const watchResponse = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: GMAIL_PUBSUB_TOPIC,
        labelIds: ["INBOX"],
      },
    });

    const historyId = watchResponse.data.historyId;
    const expiration = watchResponse.data.expiration;

    if (!historyId || !expiration) {
      return res.status(500).send("Failed to set up Gmail watch");
    }

    // Calculate token expiry
    const tokenExpiry = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    // Store in database and set is_active to true
    await db().gmail_integrations.upsert({
      where: {
        user_id_email: {
          user_id: userId,
          email: emailAddress,
        },
      },
      create: {
        user_id: userId,
        email: emailAddress,
        history_id: historyId,
        watch_expiration: new Date(parseInt(expiration)),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokenExpiry,
        is_active: true,
        last_processed_message_date: new Date(), // Set initial date to prevent processing historical messages
      },
      update: {
        history_id: historyId,
        watch_expiration: new Date(parseInt(expiration)),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokenExpiry,
        is_active: true, // Reactivate if it was previously disabled
        // Don't reset last_processed_message_date on reactivation - preserve existing value
      },
    });

    console.log(`Gmail integration activated for ${emailAddress}`);

    // Redirect to frontend
    res.redirect(GMAIL_FRONTEND_REDIRECT || "");
  } catch (error) {
    console.error("Gmail OAuth error:", error);
    res.status(500).send("Authentication failed");
  }
}

/**
 * Disable Gmail integration (set is_active to false)
 */
export async function deleteGmailIntegration(req: Request, res: Response) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get the active integration
    const integration = await db().gmail_integrations.findFirst({
      where: {
        user_id: req.session.user.id,
        is_active: true,
      },
    });

    if (!integration) {
      return res
        .status(404)
        .json({ error: "No active Gmail integration found" });
    }

    // Set up OAuth client with stored credentials
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date: integration.token_expiry.getTime(),
    });

    try {
      // Stop the Gmail watch
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      await gmail.users.stop({ userId: "me" });
      console.log(`Gmail watch stopped for ${integration.email}`);
    } catch (stopError) {
      // Log but don't fail the deactivation if watch stop fails
      // (watch might already be expired or stopped)
      console.warn("Error stopping Gmail watch:", stopError);
    }

    // Clean up automation inputs/outputs that reference this Gmail integration
    await db().automation_inputs.deleteMany({
      where: {
        integration_type: "GMAIL",
        integration_id: integration.id,
      },
    });

    await db().automation_outputs.deleteMany({
      where: {
        integration_type: "GMAIL",
        integration_id: integration.id,
      },
    });

    // Set is_active to false instead of deleting
    await db().gmail_integrations.update({
      where: { id: integration.id },
      data: { is_active: false },
    });

    console.log(
      `Gmail integration deactivated for user ${req.session.user.id}`
    );
    res.json({ message: "Gmail integration disabled successfully" });
  } catch (error) {
    console.error("Error disabling Gmail integration:", error);
    res.status(500).json({ error: "Failed to disable Gmail integration" });
  }
}

/**
 * Refresh access token if expired
 */
async function refreshAccessTokenIfNeeded(
  integration: GmailIntegration
): Promise<string> {
  const now = new Date();

  // Check if token is expired or will expire in the next 5 minutes
  if (
    integration.token_expiry &&
    integration.token_expiry <= new Date(now.getTime() + 5 * 60 * 1000)
  ) {
    console.log("Access token expired or expiring soon, refreshing...");

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: integration.refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    const newTokenExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Update the database with new tokens
    await db().gmail_integrations.update({
      where: { id: integration.id },
      data: {
        access_token: credentials.access_token!,
        token_expiry: newTokenExpiry,
      },
    });

    console.log("Access token refreshed successfully");

    return credentials.access_token!;
  }

  return integration.access_token;
}

/**
 * Fetch new message IDs from Gmail history
 */
async function fetchNewMessageIds(
  integration: GmailIntegration,
  oldHistoryId: string
): Promise<string[]> {
  // Refresh token if needed
  const accessToken = await refreshAccessTokenIfNeeded(integration);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: integration.refresh_token,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  console.log(`Fetching Gmail history from ${oldHistoryId}`);

  const historyResponse = await gmail.users.history.list({
    userId: "me",
    startHistoryId: oldHistoryId,
    historyTypes: ["messageAdded"],
  });

  const history = historyResponse.data.history || [];

  if (history.length === 0) {
    console.log("No new messages in history");
    return [];
  }

  // Extract message IDs from history
  const messageIds: string[] = [];
  for (const record of history) {
    if (record.messagesAdded) {
      for (const added of record.messagesAdded) {
        if (added.message?.id) {
          messageIds.push(added.message.id);
        }
      }
    }
  }

  console.log(`Found ${messageIds.length} new messages`);

  return messageIds;
}

/**
 * Parse email message to extract useful information
 */
export interface GmailEventData {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string; // Header date string (for display)
  internalDate: string; // Gmail's internal timestamp (milliseconds since epoch)
  messageId: string;
  body: string;
  snippet: string;
}

async function fetchAndParseEmail(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<GmailEventData | null> {
  try {
    const messageResponse = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = messageResponse.data;
    const headers = message.payload?.headers || [];

    const getHeader = (name: string) => {
      const header = headers.find(
        (h) => h.name?.toLowerCase() === name.toLowerCase()
      );
      return header?.value || "";
    };

    const subject = getHeader("Subject");
    const from = getHeader("From");
    const to = getHeader("To");
    const date = getHeader("Date");
    const messageIdHeader = getHeader("Message-ID");

    // Extract body - Gmail can have different structures
    const getBody = (payload: gmail_v1.Schema$MessagePart): string => {
      if (payload.body?.data) {
        return Buffer.from(payload.body.data, "base64").toString("utf-8");
      }

      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === "text/plain" && part.body?.data) {
            return Buffer.from(part.body.data, "base64").toString("utf-8");
          }

          // Recursively check nested parts
          const nestedBody = getBody(part);
          if (nestedBody) {
            return nestedBody;
          }
        }
      }

      return "";
    };

    const body = getBody(message.payload || {});

    return {
      id: message.id || messageId,
      threadId: message.threadId || "",
      subject,
      from,
      to,
      date,
      internalDate: message.internalDate || "", // Unix timestamp in milliseconds
      messageId: messageIdHeader,
      body,
      snippet: message.snippet || "",
    };
  } catch (error: any) {
    // 404 errors are expected - messages can be deleted/moved before we fetch them
    if (
      error?.code === 404 ||
      error?.message?.includes("Requested entity was not found")
    ) {
      console.log(
        chalk.gray(`Message ${messageId} not found (likely deleted or moved)`)
      );
    } else {
      // Log other errors as actual errors
      console.error(`Error fetching message ${messageId}:`, error);
    }
    return null;
  }
}

/**
 * Webhook handler for Gmail Pub/Sub notifications
 */

// TODO: Might be worth building a summary of the entire thread for added context of the current event.

type GmailWebhookData = {
  emailAddress: string;
  historyId: number;
};
export async function handleGmailWebhook(req: Request, res: Response) {
  console.log(
    chalk.bgMagenta.white("Gmail webhook received:"),
    chalk.magentaBright(JSON.stringify(req.body, null, 2))
  );

  try {
    const { message } = req.body;

    if (!message || !message.data) {
      return res.status(400).send("Invalid message format");
    }

    // Decode the message data
    const decoded: GmailWebhookData = JSON.parse(
      Buffer.from(message.data, "base64").toString()
    );

    const emailAddress: string = decoded.emailAddress; // EMAIL of the user who gave permission to read emails!
    const newHistoryId: number = decoded.historyId;
    const newHistoryIdString: string = newHistoryId.toString();

    console.log(
      `Gmail notification for ${emailAddress}, historyId: ${newHistoryId}`
    );

    // Look up active integration by email
    const integration = await db().gmail_integrations.findFirst({
      where: {
        email: emailAddress,
        is_active: true,
      },
    });

    if (!integration) {
      console.log("No active integration found for email:", emailAddress);
      return res.status(200).send("OK");
    }

    const user = await db().users.findUnique({
      where: {
        id: integration.user_id,
      },
    });

    if (!user) {
      console.log("No user found for integration:", integration.user_id);
      return res.status(200).send("OK");
    }

    const oldHistoryId = integration.history_id;

    // Fetch new message IDs from history
    try {
      const messageIds = await fetchNewMessageIds(integration, oldHistoryId);

      if (messageIds.length > 0) {
        // Refresh token and set up Gmail client
        const accessToken = await refreshAccessTokenIfNeeded(integration);
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: integration.refresh_token,
        });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const lastProcessedDate: Date | null =
          integration.last_processed_message_date;
        let mostRecentEmailDate: Date | null = lastProcessedDate;

        // Fetch and parse each email
        for (const messageId of messageIds) {
          const parsedEmail: GmailEventData | null = await fetchAndParseEmail(
            gmail,
            messageId
          );

          if (parsedEmail) {
            // Parse the email timestamp - internalDate is milliseconds since epoch as a string
            const emailTimestamp = parseInt(parsedEmail.internalDate, 10);
            const emailDate = new Date(emailTimestamp);

            // Skip messages older than the last processed message date
            // This prevents reprocessing old messages in threads when new replies arrive
            if (lastProcessedDate && emailDate <= lastProcessedDate) {
              console.log(
                chalk.gray(
                  `Skipping old message ${
                    parsedEmail.id
                  } from ${emailDate.toISOString()}`
                )
              );
              console.log(chalk.gray(`  Subject: ${parsedEmail.subject}`));

              // Still mark it as processed to avoid checking it again
              try {
                await db().processed_gmail_messages.create({
                  data: {
                    gmail_integration_id: integration.id,
                    gmail_message_id: parsedEmail.id,
                    internal_date: parsedEmail.internalDate,
                  },
                });
              } catch (error: any) {
                // Ignore duplicate key errors - message already marked as processed
                if (error.code !== "P2002") {
                  throw error;
                }
              }
              continue;
            }

            // Try to mark this message as processed atomically
            // The unique constraint will prevent duplicate processing even in race conditions
            try {
              await db().processed_gmail_messages.create({
                data: {
                  gmail_integration_id: integration.id,
                  gmail_message_id: parsedEmail.id,
                  internal_date: parsedEmail.internalDate,
                },
              });
            } catch (error: any) {
              // If unique constraint fails, this message was already processed
              if (error.code === "P2002") {
                console.log(
                  chalk.yellow(
                    `Skipping already processed message ${parsedEmail.id}`
                  )
                );
                console.log(chalk.yellow(`  Subject: ${parsedEmail.subject}`));
                continue;
              }
              // Re-throw other errors
              throw error;
            }

            console.log(chalk.cyan("New email received:"));
            console.log(chalk.cyan(`  Subject: ${parsedEmail.subject}`));
            console.log(chalk.cyan(`  From: ${parsedEmail.from}`));
            console.log(chalk.cyan(`  Date: ${emailDate.toISOString()}`));
            console.log(chalk.cyan(`  Snippet: ${parsedEmail.snippet}`));

            const eventProcessor = new EventProcessor(
              new GmailEvent(parsedEmail),
              user
            );
            const result = await eventProcessor.process();

            if (result.success) {
              console.log(chalk.green("Email processed successfully"));
              console.log(chalk.green("Automation:", result.automation?.name));

              // Track the most recent email date
              if (!mostRecentEmailDate || emailDate > mostRecentEmailDate) {
                mostRecentEmailDate = emailDate;
              }
            } else {
              console.log(
                chalk.red("Email processing failed:", result.message)
              );
            }
          }
        }

        // Update the last processed message date if we processed any emails
        if (mostRecentEmailDate && mostRecentEmailDate !== lastProcessedDate) {
          await db().gmail_integrations.update({
            where: { id: integration.id },
            data: { last_processed_message_date: mostRecentEmailDate },
          });
          console.log(
            chalk.green(
              `Updated last processed message date to ${mostRecentEmailDate.toISOString()}`
            )
          );
        }
      }
    } catch (error) {
      console.error("Error fetching/processing emails:", error);
      // Continue to update history ID even if processing fails
    }

    // Update the history ID
    await db().gmail_integrations.update({
      where: { id: integration.id },
      data: { history_id: newHistoryIdString },
    });

    console.log(`Updated history ID for ${emailAddress}`);

    res.status(200).send("OK");
  } catch (error) {
    console.error("Gmail webhook error:", error);
    res.status(500).send("Webhook processing failed");
  }
}

export default {
  getGmailOAuthUrl,
  gmailCallback,
  deleteGmailIntegration,
  handleGmailWebhook,
};
