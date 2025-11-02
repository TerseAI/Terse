import { Client } from "@notionhq/client";
import chalk from "chalk";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../prismaClient";
import { NotionDatabase, NotionDatabasesResponse } from "../shared/types";

// OAuth Functions

export const getNotionOAuthUrl = async (req: Request, res: Response) => {
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

    const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
    const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error("Notion OAuth credentials not configured");
    }

    // Build OAuth URL with proper encoding
    const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("owner", "user");
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("state", state);

    console.log(
      chalk.blue("🔗 Generated Notion OAuth URL for user"),
      chalk.yellow(user.id)
    );
    res.json({ url: authUrl.toString() });
  } catch (error) {
    console.error(chalk.red("Error generating Notion OAuth URL:"), error);
    res.status(500).json({ error: "Failed to generate OAuth URL" });
  }
};

export const notionOAuthCallback = async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error(chalk.red("Notion OAuth error:"), error);
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

    // Exchange authorization code for access token
    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.NOTION_OAUTH_CLIENT_ID}:${process.env.NOTION_OAUTH_CLIENT_SECRET}`
        ).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.NOTION_OAUTH_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(chalk.red("Notion token exchange failed:"), errorText);
      throw new Error(`Notion token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, workspace_id, workspace_name } = tokenData;

    console.log(
      chalk.blue("🔑 Received Notion access token for user"),
      chalk.yellow(decoded.userId)
    );
    console.log(
      chalk.blue("🏢 Workspace:"),
      chalk.yellow(workspace_name || workspace_id)
    );

    // Fetch available databases
    const notionClient = new Client({ auth: access_token });
    const databasesResponse = await notionClient.search({
      filter: { property: "object", value: "database" },
      page_size: 100,
    });

    const databases: NotionDatabase[] = databasesResponse.results.map(
      (db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || "Untitled Database",
        url: db.url,
      })
    );

    console.log(
      chalk.blue(`📊 Found ${databases.length} databases for user`),
      chalk.yellow(decoded.userId)
    );

    if (databases.length === 0) {
      console.error(
        chalk.red("No databases found for user"),
        chalk.yellow(decoded.userId)
      );
      return res.redirect(`${process.env.FRONTEND_URL}/oauth/error`);
    }

    // Create ONE connection with the first database as default
    // Users can select different databases per automation via automation_notion_configs
    const defaultDatabase = databases[0];
    
    // Check if a connection for this workspace already exists
    const existing = await db().notion_integrations.findFirst({
      where: {
        user_id: decoded.userId,
        workspace_id: workspace_id || null,
      },
    });

    if (!existing) {
      await db().notion_integrations.create({
        data: {
          user_id: decoded.userId,
          workspace_id: workspace_id || null,
          workspace_name: workspace_name || null,
          database_id: defaultDatabase.id,
          database_name: defaultDatabase.title,
          integration_token: access_token,
        },
      });
      console.log(
        chalk.green("✅ Created Notion connection:"),
        chalk.yellow(`${workspace_name || "Workspace"} (default: ${defaultDatabase.title})`)
      );
      console.log(
        chalk.blue(`📊 ${databases.length} databases available for this connection`)
      );
    } else {
      // Update existing connection with new token (in case it was revoked and re-authorized)
      await db().notion_integrations.update({
        where: { id: existing.id },
        data: {
          integration_token: access_token,
          // Update default database if not set
          database_id: existing.database_id || defaultDatabase.id,
          database_name: existing.database_name || defaultDatabase.title,
        },
      });
      console.log(
        chalk.green("✅ Updated Notion connection token"),
        chalk.yellow(`${workspace_name || "Workspace"}`)
      );
    }

    console.log(
      chalk.green("✅ Notion OAuth completed for user"),
      chalk.yellow(decoded.userId)
    );

    // Redirect to success page which will auto-close the popup
    res.redirect(`${process.env.FRONTEND_URL}/oauth/success`);
  } catch (error) {
    console.error(chalk.red("Error in Notion OAuth callback:"), error);
    res.redirect(`${process.env.FRONTEND_URL}/oauth/error`);
  }
};

// Fetch available databases for a Notion connection
export const getNotionDatabases = async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const integrationId = req.query.integrationId as string;
  if (!integrationId) {
    return res.status(400).json({ error: "integrationId is required" });
  }

  try {
    // Verify user owns this integration
    const integration = await db().notion_integrations.findFirst({
      where: {
        id: integrationId,
        user_id: user.id,
      },
    });

    if (!integration) {
      return res.status(404).json({ error: "Notion integration not found" });
    }

    // Fetch databases from Notion API
    const notionClient = new Client({ auth: integration.integration_token });
    const databasesResponse = await notionClient.search({
      filter: { property: "object", value: "database" },
      page_size: 100,
    });

    const databases: NotionDatabase[] = databasesResponse.results.map(
      (db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || "Untitled Database",
        url: db.url,
      })
    );

    const response: NotionDatabasesResponse = {
      databases,
      selectedDatabaseId: integration.database_id,
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error(chalk.red("Error fetching Notion databases:"), error);
    res.status(500).json({ 
      error: "Failed to fetch databases", 
      details: error.message 
    });
  }
};
