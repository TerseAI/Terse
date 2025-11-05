import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import chalk from "chalk";
import { db } from "../prismaClient";
import { FigmaCommentEvent, FigmaCommentEventData } from "../Updater/InputEvents";
import { EventProcessor } from "../agent/AutomationAgent/EventProcessor";
import { User } from "../types/prisma";
import { IntegrationType } from "@prisma/client";

// Helper function to get Figma access token for a user
async function getFigmaAccessToken(userId: string): Promise<string> {
  const figmaIntegration = await db().figma_integrations.findFirst({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  if (!figmaIntegration) {
    throw new Error("Figma integration not found");
  }

  if (figmaIntegration.token_expiry && new Date() > figmaIntegration.token_expiry) {
    throw new Error("Figma access token has expired. Please re-authenticate.");
  }

  return figmaIntegration.access_token;
}

export const getFigmaOAuthUrl = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  
    try {
      // Generate state token for security (prevents CSRF)
      const state = jwt.sign(
        { userId: user.id, timestamp: Date.now() },
        process.env.JWT_SECRET!,
        { expiresIn: "10m" }
      );
  
      const clientId = process.env.FIGMA_CLIENT_ID;
      const redirectUrl = process.env.FIGMA_REDIRECT_URL;
      const scope = "current_user:read,file_comments:read,file_content:read,file_metadata:read,file_versions:read,library_assets:read,library_content:read,team_library_content:read,file_dev_resources:read,projects:read,webhooks:read,webhooks:write";
  
      if (!clientId || !redirectUrl) {
        throw new Error("Figma OAuth credentials not configured");
      }
  
      // Build OAuth URL with proper encoding
      const authUrl = new URL("https://www.figma.com/oauth");
      authUrl.searchParams.append("client_id", clientId);
      authUrl.searchParams.append("redirect_uri", redirectUrl);
      authUrl.searchParams.append("scope", scope);
      authUrl.searchParams.append("state", state);
      authUrl.searchParams.append("response_type", "code");
  
      console.log(
        chalk.blue("🔗 Generated Figma OAuth URL for user"),
        chalk.yellow(user.id)
      );
      res.json({ url: authUrl.toString() });
    } catch (error) {
      console.error(chalk.red("Error generating Figma OAuth URL:"), error);
      res.status(500).json({ error: "Failed to generate OAuth URL" });
    }
  };

  export const figmaOAuthCallback = async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
        console.error(chalk.red("Figma OAuth error:"), error);
        return res.redirect(`${process.env.FRONTEND_URL}/oauth/error`);
    }

    if (!code || !state) {
        return res.status(400).json({ error: "Missing code or state parameter" });
    }
    try {
        // Verify state token to prevent CSRF attacks
        const decoded = jwt.verify(state as string, process.env.JWT_SECRET!) as {
          userId: string;
          timestamp: number;
        };
    
        const clientId = process.env.FIGMA_CLIENT_ID;
        const clientSecret = process.env.FIGMA_CLIENT_SECRET;
        const redirectUri = process.env.FIGMA_REDIRECT_URL;
    
        if (!clientId || !clientSecret || !redirectUri) {
          throw new Error("Figma OAuth credentials not configured");
        }
    
        // Exchange authorization code for access token
        // Figma requires application/x-www-form-urlencoded format
        const params = new URLSearchParams({
          redirect_uri: redirectUri,
          code: code as string,
          grant_type: "authorization_code",
        });
    
        const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${clientId}:${clientSecret}`
            ).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });
    
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(chalk.red("Figma token exchange failed:"), errorText);
          throw new Error(`Figma token exchange failed: ${errorText}`);
        }
    
        const tokenData = await tokenResponse.json();
        const { access_token, refresh_token, expires_in, user_id_string } = tokenData;
    
        console.log(
          chalk.blue("🔑 Received Figma access token for user"),
          chalk.yellow(decoded.userId)
        );
        console.log(
          chalk.blue("👤 Figma User ID:"),
          chalk.yellow(user_id_string)
        );
        console.log(
            chalk.blue("Expires in:"),
            chalk.yellow(expires_in)
        );
        
        // Calculate token expiry
        const tokenExpiry = new Date(Date.now() + (expires_in * 1000));
        
        // Fetch user info from Figma API to get email
        let userEmail: string | null = null;
        try {
          const userInfoResponse = await fetch("https://api.figma.com/v2/me", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${access_token}`,
            },
          });
          
          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            userEmail = userInfo.email || null;
            console.log(
              chalk.blue("📧 Figma User Email:"),
              chalk.yellow(userEmail || "Not available")
            );
          }
        } catch (error) {
          console.error(chalk.yellow("⚠️  Could not fetch Figma user email (non-critical):"), error);
          // Continue without email - it's not critical
        }
    
        // Check if a connection for this Figma user already exists
        const existing = await db().figma_integrations.findFirst({
          where: {
            user_id: decoded.userId,
            figma_user_id: user_id_string,
          },
        });
    
        if (!existing) {
          await db().figma_integrations.create({
            data: {
              user_id: decoded.userId,
              figma_user_id: user_id_string,
              email: userEmail,
              access_token: access_token,
              refresh_token: refresh_token || null,
              token_expiry: tokenExpiry,
            },
          });
          console.log(
            chalk.green("✅ Created Figma connection for user"),
            chalk.yellow(decoded.userId)
          );
        } else {
          // Update existing connection with new token (in case it was revoked and re-authorized)
          await db().figma_integrations.update({
            where: { id: existing.id },
            data: {
              email: userEmail || existing.email, // Update email if we got it, otherwise keep existing
              access_token: access_token,
              refresh_token: refresh_token || null,
              token_expiry: tokenExpiry,
            },
          });
          console.log(
            chalk.green("✅ Updated Figma connection token for user"),
            chalk.yellow(decoded.userId)
          );
        }
    
        console.log(
          chalk.green("✅ Figma OAuth completed for user"),
          chalk.yellow(decoded.userId)
        );
    
        // Redirect to success page which will auto-close the popup
        res.redirect(`${process.env.FRONTEND_URL}/oauth/success`);
      } catch (error) {
        console.error(chalk.red("Error in Figma OAuth callback:"), error);
        res.redirect(`${process.env.FRONTEND_URL}/oauth/error`);
      }

  };

  export const getFigmaUserInfo = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const accessToken = await getFigmaAccessToken(user.id);

      // Make request to Figma API using OAuth Bearer token
      const response = await fetch("https://api.figma.com/v2/me", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(chalk.red("Figma API error:"), errorText);
        return res.status(response.status).json({ 
          error: "Failed to fetch user info from Figma",
          details: errorText 
        });
      }

      const userInfo = await response.json();

      console.log(
        chalk.blue("📋 Fetched Figma user info for user"),
        chalk.yellow(user.id)
      );

      res.status(200).json(userInfo);
    } catch (error: any) {
      if (error.message === "Figma integration not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes("expired")) {
        return res.status(401).json({ error: error.message });
      }
      console.error(chalk.red("Error fetching Figma user info:"), error);
      res.status(500).json({ error: "Failed to fetch Figma user info" });
    }
  };

  /**
   * Smart context fetching: Gets node context and file metadata for a comment
   * This is optimized to only fetch what's needed (not the entire file)
   */
  async function fetchCommentContext(
    accessToken: string,
    fileKey: string,
    nodeId?: string
  ): Promise<{ nodeContext?: any; fileMetadata?: any }> {
    const result: { nodeContext?: any; fileMetadata?: any } = {};

    try {
      // Always fetch file metadata (lightweight)
      const metadataResponse = await fetch(`https://api.figma.com/v2/files/${fileKey}/meta`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (metadataResponse.ok) {
        result.fileMetadata = await metadataResponse.json();
      }

      // If nodeId is provided, fetch that specific node (not the entire file)
      if (nodeId) {
        const nodeResponse = await fetch(
          `https://api.figma.com/v2/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          }
        );

        if (nodeResponse.ok) {
          const nodeData = await nodeResponse.json();
          result.nodeContext = nodeData.nodes?.[nodeId] || null;
        }
      }
    } catch (error) {
      console.error(chalk.red("Error fetching comment context:"), error);
      // Don't throw - context fetching is optional, continue without it
    }

    return result;
  }

  /**
   * Webhook handler for Figma comment events
   * POST /webhooks/figma
   */
  export const handleFigmaWebhook = async (req: Request, res: Response) => {
    console.log(
      chalk.bgMagenta.white("Figma webhook received:"),
      chalk.magentaBright(JSON.stringify(req.body, null, 2))
    );

    try {
      const webhookEvent = req.body;
      const eventType = webhookEvent.event_type;
      
      // Figma webhook payload structure (based on Figma API docs)
      // Supported event types: FILE_COMMENT (comments) and FILE_UPDATE (design changes)
      if (!['FILE_COMMENT', 'FILE_UPDATE'].includes(eventType) || !webhookEvent.file_key) {
        console.log(chalk.yellow(`⚠️  Ignoring unsupported event type ${eventType} or missing file_key`));
        res.status(200).json({ received: true });
        return;
      }

      const fileKey = webhookEvent.file_key;
      const receivedPasscode = req.headers['x-figma-passcode'] || req.body.passcode;

      // Acknowledge immediately to prevent retries
      res.status(200).json({ received: true });

      // Find all active automations that match this file_key (regardless of team_id)
      // Figma webhook events don't include team_id, so we match on file_key from automation_figma_configs
      const matchingInputs = await db().automation_inputs.findMany({
        where: {
          integration_type: IntegrationType.FIGMA,
          automation: {
            is_active: true,
          },
          figma_config: {
            file_key: fileKey,
          },
        },
        include: {
          figma_config: true,
          automation: {
            include: {
              prompt: true,
              output: {
                include: {
                  figma_config: true,
                },
              },
              user: {
                include: {
                  figma_integrations: true,
                },
              },
            },
          },
        },
      });

      if (matchingInputs.length === 0) {
        console.log(
          chalk.yellow(
            `⚠️  No active automations found for file ${fileKey}`
          )
        );
        return;
      }

      // Group automations by user/integration for processing
      const automationsToProcess: Array<{
        automationInputs: any[];
        integration: any;
      }> = [];

      // Group by user and get their Figma integration
      const userIntegrationMap = new Map<string, any>();
      
      for (const input of matchingInputs) {
        const userId = input.automation.user_id;
        
        if (!userIntegrationMap.has(userId)) {
          // Get the user's Figma integration
          const integration = await db().figma_integrations.findFirst({
            where: {
              user_id: userId,
            },
            orderBy: {
              created_at: 'desc',
            },
          });

          if (!integration) {
            console.log(chalk.yellow(`⚠️  No Figma integration found for user ${userId}`));
            continue;
          }

          userIntegrationMap.set(userId, integration);
        }

        const integration = userIntegrationMap.get(userId);
        
        // Find existing entry for this integration or create new one
        let existingEntry = automationsToProcess.find(
          entry => entry.integration.id === integration.id
        );

        if (!existingEntry) {
          existingEntry = {
            automationInputs: [],
            integration: {
              ...integration,
              user: input.automation.user,
            },
          };
          automationsToProcess.push(existingEntry);
        }

        existingEntry.automationInputs.push(input);
      }

      if (automationsToProcess.length === 0) {
        console.log(
          chalk.yellow(
            `⚠️  No active automations with valid integrations found for file ${fileKey}`
          )
        );
        return;
      }

      // Verify passcode if provided (check against any webhook for the integrations)
      if (receivedPasscode) {
        const integrationIds = automationsToProcess.map(a => a.integration.id);
        const matchingWebhook = await db().figma_webhooks.findFirst({
          where: {
            figma_integration_id: { in: integrationIds },
            passcode: receivedPasscode,
            event_type: eventType,
          },
        });

        if (!matchingWebhook) {
          console.log(chalk.red(`❌ Invalid passcode for webhook`));
          return; // Already acknowledged, just return
        }
        console.log(chalk.green(`✅ Passcode verified for webhook ${matchingWebhook.id}`));
      } else {
        console.log(chalk.yellow(`⚠️  No passcode provided in webhook request`));
      }

      // Process webhook based on event type
      if (eventType === 'FILE_COMMENT') {
        // FILE_COMMENT events contain comment data in the payload
        await handleFigmaCommentEvent(automationsToProcess, webhookEvent, fileKey);
      } else if (eventType === 'FILE_UPDATE') {
        // FILE_UPDATE events indicate design changes - fetch comments and track changes
        await handleFigmaFileUpdateEvent(automationsToProcess, webhookEvent, fileKey);
      }
    } catch (error) {
      console.error(chalk.red("Error in handleFigmaWebhook:"), error);
    }
  }
    } catch (error) {
      console.error(chalk.red("Error in handleFigmaWebhook:"), error);
    }
  }

  /**
   * Internal helper to process a Figma comment and trigger automations
   */
  async function processFigmaCommentInternal(
    integration: any,
    comment: any,
    fileKey: string,
    accessToken: string,
    automationInput: any
  ) {
    const commentId = comment.id;
    console.log(
      chalk.cyan(`New Figma comment received: ${commentId} on file ${fileKey}`)
    );

    // Fetch smart context (node + file metadata)
    const nodeId = comment.client_meta?.node_id;
    const context = await fetchCommentContext(accessToken, fileKey, nodeId);

    // Store enriched context for AI/documentation
    await db().figma_comment_context.create({
      data: {
        figma_integration_id: integration.id,
        comment_id: commentId,
        file_key: fileKey,
        node_id: nodeId || null,
        comment_data: comment,
        node_context: context.nodeContext || null,
        file_metadata: context.fileMetadata || null,
      },
    });

    // Create event data
    const eventData: FigmaCommentEventData = {
      commentId: comment.id,
      fileKey: fileKey,
      fileUrl: `https://www.figma.com/file/${fileKey}`,
      nodeId: nodeId,
      message: comment.message,
      author: {
        id: comment.user.id,
        handle: comment.user.handle || comment.user.email || "Unknown",
        img_url: comment.user.img_url,
      },
      createdAt: comment.created_at,
      resolved: comment.resolved_at !== null,
      nodeContext: context.nodeContext,
      fileMetadata: context.fileMetadata,
    };

    // Process the event through the automation system
    const figmaEvent = new FigmaCommentEvent(eventData);
    const eventProcessor = new EventProcessor(figmaEvent, integration.user as User);
    const results = await eventProcessor.process();

    // Log results
    let hasSuccess = false;
    for (const result of results) {
      if (result.success) {
        hasSuccess = true;
        console.log(
          chalk.green(
            `✅ Automation "${result.automation?.name}" triggered for comment ${commentId}`
          )
        );
      }
    }

    if (!hasSuccess) {
      console.log(
        chalk.yellow(
          `No automations matched comment ${commentId} on file ${fileKey}`
        )
      );
    }
  }

  /**
   * Handle FILE_COMMENT webhook events
   * Comment data is included in the webhook payload
   */
  async function handleFigmaCommentEvent(
    automationsToProcess: Array<{
      automationInputs: any[];
      integration: any;
    }>,
    webhookEvent: any,
    fileKey: string
  ) {
    const comment = webhookEvent.comment;
    
    if (!comment) {
      console.log(chalk.yellow(`⚠️  FILE_COMMENT event missing comment data`));
      return;
    }

    console.log(
      chalk.blue(`📝 Processing FILE_COMMENT event for file ${fileKey}, comment ${comment.id}`)
    );

    for (const { integration, automationInputs } of automationsToProcess) {
      try {
        const accessToken = integration.access_token;

        // Check if token is expired
        if (integration.token_expiry && new Date() > integration.token_expiry) {
          console.log(
            chalk.red(`❌ Token expired for integration ${integration.id}, skipping`)
          );
          continue;
        }

        const commentId = comment.id;
        
        // Check if we've already processed this comment
        const existing = await db().processed_figma_comments.findFirst({
          where: {
            figma_integration_id: integration.id,
            comment_id: commentId,
          },
        });

        if (existing) {
          console.log(chalk.blue(`ℹ️  Comment ${commentId} already processed`));
          continue;
        }

        // Mark as processed
        try {
          await db().processed_figma_comments.create({
            data: {
              figma_integration_id: integration.id,
              comment_id: commentId,
              file_key: fileKey,
            },
          });
        } catch (error: any) {
          // Race condition - comment already being processed
          if (error.code === 'P2002') {
            console.log(chalk.blue(`ℹ️  Comment ${commentId} already being processed`));
            continue;
          }
          throw error;
        }

        // Process the comment for each matching automation input
        for (const automationInput of automationInputs) {
          await processFigmaCommentInternal(integration, comment, fileKey, accessToken, automationInput);
        }
      } catch (error) {
        console.error(
          chalk.red(`❌ Error processing FILE_COMMENT for integration ${integration.id}:`),
          error
        );
      }
    }
  }

  /**
   * Handle FILE_UPDATE webhook events
   * These indicate design changes - we fetch comments to check for new ones
   */
  async function handleFigmaFileUpdateEvent(
    automationsToProcess: Array<{
      automationInputs: any[];
      integration: any;
    }>,
    webhookEvent: any,
    fileKey: string
  ) {
    console.log(
      chalk.blue(`🎨 Processing FILE_UPDATE event for file ${fileKey} (design change)`)
    );

    for (const { integration, automationInputs } of automationsToProcess) {
      try {
        const accessToken = integration.access_token;

        // Check if token is expired
        if (integration.token_expiry && new Date() > integration.token_expiry) {
          console.log(
            chalk.red(`❌ Token expired for integration ${integration.id}, skipping`)
          );
          continue;
        }

        // Fetch comments for this file to check for new ones
        const commentsResponse = await fetch(
          `https://api.figma.com/v2/files/${fileKey}/comments`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
            },
          }
        );

        if (!commentsResponse.ok) {
          console.error(
            chalk.red(`Failed to fetch comments for file ${fileKey}:`),
            await commentsResponse.text()
          );
          continue;
        }

        const commentsData = await commentsResponse.json();
        const comments = commentsData.comments || [];

          // Get the most recent processed comment timestamp to only process new ones
          const lastProcessed = await db().processed_figma_comments.findFirst({
            where: {
              figma_integration_id: integration.id,
              file_key: fileKey,
            },
            orderBy: {
              processed_at: 'desc',
            },
          });

          // Process comments (only new ones if we have a last processed timestamp)
          for (const comment of comments) {
            const commentId = comment.id;
            const commentCreatedAt = new Date(comment.created_at);

            // Skip if we've already processed this comment
            if (lastProcessed) {
              const lastProcessedAt = lastProcessed.processed_at;
              if (commentCreatedAt <= lastProcessedAt) {
                continue; // This comment is older than our last processed one
              }
            }

            // Check if we've already processed this specific comment (race condition protection)
            const existing = await db().processed_figma_comments.findFirst({
              where: {
                figma_integration_id: integration.id,
                comment_id: commentId,
              },
            });

            if (existing) {
              continue; // Already processed
            }

            // Try to mark as processed (with unique constraint to prevent race conditions)
            try {
              await db().processed_figma_comments.create({
                data: {
                  figma_integration_id: integration.id,
                  comment_id: commentId,
                  file_key: fileKey,
                },
              });
            } catch (error: any) {
              // If unique constraint fails, this comment was already processed
              if (error.code === "P2002") {
                console.log(
                  chalk.yellow(`Skipping already processed comment ${commentId}`)
                );
                continue;
              }
              throw error;
            }

            // Process the comment for each matching automation input
            for (const automationInput of automationInputs) {
              await processFigmaCommentInternal(integration, comment, fileKey, accessToken, automationInput);
            }
          }
      } catch (error) {
        console.error(
          chalk.red(`Error processing webhook for integration ${integration.id}:`),
          error
        );
        // Continue with other integrations even if one fails
      }
    }
  }