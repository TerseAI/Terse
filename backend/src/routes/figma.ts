import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import chalk from "chalk";
import { db } from "../prismaClient";
import { FigmaCommentEvent, FigmaCommentEventData } from "../Updater/InputEvents";
import { EventProcessor } from "../agent/AutomationAgent/EventProcessor";
import { User } from "../types/prisma";
import { IntegrationType } from "@prisma/client";
import {
  getFigmaAccessToken,
  fetchFileMetadata,
  parsePositioningData,
  mapCommentToDesignElements,
  extractCommentImages,
} from "../utility/figmaUtils";

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
      if (!['FILE_COMMENT'].includes(eventType) || !webhookEvent.file_key) {
        console.log(chalk.yellow(`⚠️  Ignoring unsupported event type ${eventType} or missing file_key`));
        res.status(200).json({ received: true });
        return;
      }

      const fileKey = webhookEvent.file_key;
      const receivedPasscode = req.headers['x-figma-passcode'] || req.body.passcode;

      // Acknowledge immediately to prevent spamming the webhook
      res.status(200).json({ received: true });

      /**
       * All automation inputs who:
       * - integration_type is Figma
       * - automation is active
       * - figma_config.file_key matches the webhook file_key
       */
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
                  figma_integrations: {
                    include: {
                      figma_webhooks: true,
                    },
                  },
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

      // We need to find at least one webhook with the same passcode
      // as the one received in order to proceed

      const inputsWithMatchingPasscode = []
      for (const input of matchingInputs) {
        const figmaIntegrations = input.automation.user.figma_integrations
        const matchingWebhook = figmaIntegrations.find(integration => integration.figma_webhooks.some(webhook => webhook.passcode === receivedPasscode))
        if (matchingWebhook) {
          inputsWithMatchingPasscode.push(input)
        }
      }
      if (inputsWithMatchingPasscode.length === 0) {
        console.log(chalk.yellow(`⚠️  No matching passcode found for any webhook`));
        return;
      }
      console.log(chalk.green(`✅ Found ${inputsWithMatchingPasscode.length} inputs with matching passcode`));

      // Process webhook based on event type
      if (eventType === 'FILE_COMMENT') {
        for (const input of inputsWithMatchingPasscode) {
          processFigmaCommentInternal(
            input.id,
            input.automation.user,
            webhookEvent.comment,
            fileKey,
            input.automation.user.figma_integrations[0].access_token,
          );
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
    integrationId: string,
    user: User,
    comment: any,
    fileKey: string,
    accessToken: string,
  ) {
    const commentId = comment.id;
    console.log(
      chalk.cyan(`New Figma comment received: ${commentId} on file ${fileKey}`)
    );

    // Fetch file metadata
    const fileMetadata = await fetchFileMetadata(accessToken, fileKey);

    // Extract and parse positioning data
    const positioningData = parsePositioningData(comment.client_meta);
    console.log(
      chalk.blue(`📍 Positioning data for comment ${commentId}:`),
      positioningData ? JSON.stringify(positioningData, null, 2) : 'null (empty client_meta)'
    );

    // Map comment to design elements using positioning data
    let matchedNodeIds: string[] = [];
    try {
      const nodeId = comment.client_meta?.node_id;
      matchedNodeIds = await mapCommentToDesignElements(
        accessToken,
        fileKey,
        positioningData,
        nodeId
      );
      console.log(
        chalk.blue(`🎯 Matched ${matchedNodeIds.length} node(s) for comment ${commentId}:`),
        matchedNodeIds.length > 0 ? matchedNodeIds.join(', ') : 'none'
      );
    } catch (error) {
      console.error(
        chalk.red(`Error mapping comment ${commentId} to design elements:`),
        error
      );
      // Continue with empty array if mapping fails
    }

    // Extract images for visual context
    let imageUrls: {
      nodeImage?: string;
      contextImage?: string;
      fullFrame?: string;
    } = {};
    try {
      imageUrls = await extractCommentImages(
        accessToken,
        fileKey,
        matchedNodeIds,
        positioningData
      );
      console.log(
        chalk.blue(`🖼️  Extracted images for comment ${commentId}:`),
        Object.keys(imageUrls).length > 0 
          ? `${Object.keys(imageUrls).length} image(s) extracted` 
          : 'no images extracted'
      );
    } catch (error) {
      console.error(
        chalk.red(`Error extracting images for comment ${commentId}:`),
        error
      );
      // Continue with empty object if image extraction fails
    }

    // Calculate image expiry (24 hours from now)
    const imageExpiry = imageUrls.nodeImage || imageUrls.contextImage || imageUrls.fullFrame
      ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      : null;

    // Get the closest node ID for storage
    const closestNodeId = matchedNodeIds.length > 0 
      ? matchedNodeIds[0] 
      : (comment.client_meta?.node_id || null);

    // Store enriched context for AI/documentation
    try {
      await db().figma_comment_context.create({
        data: {
          figma_integration_id: integrationId,
          comment_id: commentId,
          file_key: fileKey,
          node_id: closestNodeId,
          comment_data: comment,
          file_metadata: fileMetadata ? JSON.parse(JSON.stringify(fileMetadata)) : null,
          positioning_data: positioningData ? JSON.parse(JSON.stringify(positioningData)) : null,
          matched_node_ids: matchedNodeIds,
          image_urls: Object.keys(imageUrls).length > 0 ? JSON.parse(JSON.stringify(imageUrls)) : null,
          image_expiry: imageExpiry,
        },
      });
      console.log(
        chalk.green(`✅ Stored enriched context for comment ${commentId}`),
        chalk.gray(`- Positioning: ${positioningData ? positioningData.type : 'none'}, Nodes: ${matchedNodeIds.length}, Images: ${Object.keys(imageUrls).length}`)
      );
    } catch (error) {
      console.error(
        chalk.red(`❌ Error storing enriched context for comment ${commentId}:`),
        error
      );
      // Don't throw - continue processing even if storage fails
    }

    // Create event data with enriched context
    const eventData: FigmaCommentEventData = {
      commentId: comment.id,
      fileKey: fileKey,
      fileUrl: `https://www.figma.com/file/${fileKey}`,
      nodeId: closestNodeId || undefined,
      message: comment.message,
      author: {
        id: comment.user.id,
        handle: comment.user.handle || comment.user.email || "Unknown",
        img_url: comment.user.img_url,
      },
      createdAt: comment.created_at,
      resolved: comment.resolved_at !== null,
      fileMetadata: fileMetadata,
      positioningData: positioningData ? {
        type: positioningData.type as 'Vector' | 'FrameOffset' | 'Region' | 'FrameOffsetRegion',
        data: positioningData.data
      } : undefined,
      matchedNodeIds: matchedNodeIds.length > 0 ? matchedNodeIds : undefined,
      imageUrls: Object.keys(imageUrls).length > 0 ? imageUrls : undefined,
    };

    // Process the event through the automation system
    const figmaEvent = new FigmaCommentEvent(eventData);
    const eventProcessor = new EventProcessor(figmaEvent, user);
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
   * Note: client_meta is not included in webhook payload, so we fetch it from the comment API
   */
  async function handleFigmaCommentEvent(
    integration: any,
    webhookEvent: any,
    fileKey: string
  ) {
    // Extract comment_id from top level (Figma webhook structure)
    const commentId = webhookEvent.comment_id;
    
    if (!commentId) {
      console.log(chalk.yellow(`⚠️  FILE_COMMENT event missing comment_id`));
      console.log(chalk.yellow(`Webhook event: ${JSON.stringify(webhookEvent, null, 2)}`));
      return;
    }

    console.log(
      chalk.blue(`📝 Processing FILE_COMMENT event for file ${fileKey}, comment ${commentId}`)
    );

    // Fetch comment details from Figma API once to get client_meta
    // client_meta is not included in the webhook payload
    // Use the first valid integration's token to fetch the comment
    let commentFromApi: any = null;
    for (const { integration } of integrations) {

      try {
        const commentsResponse = await fetch(
          `https://api.figma.com/v1/files/${fileKey}/comments`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${integration.access_token}`,
            },
          }
        );

        if (!commentsResponse.ok) {
          console.error(
            chalk.yellow(`Failed to fetch comments for file ${fileKey} with integration ${integration.id}:`),
            await commentsResponse.text()
          );
          continue; // Try next integration
        }

        const commentsData = await commentsResponse.json();
        const comments = commentsData.comments || [];
        
        // Find the comment with matching ID
        commentFromApi = comments.find((c: any) => c.id === commentId);
        
        if (commentFromApi) {
          console.log(
            chalk.green(`✅ Fetched comment ${commentId} from API with client_meta`)
          );
          break; // Successfully fetched, no need to try other integrations
        } else {
          console.log(
            chalk.yellow(`⚠️  Comment ${commentId} not found in API response`)
          );
        }
      } catch (error) {
        console.error(
          chalk.yellow(`⚠️  Error fetching comment from API with integration ${integration.id}:`),
          error
        );
        // Continue to try next integration
      }
    }

    if (!commentFromApi) {
      console.log(
        chalk.yellow(`⚠️  Could not fetch comment ${commentId} from API, using webhook data only`)
      );
    }

    // Build normalized comment object, preferring API data over webhook data
    // Use API data if available (has client_meta), otherwise fall back to webhook data
    const commentText = commentFromApi?.message 
      || (webhookEvent.comment && Array.isArray(webhookEvent.comment) && webhookEvent.comment.length > 0
        ? webhookEvent.comment[0].text
        : '');
    
    // Handle resolved_at - Figma sends empty string for unresolved comments
    const resolvedAt = commentFromApi?.resolved_at 
      || (webhookEvent.resolved_at && webhookEvent.resolved_at.trim() !== ''
        ? webhookEvent.resolved_at
        : null);
    
    const normalizedComment = {
      id: commentId,
      message: commentText,
      created_at: commentFromApi?.created_at || webhookEvent.created_at,
      resolved_at: resolvedAt,
      user: commentFromApi?.user || webhookEvent.triggered_by || {
        id: '',
        handle: '',
        email: '',
        img_url: ''
      },
      client_meta: commentFromApi?.client_meta || webhookEvent.client_meta || {}
    };


    for (const input of inputs) {
      try {
        const accessToken = integration.access_token;


        
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
        

        // Process the comment once per integration (EventProcessor will find all matching automations)
        await processFigmaCommentInternal(integration, normalizedComment, fileKey, accessToken);
      } catch (error) {
        console.error(
          chalk.red(`❌ Error processing FILE_COMMENT for integration ${integration.id}:`),
          error
        );
      }
    }
  }