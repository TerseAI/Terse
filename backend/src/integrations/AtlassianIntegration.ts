import { Integration, OAuthIntegrationInstallation, ConfigurationFieldDefinition } from "./abstract/Integration";
import { db } from "../prismaClient";
import { AtlassianIntegration, AtlassianIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType, InstallationOptionsFor, AdditionalStateParams } from "../shared/Integrations";
import { AgentTriggerWithConfigs, User } from "../types/prisma";
import { OAuthInstallationDetails } from "../shared/types";
import jwt from "jsonwebtoken";
import { settings } from "../config/settings";
import { Request, Response } from "express";
import { urls} from "../config/settings";
import { generateWebhookSecret } from "../utility/webhookSecrets";
import { JiraWebhookPayload } from "../utility/JiraWebhookPayload";
import { InputEvent } from "./abstract/InputEvent";
import { InputConfigType } from "@prisma/client";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { EventProcessor } from "../agent/AgentRunner/EventProcessor";
import logger, { runWithUserContext } from "../logger";
import { createOAuthStateToken } from "../utility/oauth";
import { integrationTaskQueue } from "./IntegrationTaskQueues";
import { IntegrationCompletedTask } from "./IntegrationCompletedTask";
import { FrontendRoutes } from "../shared/FrontendRoutes";
import { ApiRoutes } from "../shared/ApiRoutes";
import { ConfigType, JiraConfig } from "../shared/Configs";
import { JiraSampleEvent, JiraEventData } from "../shared/SampleEvents";
import axios from 'axios';

const OAUTH_TOKEN_REFRESH_THRESHOLD_MS = 1000 * 60 * 30; // 30 minutes (expires access token after 1 hour)

// MARK: - Integration Manager

