import { Integration, OAuthIntegrationInstallation, ConfigurationFieldDefinition, ConfigSearchProvider, ConfigSearchOptions, ConfigSearchResult, ConfigValidationOptions, ConfigValidationResult } from "./abstract/Integration";
import { db } from "../prismaClient";
import { NotionIntegration, NotionIntegrationMetadata } from "../shared/Integrations";
import { OAuthInstallationDetails } from "../shared/types";
import { ChannelInputWithConfigs } from "../types/prisma";
import jwt from "jsonwebtoken";
import { notion as notionConfig, jwt as jwtSettings, urls } from "../config/settings";
import { Request, Response } from "express";
import { IntegrationType, InstallationOptionsFor, AdditionalStateParams } from "../shared/Integrations";
import logger from "../logger";
import { createOAuthStateToken } from "../utility/oauth";
import { integrationTaskQueue } from "./IntegrationTaskQueues";
import { IntegrationCompletedTask } from "./IntegrationCompletedTask";
import { ConfigType } from "../shared/Configs";
import { Client } from "@notionhq/client";
import { extractPageTitle } from "../utility/notion";

class NotionConfigSearchProvider implements ConfigSearchProvider {
    constructor(private integrationManager: NotionIntegrationManager) {}

    async searchConfigOptions(options: ConfigSearchOptions): Promise<{
        results: ConfigSearchResult[];
        hasMore: boolean;
        totalCount?: number;
    }> {
        if (options.configType !== ConfigType.NOTION_PAGE && options.configType !== ConfigType.NOTION_DATABASE) {
            return { results: [], hasMore: false };
        }

        // Get access token
        const accessToken = await this.integrationManager.getAccessToken(options.integrationId);
        if (!accessToken) {
            throw new Error(`Could not get access token for Notion integration ${options.integrationId}`);
        }

        const notionClient = new Client({ auth: accessToken });

        // Determine filter based on config type
        const filter = options.configType === ConfigType.NOTION_PAGE
            ? { property: "object" as const, value: "page" as const }
            : { property: "object" as const, value: "data_source" as const };

        const limit = options.limit || 100;
        const page = options.page || 1;
        const startCursor = page > 1 ? undefined : undefined; // Notion uses cursor-based pagination

        const searchOptions: Parameters<typeof notionClient.search>[0] = {
            query: options.searchQuery || "",
            page_size: limit,
            filter,
        };

        const searchResponse = await notionClient.search(searchOptions);

        const results: ConfigSearchResult[] = searchResponse.results
            .map((result: any): ConfigSearchResult | null => {
                if (result.object === 'data_source') {
                    return {
                        id: result.id,
                        label: result.title?.[0]?.plain_text || "Untitled Database",
                        description: result.url,
                        metadata: { type: 'database', url: result.url }
                    };
                } else if (result.object === 'page') {
                    return {
                        id: result.id,
                        label: extractPageTitle(result),
                        description: 'url' in result ? result.url : undefined,
                        metadata: { type: 'page', url: 'url' in result ? result.url : undefined }
                    };
                }
                return null;
            })
            .filter((r): r is ConfigSearchResult => r !== null);

        return {
            results,
            hasMore: searchResponse.has_more || false,
            totalCount: results.length
        };
    }

    async validateConfigValue(options: ConfigValidationOptions): Promise<ConfigValidationResult> {
        if (options.configType !== ConfigType.NOTION_PAGE && options.configType !== ConfigType.NOTION_DATABASE) {
            return { valid: false, error: 'Invalid config type for Notion' };
        }

        // Get access token
        const accessToken = await this.integrationManager.getAccessToken(options.integrationId);
        if (!accessToken) {
            return { valid: false, error: `Could not get access token for Notion integration ${options.integrationId}` };
        }

        const notionClient = new Client({ auth: accessToken });

        if (options.field === 'pageId' || options.field === 'databaseId') {
            const pageId = String(options.value).replace(/-/g, '');
            
            try {
                // Try to retrieve the page/database
                if (options.configType === ConfigType.NOTION_PAGE) {
                    const page = await notionClient.pages.retrieve({ page_id: pageId });
                    return { 
                        valid: true, 
                        normalizedValue: page.id,
                        metadata: { title: extractPageTitle(page as any) }
                    };
                } else {
                    const database = await notionClient.databases.retrieve({ database_id: pageId });
                    const title = (database as any).title?.[0]?.plain_text || "Untitled Database";
                    return { 
                        valid: true, 
                        normalizedValue: database.id,
                        metadata: { title }
                    };
                }
            } catch (error: any) {
                if (error.code === 'object_not_found') {
                    return { valid: false, error: 'Page or database not found or not accessible' };
                }
                return { valid: false, error: error.message || 'Failed to validate page/database' };
            }
        }

        // Validate URLs - extract ID from Notion URLs
        if (options.field === 'pageUrl' || options.field === 'databaseUrl') {
            const url = String(options.value);
            const match = url.match(/notion\.so\/([a-zA-Z0-9]+)/);
            if (match) {
                const pageId = match[1];
                // Convert to UUID format if needed
                const uuidFormat = pageId.length === 32 
                    ? `${pageId.slice(0, 8)}-${pageId.slice(8, 12)}-${pageId.slice(12, 16)}-${pageId.slice(16, 20)}-${pageId.slice(20)}`
                    : pageId;
                
                return await this.validateConfigValue({
                    ...options,
                    field: options.configType === ConfigType.NOTION_PAGE ? 'pageId' : 'databaseId',
                    value: uuidFormat
                });
            }
            return { valid: false, error: 'Invalid Notion URL format' };
        }

        return { valid: false, error: `Unknown field: ${options.field}` };
    }
}

