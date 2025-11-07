import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import chalk from "chalk";
import { db } from "../prismaClient";
import { FigmaCommentEvent, FigmaCommentEventData } from "../Updater/InputEvents";
import { EventProcessor } from "../agent/AutomationAgent/EventProcessor";
import { User } from "../types/prisma";
import { figma_integrations } from "@prisma/client";
import {
  fetchFileMetadata,
  parsePositioningData,
  mapCommentToDesignElements,
  extractCommentImages,
  fetchFigmaCommentFromApi,
} from "../utility/figmaUtils";
import {
  FigmaEventTypes,
  FigmaWebhookEvent,
  FigmaCommentImageUrls,
} from "../shared/types";

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
      const userInfoResponse = await fetch("https://api.figma.com/v1/me", {
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

    const supportedEventTypes = Object.values(FigmaEventTypes);

    if (!supportedEventTypes.includes(eventType as FigmaEventTypes)) {
      console.log(chalk.yellow(`⚠️  Ignoring unsupported event type ${eventType} or missing file_key`));
      res.status(200).json({ received: true });
      return;
    }

    const receivedPasscode = req.headers['x-figma-passcode'] || req.body.passcode;

    // Acknowledge immediately to prevent spamming the webhook
    res.status(200).json({ received: true });


    const integrations = await db().figma_integrations.findMany({
      where: {
        figma_webhooks: {
          some: {
            passcode: receivedPasscode,
          },
        },
      },
      include: {
        user: true,
      },
    });
    if (integrations.length === 0) {
      console.log(chalk.yellow(`⚠️  No integrations found with matching passcode`));
      return;
    }
    integrations.forEach(async (integration) => {
      if (eventType === FigmaEventTypes.FILE_COMMENT) {
        await handleFigmaCommentEvent(integration, webhookEvent, integration.user);
      }
    });
  } catch (error) {
    console.error(chalk.red("Error in handleFigmaWebhook:"), error);
  }
}

/**
 * Handle FILE_COMMENT webhook events
 * Comment data is included in the webhook payload
 * Note: client_meta is not included in webhook payload, so we fetch it from the comment API
 */
async function handleFigmaCommentEvent(
  integration: figma_integrations,
  webhookEvent: FigmaWebhookEvent,
  user: User,
) {
  // Extract comment_id from top level (Figma webhook structure)
  const commentId = webhookEvent.comment_id;
  const fileKey = webhookEvent.file_key;
  if (!commentId) {
    console.log(chalk.yellow(`⚠️  FILE_COMMENT event missing comment_id`));
    console.log(chalk.yellow(`Webhook event: ${JSON.stringify(webhookEvent, null, 2)}`));
    return;
  }
  if (!fileKey) {
    console.log(chalk.yellow(`⚠️  FILE_COMMENT event missing file_key`));
    console.log(chalk.yellow(`Webhook event: ${JSON.stringify(webhookEvent, null, 2)}`));
    return;
  }
  console.log(
    chalk.blue(`📝 Processing FILE_COMMENT event for file ${fileKey}, comment ${commentId}`)
  );

  // Process the comment once per integration, to prevent duplicate processing
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
      return;
    }
    throw error;
  }

  // Fetch comment details from Figma API to get client_meta
  // client_meta is not included in the webhook payload
  const commentFromApi = await fetchFigmaCommentFromApi(
    integration.access_token,
    fileKey,
    commentId
  );
  if (!commentFromApi) {
    console.log(chalk.yellow(`⚠️  Could not fetch comment ${commentId} from API`));
    return;
  }

  const positioningData = parsePositioningData(commentFromApi.client_meta);
  console.log(
    chalk.blue(`📍 Positioning data for comment ${commentId}:`),
    positioningData ? JSON.stringify(positioningData, null, 2) : 'null (empty client_meta)'
  );

  // Map comment to design elements using positioning data
  let matchedNodeIds: string[] = [];
  try {
    const nodeId = commentFromApi.client_meta?.node_id;
    matchedNodeIds = await mapCommentToDesignElements(
      integration.access_token,
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
  let imageUrls: FigmaCommentImageUrls = {
    nodeImage: undefined,
    fullFrame: undefined,
  };
  try {
    imageUrls = await extractCommentImages(
      integration.access_token,
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
  const imageExpiry = imageUrls.nodeImage || imageUrls.fullFrame
    ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    : null;

  // Get the closest node ID for storage
  const closestNodeId = matchedNodeIds.length > 0
    ? matchedNodeIds[0]
    : (commentFromApi.client_meta?.node_id || null);

  const fileMetadata = await fetchFileMetadata(integration.access_token, fileKey);
  if (!fileMetadata) {
    console.log(chalk.yellow(`⚠️  Could not fetch file metadata for file ${fileKey}`));
    return;
  }

  // Store enriched context for debugging
  try {
    await db().figma_comment_context.create({
      data: {
        figma_integration_id: integration.id,
        comment_id: commentId,
        file_key: fileKey,
        node_id: closestNodeId,
        comment_data: commentFromApi as any,
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

  const eventData: FigmaCommentEventData = {
    commentId: commentFromApi.id,
    fileKey: fileKey,
    fileUrl: `https://www.figma.com/file/${fileKey}`,
    nodeId: closestNodeId || undefined,
    message: commentFromApi.message,
    author: {
      id: commentFromApi.user.id,
      handle: commentFromApi.user.handle,
      img_url: commentFromApi.user.img_url,
    },
    createdAt: commentFromApi.created_at,
    resolved: commentFromApi.resolved_at !== '', // Empty string if not resolved
    fileMetadata: fileMetadata,
    positioningData: positioningData ?? undefined,
    matchedNodeIds: matchedNodeIds.length > 0 ? matchedNodeIds : undefined,
    imageUrls: Object.keys(imageUrls).length > 0 ? imageUrls : undefined,
  };
  const figmaEvent = new FigmaCommentEvent(eventData);
  const eventProcessor = new EventProcessor(figmaEvent, user);
  await eventProcessor.process();
}