export class AtlassianIntegrationManager implements Integration<AtlassianIntegration, JiraWebhookPayload, typeof AtlassianIntegrationMetadata>, OAuthIntegrationInstallation<IntegrationType.ATLASSIAN> {
    integrationType: IntegrationType = IntegrationType.ATLASSIAN;
    constructor() { }

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return [];
    }

    async getInstallationUrl(userId: string, options?: InstallationOptionsFor<IntegrationType.ATLASSIAN>, additionalStatePayload?: AdditionalStateParams): Promise<OAuthInstallationDetails> {
        // Generate state token for security (prevents CSRF)
        const state = createOAuthStateToken({
            userId,
            additionalFields: { timestamp: Date.now() },
            additionalStatePayload,
        });

        const clientId = settings.atlassian.clientId;
        const redirectUri = settings.atlassian.callbackUrl;

        // Build OAuth URL according to Atlassian OAuth 2.0 (3LO) specification
        const scopes = [
            'offline_access',
            'read:me',
            'read:jira-work',
            'write:jira-work',
            'read:jira-user',
            'read:confluence-content.all',
            'read:confluence-space.summary',
            'read:confluence-props',
            'read:confluence-content.permission',
            'read:confluence-content.summary',
            'readonly:content.attachment:confluence',
            'search:confluence',
            'read:page:confluence',
            'write:confluence-content',
            'write:comment:confluence',
            "read:comment:confluence",
            'manage:jira-webhook'
        ].join(' ');

        const authUrl = new URL("https://auth.atlassian.com/authorize");
        authUrl.searchParams.append("audience", "api.atlassian.com");
        authUrl.searchParams.append("client_id", clientId);
        authUrl.searchParams.append("scope", scopes);
        authUrl.searchParams.append("redirect_uri", redirectUri);
        authUrl.searchParams.append("state", state);
        authUrl.searchParams.append("response_type", "code");
        authUrl.searchParams.append("prompt", "consent");

        return {
            oauthUrl: authUrl.toString()
        };
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query;

        if (error) {
            logger.error("Atlassian OAuth error", { error: String(error) });
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`);
            return;
        }

        if (!code || !state) {
            res.status(400).json({ error: "Missing code or state parameter" });
            return;
        }

        try {
            // Verify state token to prevent CSRF attacks
            const decoded = jwt.verify(state as string, settings.jwt.secret) as {
                userId: string;
                timestamp: number;
            };

            // Exchange authorization code for access token
            const tokenResponse = await fetch("https://auth.atlassian.com/oauth/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    grant_type: "authorization_code",
                    client_id: settings.atlassian.clientId,
                    client_secret: settings.atlassian.clientSecret,
                    code: code as string,
                    redirect_uri: settings.atlassian.callbackUrl,
                }),
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                logger.error("Atlassian token exchange failed", { error: errorText });
                throw new Error(`Atlassian token exchange failed: ${errorText}`);
            }

            const tokenData = await tokenResponse.json();
            const { access_token, expires_in, scope } = tokenData;

            if (!access_token) {
                throw new Error("No access token received from Atlassian");
            }

            // Calculate token expiry
            const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);

            // Get user info and accessible resources
            // First, get the user's accessible sites/resources
            const resourcesResponse = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${access_token}`,
                    "Accept": "application/json",
                },
            });

            if (!resourcesResponse.ok) {
                const errorText = await resourcesResponse.text();
                logger.error("Failed to get accessible resources", { error: errorText });
                throw new Error(`Failed to get accessible resources: ${errorText}`);
            }

            const resources = await resourcesResponse.json();

            if (!resources || resources.length === 0) {
                logger.error("No accessible resources found");
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`);
                return;
            }

            // Get user info from the first accessible resource
            // We'll use the first resource as the primary integration
            const primaryResource = resources[0];
            const cloudId = primaryResource.id;
            const baseUrl = primaryResource.url;

            // Get user info using the cloudid
            const userInfoResponse = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${access_token}`,
                    "Accept": "application/json",
                },
            });

            let jiraUserEmail: string | null = null;
            let accountId: string | null = null;
            if (userInfoResponse.ok) {
                const userInfo = await userInfoResponse.json();
                jiraUserEmail = userInfo.emailAddress || null;
                accountId = userInfo.accountId || null;
            } else {
                // Try to get user info from the /me endpoint
                const meResponse = await fetch("https://api.atlassian.com/me", {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${access_token}`,
                        "Accept": "application/json",
                    },
                });
                if (meResponse.ok) {
                    const meInfo = await meResponse.json();
                    jiraUserEmail = meInfo.email || null;
                    accountId = meInfo.accountId || null;
                }
            }

            if (!jiraUserEmail) {
                logger.warn("⚠️  Could not determine user email from Atlassian API");
            }

            const url = new URL(baseUrl);
            const siteName = url.hostname.replace(/\.atlassian\.net$/, '');

            logger.info("🏢 Atlassian site:", {siteName, cloudId});

            // Check if a connection for this base_url already exists
            const existing = await db().atlassian_integrations.findFirst({
                where: {
                    user_id: decoded.userId,
                    base_url: baseUrl,
                },
            });

            // Note: We don't store refresh_token separately for Atlassian OAuth 2.0 (3LO)
            // The offline_access scope should provide a refresh token, but we need to check the response
            const refreshToken = tokenData.refresh_token || null;

            // Create webhook for Jira events (if accountId is available)
            let webhookId: string | null = null;
            let webhookSecret: string | null = null;

            if (accountId) {
                try {
                    // Delete existing webhook if present
                    if (existing?.webhook_id) {
                        try {
                            await this.deleteJiraWebhook(cloudId, access_token, existing.webhook_id);
                        } catch (error) {
                            logger.warn("⚠️  Could not delete existing webhook, continuing with creation", { error });
                        }
                    }

                    const webhook = await this.createJiraWebhook(cloudId, access_token, accountId);
                    webhookId = webhook.webhookId;
                    webhookSecret = webhook.webhookSecret;
                } catch (error) {
                    logger.error("⚠️  Failed to create webhook, continuing without it", { error });
                    // Continue with installation even if webhook creation fails
                }
            } else {
                logger.warn("⚠️  Could not determine accountId, skipping webhook creation");
            }

            let integrationId: string;
            if (!existing) {
                const newIntegration = await db().atlassian_integrations.create({
                    data: {
                        user_id: decoded.userId,
                        jira_user_email: jiraUserEmail || "",
                        base_url: baseUrl,
                        cloud_id: cloudId,
                        site_name: siteName,
                        webhook_id: webhookId,
                        webhook_secret: webhookSecret,
                        access_token: access_token,
                        refresh_token: refreshToken || "",
                        token_expiry: tokenExpiry,
                    },
                });
                integrationId = newIntegration.id;
                logger.info("✅ Created Atlassian OAuth connection:", {siteName, webhookId: webhookId ? "with webhook" : "no webhook"});
            } else {
                // Update existing connection with new token (in case it was revoked and re-authorized)
                await db().atlassian_integrations.update({
                    where: { id: existing.id },
                    data: {
                        cloud_id: cloudId, // Update cloud_id in case it changed
                        access_token: access_token,
                        refresh_token: refreshToken || existing.refresh_token, // Preserve existing refresh token if new one not provided
                        token_expiry: tokenExpiry,
                        jira_user_email: jiraUserEmail || existing.jira_user_email,
                        webhook_id: webhookId || existing.webhook_id, // Update webhook if created, otherwise keep existing
                        webhook_secret: webhookSecret || existing.webhook_secret,
                    },
                });
                integrationId = existing.id;
                logger.info("✅ Updated Atlassian OAuth connection token:", {siteName, webhookId: webhookId ? "with webhook" : "no webhook"});
            }

            logger.info("✅ Atlassian OAuth completed for user:", {userId: decoded.userId});

            // Emit integration completed task (includes full state payload for chat metadata detection)
            integrationTaskQueue.emit(new IntegrationCompletedTask(
                IntegrationType.ATLASSIAN,
                integrationId,
                decoded.userId,
                decoded,
                new Date()
            ));

            // Redirect to success page which will auto-close the popup
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`);
        } catch (error) {
            logger.error("Error in Atlassian OAuth callback", { error });
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`);
        }
    }

    async getInstancesForUser(userId: string): Promise<AtlassianIntegration[]> {
        // Fetch both OAuth-based integrations and legacy API key-based integrations
        const oauthIntegrations = await db().atlassian_integrations.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                jira_user_email: true,
                base_url: true,
                site_name: true,
            }
        });

        // Combine both types
        return oauthIntegrations.map(oi => ({
            id: oi.id,
            email: oi.jira_user_email,
            baseUrl: oi.base_url,
            siteName: oi.site_name || undefined,
        }));
    }

    formatIntegrationInstanceForAgent(instance: AtlassianIntegration): string {
        const details: string[] = [];
        if (instance.siteName) {
            details.push(`site "${instance.siteName}"`);
        } else if (instance.baseUrl) {
            details.push(`site ${instance.baseUrl}`);
        }
        if (instance.email) {
            details.push(`email ${instance.email}`);
        }
        if (instance.projectKey) {
            details.push(`project ${instance.projectKey}`);
        } else if (instance.projectName) {
            details.push(`project "${instance.projectName}"`);
        }
        const detailText = details.length ? ` (${details.join(", ")})` : "";
        return `Atlassian${detailText} [id: ${instance.id}]`;
    }

    async getAllActiveInstances(): Promise<AtlassianIntegration[]> {
        const integrations = await db().atlassian_integrations.findMany({
            select: {
                id: true,
                jira_user_email: true,
                base_url: true,
                site_name: true,
            },
        });
        return integrations.map(oi => ({
            id: oi.id,
            email: oi.jira_user_email,
            baseUrl: oi.base_url,
            siteName: oi.site_name || undefined,
        }));
    }

    async processWebhookEvent(event: JiraWebhookPayload): Promise<void> {

        // Extract base URL from the issue self URL or match by user email
        // The webhook payload includes user email, which we can use to match integrations
        const userEmail = event.user?.emailAddress;
        const issueUrl = event.issue?.self;

        if (!userEmail && !issueUrl) {
            logger.info("⚠️  [JIRA INTEGRATION MANAGER] No user email or issue URL found in webhook payload");
            return;
        }

        // Try to extract base URL from issue self URL
        let baseUrl: string | null = null;
        if (issueUrl) {
            try {
                const url = new URL(issueUrl);
                // Extract base URL (e.g., https://company.atlassian.net from https://company.atlassian.net/rest/api/3/issue/123)
                baseUrl = `${url.protocol}//${url.hostname}`;
            } catch (error) {
                logger.warn("⚠️  Could not parse issue URL", { issueUrl, error });
            }
        }

        // Find matching integrations
        // Match by user email or base URL
        const matchingIntegrations = await db().atlassian_integrations.findMany({
            where: {
                OR: [
                    ...(userEmail ? [{ jira_user_email: userEmail }] : []),
                    ...(baseUrl ? [{ base_url: baseUrl }] : []),
                ],
            },
            include: {
                user: true,
            },
        });

        if (matchingIntegrations.length === 0) {
            logger.info(`⚠️  [JIRA INTEGRATION MANAGER] No integrations found for user email: ${userEmail || 'N/A'} or base URL: ${baseUrl || 'N/A'}`);
            return;
        }

        logger.info(`✅ [JIRA INTEGRATION MANAGER] Found ${matchingIntegrations.length} matching integration(s)`);

        // Process event for each matching integration
        for (const integration of matchingIntegrations) {
            try {
                const user = integration.user;
                if (!user) {
                    logger.info(`⚠️  [JIRA INTEGRATION MANAGER] User not found for integration ${integration.id}`);
                    continue;
                }

                // Process with user context for logging
                await runWithUserContext(user.id, user.email, async () => {
                    // Enrich context using JiraAdapter if needed
                    let enrichedEvent = event;
                    try {
                        // If this is an issue event, we could fetch additional details
                        if (event.issue?.id && integration.cloud_id && integration.access_token) {
                            // For now, we'll use the event as-is since it already contains rich information
                            // Future: Could fetch additional context using OAuth token
                            logger.info(`📊 [JIRA INTEGRATION MANAGER] Using webhook payload for issue ${event.issue.key}`);
                        }
                    } catch (error) {
                        logger.info(`⚠️  [JIRA INTEGRATION MANAGER] Error enriching context: ${error}`);
                        // Continue with original event if enrichment fails
                    }

                    // Create JiraEvent and process it
                    const jiraEvent = new JiraEvent(enrichedEvent, integration.id);
                    const eventProcessor = new EventProcessor(jiraEvent, user);
                    await eventProcessor.process();
                });
            } catch (error) {
                logger.error(`❌ [JIRA INTEGRATION MANAGER] Error processing event for integration ${integration.id}`, { 
                    error,
                    integrationId: integration.id
                });
                // Continue processing other integrations even if one fails
            }
        }
    }

    async deleteInstallation(integrationId: string): Promise<void> {
        try {
            // Fetch the integration to get webhook details
            const integration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId },
            });

            if (!integration) {
                logger.warn("⚠️  Integration not found for deletion", { integrationId });
                return;
            }

            // Delete webhook if it exists
            if (integration.webhook_id && integration.cloud_id) {
                // Get valid access token before using it
                const accessToken = await this.getAccessToken(integration.id);
                if (accessToken) {
                    try {
                        await this.deleteJiraWebhook(
                            integration.cloud_id,
                            accessToken,
                            integration.webhook_id
                        );
                    } catch (error) {
                        logger.error("⚠️  Failed to delete webhook during integration deletion", { error, integrationId });
                        // Continue with deletion even if webhook deletion fails
                    }
                }
            }

            // Delete the integration record
            await db().atlassian_integrations.delete({
                where: { id: integrationId },
            });

            logger.info("✅ [JIRA INTEGRATION MANAGER] Deleted Atlassian integration:", {integrationId});
        } catch (error) {
            logger.error("Error deleting Atlassian integration:", {error});
            throw error;
        }
    }

    async setupAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {
        try {
            // Get the integration
            const integration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId },
            });

            if (!integration) {
                logger.warn(`⚠️  Integration ${integrationId} not found, skipping webhook setup`, { integrationId });
                return;
            }

            // In development, always recreate webhook to ensure URL is current
            // (especially important when using Cloudflare tunnels that change URLs)
            const isDevelopment = settings.nodeEnv === 'development';

            // In development, always delete existing webhook and recreate to ensure URL is current
            if (isDevelopment && integration.webhook_id) {
                logger.info("🔄 Development mode: recreating webhook for integration", {integrationId});

                if (integration.cloud_id) {
                    // Get valid access token before using it
                    const accessToken = await this.getAccessToken(integrationId);
                    if (accessToken) {
                        try {
                            await this.deleteJiraWebhook(
                                integration.cloud_id,
                                accessToken,
                                integration.webhook_id
                            );
                        } catch (error) {
                            logger.warn("⚠️  Could not delete existing webhook, continuing with creation", { error, integrationId });
                        }
                    }
                }
            } else if (integration.webhook_id) {
                // Not localhost and webhook exists - leave it as is
                logger.info("✅ Webhook already exists for integration", {integrationId, webhookId: integration.webhook_id});
                return;
            }

            // Webhook doesn't exist or we're on localhost and need to recreate it
            // First, get the accountId from the API
            if (!integration.cloud_id) {
                logger.warn("⚠️  Integration missing cloud_id, cannot create webhook", {integrationId});
                return;
            }

            // Get valid access token before using it
            const accessToken = await this.getAccessToken(integrationId);
            if (!accessToken) {
                logger.warn("⚠️  Could not get valid access token for integration", {integrationId});
                return;
            }

            logger.info("🔧 Creating webhook for integration", {integrationId});

            // Get user accountId from Jira API
            const userInfoResponse = await fetch(
                `https://api.atlassian.com/ex/jira/${integration.cloud_id}/rest/api/3/myself`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Accept": "application/json",
                    },
                }
            );

            let accountId: string | null = null;
            if (userInfoResponse.ok) {
                const userInfo = await userInfoResponse.json();
                accountId = userInfo.accountId || null;
            } else {
                // Try the /me endpoint as fallback
                const meResponse = await fetch("https://api.atlassian.com/me", {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Accept": "application/json",
                    },
                });
                if (meResponse.ok) {
                    const meInfo = await meResponse.json();
                    accountId = meInfo.accountId || null;
                }
            }

            if (!accountId) {
                logger.warn(`⚠️  Could not determine accountId for integration ${integrationId}, skipping webhook creation`, { integrationId });
                return;
            }

            // Create the webhook
            const webhook = await this.createJiraWebhook(
                integration.cloud_id,
                accessToken,
                accountId
            );

            // Update the integration with the webhook ID
            await db().atlassian_integrations.update({
                where: { id: integrationId },
                data: {
                    webhook_id: webhook.webhookId,
                    webhook_secret: webhook.webhookSecret,
                },
            });

            logger.info("✅ Created and registered webhook for integration", {integrationId, webhookId: webhook.webhookId});
        } catch (error) {
            logger.error(`❌ Error setting up webhook for integration ${integrationId}`, { 
                error,
                integrationId
            });
            // Don't throw - allow automation setup to continue even if webhook creation fails
        }
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        try {
            const integration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId },
            });

            if (!integration) {
                logger.warn(`Atlassian integration ${integrationId} not found`, { integrationId });
                return false;
            }

            // Store the original token expiry to detect if refresh happened
            const originalTokenExpiry = integration.token_expiry;

            // Use getAccessToken which internally handles token refresh
            const accessToken = await this.getAccessToken(integrationId);
            if (!accessToken) {
                // getAccessToken returns null on error, but might return existing token as fallback
                // Check if token was actually refreshed by comparing expiry dates
                const updatedIntegration = await db().atlassian_integrations.findUnique({
                    where: { id: integrationId },
                    select: { token_expiry: true },
                });

                if (!updatedIntegration || !originalTokenExpiry || !updatedIntegration.token_expiry) {
                    return false;
                }

                // If expiry changed, token was refreshed
                return updatedIntegration.token_expiry.getTime() !== originalTokenExpiry.getTime();
            }

            // Check if token was refreshed by comparing expiry dates
            const updatedIntegration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId },
                select: { token_expiry: true },
            });

            if (!updatedIntegration || !originalTokenExpiry || !updatedIntegration.token_expiry) {
                return false;
            }

            // Token was refreshed if expiry changed
            return updatedIntegration.token_expiry.getTime() !== originalTokenExpiry.getTime();
        } catch (error) {
            logger.error(`Error refreshing Atlassian token for integration ${integrationId}`, { error, integrationId });
            return false;
        }
    }

    async teardownAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {
        try {
            // Get the integration
            const integration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId },
            });

            if (!integration || !integration.webhook_id) {
                // No webhook to clean up
                return;
            }

            // Check if there are other automations using this integration
            // Query for automations with this integration_id, excluding the current automation
            const otherAutomations = await db().automation_inputs.findMany({
                where: {
                    integration_id: integrationId,
                    automation_id: {
                        not: automationInput.automation_id,
                    },
                    config_type: InputConfigType.JIRA,
                },
                select: {
                    automation_id: true,
                },
            });

            // If there are other automations using this integration, keep the webhook
            if (otherAutomations.length > 0) {
                logger.info("ℹ️  Keeping webhook for integration", { integrationId, otherAutomationsCount: otherAutomations.length });
                return;
            }

            // No other automations use this integration, safe to delete the webhook
            logger.info("🗑️  Deleting webhook for integration", { integrationId });

            if (!integration.cloud_id) {
                logger.warn(`⚠️  Integration ${integrationId} missing cloud_id, cannot delete webhook`, { integrationId });
                // Still clear the webhook_id from the database
                await db().atlassian_integrations.update({
                    where: { id: integrationId },
                    data: {
                        webhook_id: null,
                        webhook_secret: null,
                    },
                });
                return;
            }

            // Get valid access token before using it
            const accessToken = await this.getAccessToken(integrationId);
            if (!accessToken) {
                logger.warn(`⚠️  Could not get valid access token for integration ${integrationId}, cannot delete webhook`, { integrationId });
                // Still clear the webhook_id from the database
                await db().atlassian_integrations.update({
                    where: { id: integrationId },
                    data: {
                        webhook_id: null,
                        webhook_secret: null,
                    },
                });
                return;
            }

            // Delete the webhook from Jira
            try {
                await this.deleteJiraWebhook(
                    integration.cloud_id,
                    accessToken,
                    integration.webhook_id
                );
            } catch (error) {
                logger.error(`⚠️  Failed to delete webhook from Jira, but clearing from database`, { error, integrationId });
            }

            // Clear the webhook_id from the database
            await db().atlassian_integrations.update({
                where: { id: integrationId },
                data: {
                    webhook_id: null,
                    webhook_secret: null,
                },
            });

            logger.info("✅ Deleted webhook for integration", { integrationId });
        } catch (error) {
            logger.error(`❌ Error tearing down webhook for integration ${integrationId}`, { 
                error,
                integrationId
            });
            // Don't throw - allow automation teardown to continue even if webhook deletion fails
        }
    }

    // MARK: - Helper Methods

    async getAccessToken(integrationId: string, userId?: string): Promise<string | null> {
        try {
            const integration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId },
            });

            if (!integration) {
                logger.error(`Atlassian integration ${integrationId} not found`, { integrationId });
                return null;
            }

            // Validate that the integration belongs to the user if userId is provided
            if (userId && integration.user_id !== userId) {
                logger.warn('Atlassian integration does not belong to user', { integrationId, userId, tokenUserId: integration.user_id });
                return null;
            }

            const now = new Date();
            // Check if token is expired or will expire within the refresh threshold
            if (
                integration.token_expiry &&
                integration.token_expiry <= new Date(now.getTime() + OAUTH_TOKEN_REFRESH_THRESHOLD_MS)
            ) {
                logger.info(`Atlassian access token expiring soon for integration ${integrationId}, refreshing...`, { integrationId });

                if (!integration.refresh_token || integration.refresh_token === "") {
                    logger.error(`No refresh token available for Atlassian integration ${integrationId}`, { integrationId });
                    return null;
                }

                // Exchange refresh token for new access token
                const tokenResponse = await fetch("https://auth.atlassian.com/oauth/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        grant_type: "refresh_token",
                        client_id: settings.atlassian.clientId,
                        client_secret: settings.atlassian.clientSecret,
                        refresh_token: integration.refresh_token,
                    }),
                });

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text();
                    logger.error(`Atlassian token refresh failed for integration ${integrationId}`, { error: errorText, integrationId });
                    // Return existing token as fallback - it might still work
                    return integration.access_token;
                }

                const tokenData = await tokenResponse.json();
                const { access_token, refresh_token, expires_in } = tokenData;

                if (!access_token) {
                    logger.error(`No access token received from Atlassian refresh for integration ${integrationId}`, { integrationId });
                    // Return existing token as fallback
                    return integration.access_token;
                }

                // Calculate token expiry
                const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);

                // Update the database with new tokens
                await db().atlassian_integrations.update({
                    where: { id: integration.id },
                    data: {
                        access_token: access_token,
                        refresh_token: refresh_token || integration.refresh_token, // Preserve existing if new one not provided
                        token_expiry: tokenExpiry,
                    },
                });

                logger.info(`Successfully refreshed Atlassian access token for integration ${integrationId}`, { integrationId });
                return access_token;
            }

            // Token is still valid
            return integration.access_token;
        } catch (error) {
            logger.error(`Error ensuring valid access token for integration ${integrationId}`, { 
                error,
                integrationId
            });
            // Return null on error - caller should handle
            return null;
        }
    }

    /**
     * Creates a Jira webhook using OAuth bearer token authentication
     * Events tracked: issue creation, updates, comments for ticket management automation
     */
    private async createJiraWebhook(
        cloudId: string,
        accessToken: string,
        accountId: string
    ): Promise<{ webhookId: string; webhookSecret: string }> {
        const webhookSecret = generateWebhookSecret(32);
        const backendUrl = urls.backend;

        // Webhook events relevant for a bot automating ticket management
        const webhookEvents = [
            'jira:issue_created',      // New tickets
            'jira:issue_updated',      // State changes, assignments, field updates
            'comment_created',          // Comments added to issues
            'comment_updated',          // Comments edited
            'comment_deleted',          // Comments removed
        ];

        const webhookUrl = `${backendUrl}${ApiRoutes.WEBHOOKS.JIRA_BY_ACCOUNT_ID.build(accountId)}`;

        // For Jira Cloud OAuth 2.0 apps, use the REST API v3 webhook endpoint
        // Documentation: https://developer.atlassian.com/cloud/jira/platform/webhooks/
        const webhookEndpoint = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/webhook`;


        const webhookPayload = {
            url: webhookUrl,
            webhooks: [
                {
                    // Jira doesn't allow empty jqlFilter, so we use a dummy project key that doesn't exist
                    // https://community.developer.atlassian.com/t/listening-for-changes-update-delete-in-all-issues-of-the-workspace/56266/6
                    jqlFilter: "issueKey != NONEXISTENTPROJECT-1",
                    events: webhookEvents,
                }
            ]
        };

        const webhookResponse = await fetch(
            webhookEndpoint,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(webhookPayload),
            }
        );

        if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text();
            logger.error("Failed to create Jira webhook", { error: errorText });
            throw new Error(`Failed to create Jira webhook: ${errorText}`);
        }

        // Parse the webhook registration response
        // Response format: { "webhookRegistrationResult": [{ "createdWebhookId": 1 }, ...] }
        const response = await webhookResponse.json() as JiraWebhookRegistrationResponse;
        
        // Extract the results array from the response wrapper
        const webhookResults = response.webhookRegistrationResult;

        if (!Array.isArray(webhookResults) || webhookResults.length === 0) {
            throw new Error("Invalid webhook response format: missing webhookRegistrationResult array");
        }

        const firstResult = webhookResults[0];

        // Check for errors
        if (firstResult.errors && firstResult.errors.length > 0) {
            throw new Error(`Webhook registration failed: ${firstResult.errors.join(", ")}`);
        }

        // Extract webhook ID from the response
        const webhookId = firstResult.createdWebhookId?.toString();

        if (!webhookId) {
            throw new Error("Could not extract webhook ID from Jira API response");
        }

        logger.info("✅ Created Jira webhook", { webhookId, events: webhookEvents.join(", ") });

        return { webhookId, webhookSecret };
    }

    /**
     * Deletes a Jira webhook using OAuth bearer token authentication
     */
    private async deleteJiraWebhook(
        cloudId: string,
        accessToken: string,
        webhookId: string
    ): Promise<void> {
        // For Jira Cloud OAuth 2.0 apps, delete webhooks using the REST API v3 endpoint
        // Format: DELETE /rest/api/3/webhook with body { "webhookIds": [id1, id2, ...] }
        const webhookEndpoint = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/webhook`;

        const webhookResponse = await fetch(
            webhookEndpoint,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    webhookIds: [parseInt(webhookId, 10)]
                }),
            }
        );

        if (!webhookResponse.ok && webhookResponse.status !== 404) {
            const errorText = await webhookResponse.text();
            logger.error("Failed to delete Jira webhook", { error: errorText, webhookId });
            throw new Error(`Failed to delete Jira webhook: ${errorText}`);
        }

        logger.info("✅ Deleted Jira webhook", { webhookId });
    }
}