export class NotionIntegrationManager implements Integration<NotionIntegration, never, typeof NotionIntegrationMetadata>, OAuthIntegrationInstallation<IntegrationType.NOTION> {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.NOTION;
    
    configSearchProvider: ConfigSearchProvider = new NotionConfigSearchProvider(this);

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return [];
    }

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

    async getInstallationUrl(userId: string, options?: InstallationOptionsFor<IntegrationType.NOTION>, additionalStatePayload?: AdditionalStateParams): Promise<OAuthInstallationDetails> {
        // Note: options parameter is required by interface but NotionIntegration uses NoInstallationOptions
        // additionalStatePayload allows passing extra state variables (e.g., chat metadata for ChatAgent resumption)
        // Generate state token for security (prevents CSRF)
        const state = createOAuthStateToken({
            userId,
            additionalFields: { timestamp: Date.now() },
            additionalStatePayload,
        });

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
            logger.error("Notion OAuth error", { error: String(error) });
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
                chatId?: string;
                channel?: string;
                integrationType?: string;
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
                logger.error("Notion token exchange failed", { error: errorText });
                throw new Error(`Notion token exchange failed: ${errorText}`);
            }

            const tokenData = await tokenResponse.json();
            const { access_token, workspace_id, workspace_name } = tokenData;

            logger.info("🔑 Received Notion access token for user", { userId: decoded.userId, workspaceName: workspace_name || workspace_id });

            // Check if a connection for this workspace already exists
            const existing = await db().notion_integrations.findFirst({
                where: {
                    user_id: decoded.userId,
                    workspace_id: workspace_id || null,
                },
            });

            let integrationId: string;
            if (!existing) {
                const newIntegration = await db().notion_integrations.create({
                    data: {
                        user_id: decoded.userId,
                        workspace_id: workspace_id || null,
                        workspace_name: workspace_name || null,
                        integration_token: access_token,
                    },
                });
                integrationId = newIntegration.id;
            } else {
                // Update existing connection with new token (in case it was revoked and re-authorized)
                await db().notion_integrations.update({
                    where: { id: existing.id },
                    data: {
                        integration_token: access_token,
                    },
                });
                integrationId = existing.id;
                logger.info("✅ Updated Notion connection token", { workspaceName: workspace_name || "Workspace", integrationId: existing.id, userId: decoded.userId });
            }

            logger.info("✅ Notion OAuth completed for user", { userId: decoded.userId, workspaceName: workspace_name || workspace_id });

            // Emit integration completed task (includes full state payload for chat metadata detection)
            integrationTaskQueue.emit(new IntegrationCompletedTask(
                IntegrationType.NOTION,
                integrationId,
                decoded.userId,
                decoded,
                new Date()
            ));

            // Redirect to success page which will auto-close the popup
            res.redirect(`${urls.frontend}/oauth/success`);
        } catch (error) {
            logger.error("Error in Notion OAuth callback", { error });
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

    async getAccessToken(integrationId: string): Promise<string | null> {
        try {
            const integration = await db().notion_integrations.findUnique({
                where: { id: integrationId },
                select: {
                    integration_token: true,
                },
            });

            if (!integration) {
                logger.error(`Notion integration ${integrationId} not found`, { integrationId });
                return null;
            }

            // Notion tokens are long-lived and don't expire, so just return the token
            return integration.integration_token || null;
        } catch (error) {
            logger.error(`Error getting Notion access token for integration ${integrationId}`, { error, integrationId });
            return null;
        }
    }
}

