import { Integration, OAuthIntegrationInstallation } from "./abstract/Integration";
import { db } from "../prismaClient";
import { NotionIntegration, NotionIntegrationMetadata } from "../shared/Integrations";
import { OAuthInstallationDetails } from "../shared/types";
import { ChannelInputWithConfigs } from "../types/prisma";
import jwt from "jsonwebtoken";
import { notion as notionConfig, jwt as jwtSettings, urls } from "../config/settings";
import { Request, Response } from "express";
import { Client } from "@notionhq/client";
import chalk from "chalk";
import { NotionResource } from "../shared/types";
import { PageObjectResponse, PartialPageObjectResponse, SearchResponse } from "@notionhq/client/build/src/api-endpoints";
import { extractPageTitle } from "../utility/notion";
import { IntegrationType } from "../shared/Integrations";

export class NotionIntegrationManager implements Integration<NotionIntegration, never, typeof NotionIntegrationMetadata>, OAuthIntegrationInstallation {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.NOTION;

    async getInstancesForUser(userId: string): Promise<NotionIntegration[]> {
        const notionIntegrations = await db().notion_integrations.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                workspace_id: true,
                workspace_name: true,
            }
        });
        return notionIntegrations.map(ni => ({
            id: ni.id,
            workspaceId: ni.workspace_id || undefined,
            workspaceName: ni.workspace_name || undefined,
        }));
    }

    async getAllActiveInstances(): Promise<NotionIntegration[]> {
        const notionIntegrations = await db().notion_integrations.findMany({
            select: {
                id: true,
                workspace_id: true,
                workspace_name: true,
            }
        });
        return notionIntegrations.map(ni => ({
            id: ni.id,
            workspaceId: ni.workspace_id || undefined,
            workspaceName: ni.workspace_name || undefined,
        }));
    }

    async processWebhookEvent(event: never): Promise<void> {
        // Notion webhooks are handled elsewhere
        throw new Error("Notion webhooks are not processed through this integration manager");
    }

    async getInstallationUrl(userId: string): Promise<OAuthInstallationDetails> {
        // Generate state token for security (prevents CSRF)
        const state = jwt.sign(
            { userId: userId, timestamp: Date.now() },
            jwtSettings.secret,
            { expiresIn: "10m" }
        );

        const clientId = notionConfig.clientId;
        const redirectUri = notionConfig.redirectUri;

        // Build OAuth URL with proper encoding
        const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
        authUrl.searchParams.append("client_id", clientId);
        authUrl.searchParams.append("response_type", "code");
        authUrl.searchParams.append("owner", "user");
        authUrl.searchParams.append("redirect_uri", redirectUri);
        authUrl.searchParams.append("state", state);

        return {
            oauthUrl: authUrl.toString()
        };
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query;

        if (error) {
            console.error(chalk.red("Notion OAuth error:"), error);
            res.redirect(`${urls.frontend}/oauth/error`);
            return;
        }

        if (!code || !state) {
            res.status(400).json({ error: "Missing code or state parameter" });
            return;
        }

        try {
            // Verify state token to prevent CSRF attacks
            const decoded = jwt.verify(state as string, jwtSettings.secret) as {
                userId: string;
                timestamp: number;
            };

            // Exchange authorization code for access token
            const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
                method: "POST",
                headers: {
                    Authorization: `Basic ${Buffer.from(
                        `${notionConfig.clientId}:${notionConfig.clientSecret}`
                    ).toString("base64")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: notionConfig.redirectUri,
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
            const databasesResponse: SearchResponse = await notionClient.search({
                filter: { property: "object", value: "database" },
                page_size: 100,
            });

            const pagesResponse: SearchResponse = await notionClient.search({
                filter: { property: "object", value: "page" },
                page_size: 100,
            });

            const databases: NotionResource[] = databasesResponse.results.map(
                (db: any) => ({
                    id: db.id,
                    title: db.title?.[0]?.plain_text || "Untitled Database",
                    url: db.url,
                    type: 'database',
                })
            );

            const pages: NotionResource[] = pagesResponse.results
                .filter((page): page is PageObjectResponse | PartialPageObjectResponse => page.object === 'page')
                .map((page: PageObjectResponse | PartialPageObjectResponse) => ({
                    id: page.id,
                    title: extractPageTitle(page),
                    url: 'url' in page ? page.url : '',
                    type: 'page' as const,
                }));

            const resources: NotionResource[] = [...databases, ...pages];

            console.log(
                chalk.blue(`📊 Found ${resources.length} pages and databases for user`),
                chalk.yellow(decoded.userId)
            );

            if (databases.length === 0) {
                console.error(
                    chalk.red("No pages or databases found for user"),
                    chalk.yellow(decoded.userId)
                );
                res.redirect(`${urls.frontend}/oauth/error`);
                return;
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
            res.redirect(`${urls.frontend}/oauth/success`);
        } catch (error) {
            console.error(chalk.red("Error in Notion OAuth callback:"), error);
            res.redirect(`${urls.frontend}/oauth/error`);
        }
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve();
    }

    async setupChannelInput(integrationId: string, automationInput: ChannelInputWithConfigs): Promise<void> {
        // Notion doesn't require any setup for automation inputs
        // Webhooks are managed at the integration level
    }

    async teardownChannelInput(integrationId: string, automationInput: ChannelInputWithConfigs): Promise<void> {
        // Notion doesn't require any teardown for automation inputs
        // Webhooks are managed at the integration level
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        // Notion OAuth doesn't use refresh tokens - tokens are long-lived
        // Return false to indicate no refresh was needed/performed
        return false;
    }
}

