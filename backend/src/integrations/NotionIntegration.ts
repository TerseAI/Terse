import { Integration, OAuthIntegrationInstallation, ConfigurationFieldDefinition } from "./abstract/Integration";
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

export class NotionIntegrationManager implements Integration<NotionIntegration, never, typeof NotionIntegrationMetadata>, OAuthIntegrationInstallation<IntegrationType.NOTION> {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.NOTION;

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

    formatIntegrationInstanceForAgent(instance: NotionIntegration): string {
        const details: string[] = [];
        if (instance.workspaceName) {
            details.push(`workspace "${instance.workspaceName}"`);
        } else if (instance.workspaceId) {
            details.push(`workspaceId ${instance.workspaceId}`);
        }
        const detailText = details.length ? ` (${details.join(", ")})` : "";
        return `Notion${detailText} [id: ${instance.id}]`;
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