// MARK: - Event Definition

export class JiraEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.ATLASSIAN;
    data: JiraWebhookPayload;
    private integrationId: string;

    constructor(data: JiraWebhookPayload, integrationId: string) {
        super();
        this.data = data;
        this.integrationId = integrationId;
    }

    formatForAgentRunner(): string {
        const indentMultiline = (text: string | any): string => {
            // Handle non-string values (e.g., Atlassian Document Format objects)
            let textStr: string;
            if (typeof text === 'string') {
                textStr = text;
            } else if (text && typeof text === 'object') {
                // If it's an ADF object, try to extract plain text or stringify it
                textStr = JSON.stringify(text, null, 2);
            } else {
                textStr = String(text || '');
            }

            return textStr
                .split('\n')
                .map((line) => `        ${line}`)
                .join('\n');
        };

        const sections: string[] = [];

        // Event summary
        sections.push(`Incoming Jira ${this.data.webhookEvent} Event`);
        sections.push(`User: ${this.data.user.displayName} (${this.data.user.emailAddress})`);
        sections.push(`Timestamp: ${new Date(this.data.timestamp).toISOString()}`);

        // Format based on event type
        if (this.data.issue) {
            const issue = this.data.issue;
            const issueSections: string[] = [];

            issueSections.push(`Issue: ${issue.key} - ${issue.fields.summary}`);
            if (issue.fields.description) {
                issueSections.push(`Description:\n${indentMultiline(issue.fields.description)}`);
            }
            issueSections.push(`Status: ${issue.fields.status.name}`);
            if (issue.fields.priority) {
                issueSections.push(`Priority: ${issue.fields.priority.name}`);
            }
            issueSections.push(`Project: ${issue.fields.project.name} (${issue.fields.project.key})`);
            issueSections.push(`Issue Type: ${issue.fields.issuetype.name}`);

            if (issue.fields.assignee) {
                issueSections.push(`Assignee: ${issue.fields.assignee.displayName}`);
            }

            if (issue.fields.labels && issue.fields.labels.length > 0) {
                issueSections.push(`Labels: ${issue.fields.labels.join(', ')}`);
            }

            if (issue.fields.duedate) {
                issueSections.push(`Due Date: ${issue.fields.duedate}`);
            }

            // Convert REST API URL to browse URL using issue key
            let issueUrl = issue.self;
            if (issue.self && issue.key) {
                try {
                    const urlObj = new URL(issue.self);
                    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
                    issueUrl = `${baseUrl}/browse/${issue.key}`;
                } catch (error) {
                    // Fallback to string replacement if URL parsing fails
                    issueUrl = issue.self.replace(/\/rest\/api\/[23]\/issue\//, '/browse/');
                }
            }
            issueSections.push(`URL: ${issueUrl}`);

            // Add changelog if present (shows what changed)
            if (this.data.changelog && this.data.changelog.items && this.data.changelog.items.length > 0) {
                const changeSections: string[] = [];
                changeSections.push(`Changes:`);
                this.data.changelog.items.forEach((item) => {
                    changeSections.push(`  - ${item.field}: "${item.fromString || 'None'}" → "${item.toString || 'None'}"`);
                });
                issueSections.push(changeSections.join('\n'));
            }

            sections.push(issueSections.join('\n'));
        }

        // Handle comment events
        if (this.data.comment) {
            const comment = this.data.comment;
            const commentSections: string[] = [];

            commentSections.push(`Comment on Issue: ${this.data.issue?.key || 'Unknown'}`);
            commentSections.push(`Author: ${comment.author.displayName} (${comment.author.emailAddress})`);
            commentSections.push(`Created: ${comment.created}`);
            if (comment.body) {
                commentSections.push(`Comment:\n${indentMultiline(comment.body)}`);
            }

            sections.push(commentSections.join('\n'));
        }

        return sections.join('\n\n');
    }

    debugLog(): string {
        const issue = this.data.issue;
        const comment = this.data.comment;

        if (issue) {
            return `Jira ${this.data.webhookEvent}: ${issue.key} - ${issue.fields.summary}`;
        } else if (comment) {
            // Use this.data.issue directly to avoid type narrowing issues
            const issueKey = this.data.issue?.key || 'Unknown Issue';
            return `Jira ${this.data.webhookEvent}: Comment on ${issueKey}`;
        }
        return `Jira ${this.data.webhookEvent}`;
    }

    matchesAgentTrigger(automationInput: AgentTriggerWithConfigs): boolean {
        logger.debug(`Checking if Jira event matches automation input: ${automationInput.config_type}`, { configType: automationInput.config_type });
        // Check if integration type matches
        if (automationInput.config_type !== InputConfigType.JIRA) {
            return false;
        }

        // Get the Jira config if it exists
        const jiraConfig = automationInput.jira_config;

        // If no project filter is configured, match all Jira events
        if (!jiraConfig || (!jiraConfig.project_key && !jiraConfig.project_id)) {
            return true;
        }

        // Extract project information from the event
        const eventIssue = this.data.issue;
        if (!eventIssue) {
            // For comment-only events, check if there's an issue in the payload
            // Comments can have an associated issue
            if (this.data.comment && !eventIssue) {
                // Comment events without issue info - skip filtering (match all)
                return true;
            }
            return false;
        }

        const eventProjectKey = eventIssue.fields.project.key;
        const eventProjectId = eventIssue.fields.project.id;

        // Check if project matches by key or ID
        if (jiraConfig.project_key && jiraConfig.project_key === eventProjectKey) {
            return true;
        }

        if (jiraConfig.project_id && jiraConfig.project_id === eventProjectId) {
            return true;
        }

        // No match - event is for a different project
        return false;
    }

    createTriggerMetadata(): RunHistoryTrigger {
        // Create event name from webhookEvent (e.g., "jira:issue_created" → "jira_issue_created")
        const eventName = this.data.webhookEvent.replace(/:/g, '_').toLowerCase();

        // Extract issue and comment to avoid type narrowing issues
        const issue = this.data.issue;
        const comment = this.data.comment;

        // Get URL, title, subheader, and source from event data
        let url: string | undefined;
        let title: string | undefined;
        let subheader: string | undefined;
        let source: string;

        if (issue) {
            // Convert REST API URL to browse URL
            // Handle both /rest/api/2/issue/ and /rest/api/3/issue/ formats
            // Use issue key to construct proper browse URL: https://domain.atlassian.net/browse/KEY-123
            if (issue.self) {
                try {
                    const urlObj = new URL(issue.self);
                    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
                    url = `${baseUrl}/browse/${issue.key}`;
                } catch (error) {
                    // Fallback to string replacement if URL parsing fails
                    url = issue.self.replace(/\/rest\/api\/[23]\/issue\//, '/browse/');
                }
            }
            title = issue.fields.summary;
            subheader = `${issue.key} - ${issue.fields.status.name}`;
            source = issue.fields.project.name || issue.fields.project.key;
        } else if (comment) {
            // For comment events, construct URL from issue if available
            // Use this.data.issue directly to avoid type narrowing issues
            const commentIssue = this.data.issue;
            if (commentIssue) {
                // Convert REST API URL to browse URL using issue key
                if (commentIssue.self) {
                    try {
                        const urlObj = new URL(commentIssue.self);
                        const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
                        url = `${baseUrl}/browse/${commentIssue.key}`;
                    } catch (error) {
                        // Fallback to string replacement if URL parsing fails
                        url = commentIssue.self.replace(/\/rest\/api\/[23]\/issue\//, '/browse/');
                    }
                }
                title = `Comment on ${commentIssue.key}`;
                source = commentIssue.fields.project.name || commentIssue.fields.project.key;
            } else {
                title = "Comment";
                source = "Jira";
            }
            subheader = comment.author.displayName;
        } else {
            // Generic fallback
            title = this.data.webhookEvent;
            subheader = this.data.user.displayName;
            source = "Jira";
        }

        return {
            event: eventName,
            integration: IntegrationType.ATLASSIAN,
            source: source,
            title: title,
            subheader: subheader,
            url: url,
        };
    }

    getImageUrls(): string[] {
        // Jira webhooks don't typically include images
        // But we could extract attachment URLs if needed in the future
        return [];
    }

    private static buildJqlQuery(projectKey: string | undefined, projectKeys: string[]): string {
        if (projectKey) {
            return `project = ${projectKey} ORDER BY created DESC`;
        }

        if (projectKeys.length === 0) {
            throw new Error('No projects available');
        }

        return `project in (${projectKeys.join(',')}) ORDER BY created DESC`;
    }

    private static async fetchAccessibleProjects(cloudId: string, accessToken: string): Promise<string[]> {
        const projectsResponse = await axios.get<Array<{ key: string }>>(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                },
            }
        );

        const projects = projectsResponse.data || [];
        return projects.map((project) => project.key);
    }

    private static async searchJiraIssues(
        cloudId: string,
        accessToken: string,
        jqlQuery: string
    ): Promise<Array<{ id: string; self: string; key: string; fields: Record<string, unknown> }>> {
        const response = await axios.get<{ issues: Array<{ id: string; self: string; key: string; fields: Record<string, unknown> }> }>(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`,
            {
                params: {
                    jql: jqlQuery,
                    maxResults: 3,
                    fields: 'summary,description,status,priority,issuetype,project,assignee,creator,created,updated,labels,duedate',
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                },
            }
        );

        return response.data.issues || [];
    }

    private static createDefaultJiraUser(): JiraEventData['user'] {
        return {
            self: '',
            name: 'Unknown',
            key: '',
            emailAddress: '',
            avatarUrls: { "48x48": "", "24x24": "", "16x16": "", "32x32": "" },
            displayName: 'Unknown',
            active: true,
        };
    }

    private static convertIssueToWebhookPayload(
        issue: { id: string; self: string; key: string; fields: Record<string, unknown> }
    ): JiraWebhookPayload {
        const fields = issue.fields as any;

        // Convert the API response fields to match the webhook payload structure
        const status = fields.status || {};
        const priority = fields.priority || {};
        const issuetype = fields.issuetype || {};
        const project = fields.project || {};
        const creator = fields.creator || this.createDefaultJiraUser();

        return {
            timestamp: Date.now(),
            webhookEvent: 'jira:issue_created',
            user: creator,
            issue: {
                id: issue.id,
                self: issue.self,
                key: issue.key,
                fields: {
                    statuscategorychangedate: fields.updated || new Date().toISOString(),
                    issuetype: {
                        self: issuetype.self || '',
                        id: issuetype.id || '',
                        description: issuetype.description || '',
                        iconUrl: issuetype.iconUrl || '',
                        name: issuetype.name || '',
                        subtask: issuetype.subtask || false,
                        avatarId: issuetype.avatarId,
                    },
                    project: {
                        self: project.self || '',
                        id: project.id || '',
                        key: project.key || '',
                        name: project.name || '',
                        projectTypeKey: project.projectTypeKey || 'software',
                        simplified: project.simplified || false,
                        avatarUrls: project.avatarUrls || { "48x48": "", "24x24": "", "16x16": "", "32x32": "" },
                    },
                    fixVersions: [],
                    workratio: 0,
                    watches: { self: '', watchCount: 0, isWatching: false },
                    created: fields.created || new Date().toISOString(),
                    priority: {
                        self: priority.self || '',
                        iconUrl: priority.iconUrl || '',
                        name: priority.name || '',
                        id: priority.id || '',
                    },
                    labels: (fields.labels as string[]) || [],
                    versions: [],
                    issuelinks: [],
                    assignee: fields.assignee || null,
                    updated: fields.updated || new Date().toISOString(),
                    status: {
                        self: status.self || '',
                        description: status.description || '',
                        iconUrl: status.iconUrl || '',
                        name: status.name || '',
                        id: status.id || '',
                        statusCategory: status.statusCategory || {
                            self: '',
                            id: 0,
                            key: '',
                            colorName: '',
                            name: '',
                        },
                    },
                    components: [],
                    timetracking: {},
                    attachment: [],
                    description: fields.description,
                    summary: fields.summary || '',
                    creator: creator,
                    subtasks: [],
                    reporter: fields.reporter || creator,
                    aggregateprogress: { progress: 0, total: 0 },
                    duedate: fields.duedate,
                    progress: { progress: 0, total: 0 },
                    votes: { self: '', votes: 0, hasVoted: false },
                },
            },
        };
    }

    static async getSampleEvents(config: JiraConfig, userId?: string): Promise<JiraSampleEvent[]> {
        const prisma = db();

        const atlassianIntegration = await prisma.atlassian_integrations.findUnique({
            where: { id: config.integrationId },
        });

        if (!atlassianIntegration) {
            throw new Error(`Atlassian integration ${config.integrationId} not found`);
        }

        try {
            let jqlQuery: string;

            if (config.projectKey) {
                jqlQuery = this.buildJqlQuery(config.projectKey, []);
            } else {
                const projectKeys = await this.fetchAccessibleProjects(
                    atlassianIntegration.cloud_id,
                    atlassianIntegration.access_token
                );

                if (projectKeys.length === 0) {
                    return [];
                }

                jqlQuery = this.buildJqlQuery(undefined, projectKeys);
            }

            const issues = await this.searchJiraIssues(
                atlassianIntegration.cloud_id,
                atlassianIntegration.access_token,
                jqlQuery
            );

            const sampleEvents: JiraSampleEvent[] = issues.map((issue) => {
                const webhookPayload = this.convertIssueToWebhookPayload(issue);
                const event = new JiraEvent(webhookPayload, config.integrationId);

                // Extract simplified data for the sample event
                const eventData: JiraEventData = {
                    timestamp: webhookPayload.timestamp,
                    webhookEvent: webhookPayload.webhookEvent,
                    user: webhookPayload.user,
                    issue: {
                        id: webhookPayload.issue.id,
                        self: webhookPayload.issue.self,
                        key: webhookPayload.issue.key,
                        fields: {
                            summary: webhookPayload.issue.fields.summary,
                            description: webhookPayload.issue.fields.description,
                            status: {
                                name: webhookPayload.issue.fields.status.name,
                                id: webhookPayload.issue.fields.status.id,
                            },
                            priority: {
                                name: webhookPayload.issue.fields.priority.name,
                                id: webhookPayload.issue.fields.priority.id,
                            },
                            issuetype: {
                                name: webhookPayload.issue.fields.issuetype.name,
                                id: webhookPayload.issue.fields.issuetype.id,
                            },
                            project: {
                                name: webhookPayload.issue.fields.project.name,
                                key: webhookPayload.issue.fields.project.key,
                                id: webhookPayload.issue.fields.project.id,
                            },
                            assignee: webhookPayload.issue.fields.assignee,
                            created: webhookPayload.issue.fields.created,
                            updated: webhookPayload.issue.fields.updated,
                            labels: webhookPayload.issue.fields.labels,
                            duedate: webhookPayload.issue.fields.duedate,
                        },
                    },
                };

                return {
                    configType: ConfigType.JIRA,
                    eventData,
                    trigger: event.createTriggerMetadata(),
                    integrationId: config.integrationId,
                };
            });

            return sampleEvents;
        } catch (error) {
            logger.error('Error fetching Jira sample events', { error, config });
            throw error;
        }
    }

    static async sendSampleEventToAgent(sampleEvent: JiraSampleEvent, agentId: string, user: User): Promise<void> {
        // Convert the simplified event data back to a full webhook payload
        const eventData = sampleEvent.eventData;
        const webhookPayload: JiraWebhookPayload = {
            timestamp: eventData.timestamp,
            webhookEvent: eventData.webhookEvent,
            user: eventData.user,
            issue: {
                id: eventData.issue.id,
                self: eventData.issue.self,
                key: eventData.issue.key,
                fields: {
                    statuscategorychangedate: eventData.issue.fields.updated,
                    issuetype: {
                        self: '',
                        id: eventData.issue.fields.issuetype.id,
                        description: '',
                        iconUrl: '',
                        name: eventData.issue.fields.issuetype.name,
                        subtask: false,
                    },
                    project: {
                        self: '',
                        id: eventData.issue.fields.project.id,
                        key: eventData.issue.fields.project.key,
                        name: eventData.issue.fields.project.name,
                        projectTypeKey: 'software',
                        simplified: false,
                        avatarUrls: { "48x48": "", "24x24": "", "16x16": "", "32x32": "" },
                    },
                    fixVersions: [],
                    workratio: 0,
                    watches: { self: '', watchCount: 0, isWatching: false },
                    created: eventData.issue.fields.created,
                    priority: {
                        self: '',
                        iconUrl: '',
                        name: eventData.issue.fields.priority.name,
                        id: eventData.issue.fields.priority.id,
                    },
                    labels: eventData.issue.fields.labels,
                    versions: [],
                    issuelinks: [],
                    assignee: eventData.issue.fields.assignee,
                    updated: eventData.issue.fields.updated,
                    status: {
                        self: '',
                        description: '',
                        iconUrl: '',
                        name: eventData.issue.fields.status.name,
                        id: eventData.issue.fields.status.id,
                        statusCategory: {
                            self: '',
                            id: 0,
                            key: '',
                            colorName: '',
                            name: '',
                        },
                    },
                    components: [],
                    timetracking: {},
                    attachment: [],
                    description: eventData.issue.fields.description,
                    summary: eventData.issue.fields.summary,
                    creator: eventData.user,
                    subtasks: [],
                    reporter: eventData.user,
                    aggregateprogress: { progress: 0, total: 0 },
                    duedate: eventData.issue.fields.duedate,
                    progress: { progress: 0, total: 0 },
                    votes: { self: '', votes: 0, hasVoted: false },
                },
            },
            changelog: eventData.changelog,
            comment: eventData.comment ? {
                ...eventData.comment,
                updateAuthor: eventData.comment.author,
            } : undefined,
        };

        const event = new JiraEvent(webhookPayload, sampleEvent.integrationId);
        const eventProcessor = new EventProcessor(event, user);

        const agent = await eventProcessor.findAgent(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        // Process asynchronously
        eventProcessor.processAgent(agent).then(() => {
            logger.info(`Sample Jira event sent to agent`, { agentId, issueKey: sampleEvent.eventData.issue.key });
        }).catch((error) => {
            logger.error(`Error sending sample Jira event to agent`, { error, agentId });
        });
    }
}

// MARK: - Interfaces

// Types for Jira webhook API responses
interface JiraWebhookRegistrationResult {
    createdWebhookId?: number;
    errors?: string[];
}

interface JiraWebhookRegistrationResponse {
    webhookRegistrationResult: JiraWebhookRegistrationResult[];
}
