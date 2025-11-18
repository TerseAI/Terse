import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import chalk from "chalk";
import { db } from "../prismaClient";
import { figma as figmaConfig, jwt as jwtConfig, urls } from "../config/settings";
import { FigmaIntegrationManager, FigmaWebhookEvent } from "../integrations/FigmaIntegration";
import { FigmaEventTypes } from "../shared/types";

// MARK: - Route Handlers

/**
 * Generate Figma OAuth URL for user authorization
 */
export const getFigmaOAuthUrl = async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Generate state token for security (prevents CSRF)
    const state = jwt.sign(
      { userId: user.id, timestamp: Date.now() },
      jwtConfig.secret,
      { expiresIn: "10m" }
    );

    const scope = "current_user:read,file_comments:read,file_content:read,file_metadata:read,file_versions:read,library_assets:read,library_content:read,team_library_content:read,file_dev_resources:read,projects:read,webhooks:read,webhooks:write";

    // Build OAuth URL with proper encoding
    const authUrl = new URL("https://www.figma.com/oauth");
    authUrl.searchParams.append("client_id", figmaConfig.clientId);
    authUrl.searchParams.append("redirect_uri", figmaConfig.redirectUrl);
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

/**
 * Handle Figma OAuth callback
 */
export const figmaOAuthCallback = async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error(chalk.red("Figma OAuth error:"), error);
    return res.redirect(`${urls.frontend}/oauth/error`);
  }

  if (!code || !state) {
    return res.status(400).json({ error: "Missing code or state parameter" });
  }
  try {
    // Verify state token to prevent CSRF attacks
    const decoded = jwt.verify(state as string, jwtConfig.secret) as {
      userId: string;
      timestamp: number;
    };

    // Exchange authorization code for access token
    // Figma requires application/x-www-form-urlencoded format
    const params = new URLSearchParams({
      redirect_uri: figmaConfig.redirectUrl,
      code: code as string,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${figmaConfig.clientId}:${figmaConfig.clientSecret}`
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
    res.redirect(`${urls.frontend}/oauth/success`);
  } catch (error) {
    console.error(chalk.red("Error in Figma OAuth callback:"), error);
    res.redirect(`${urls.frontend}/oauth/error`);
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
    const webhookEvent = req.body as FigmaWebhookEvent;
    const eventType = webhookEvent.event_type;

    const supportedEventTypes = Object.values(FigmaEventTypes);

    if (!supportedEventTypes.includes(eventType as FigmaEventTypes)) {
      console.log(chalk.yellow(`⚠️  Ignoring unsupported event type ${eventType} or missing file_key`));
      res.status(200).json({ received: true });
      return;
    }

    // Acknowledge immediately to prevent spamming the webhook
    res.status(200).json({ received: true });

    // Process the event asynchronously
    const figmaIntegrationManager = new FigmaIntegrationManager();
    figmaIntegrationManager.processWebhookEvent(webhookEvent).catch((error) => {
      console.error(chalk.red('Error processing Figma webhook event:'), error);
    });
  } catch (error) {
    console.error(chalk.red("Error in handleFigmaWebhook:"), error);
  }
};
