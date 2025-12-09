import { Integration, OAuthIntegrationInstallation } from "./abstract/Integration";
import { db } from "../prismaClient";
import { LinearIntegration, LinearIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "../shared/Integrations";
import { ChannelInputWithConfigs } from "../types/prisma";
import { OAuthInstallationDetails } from "../shared/types";
import jwt from "jsonwebtoken";
import { settings, OAUTH_TOKEN_REFRESH_THRESHOLD_MS } from "../config/settings";
import { Request, Response } from "express";
import chalk from "chalk";
import { LinearAdapter } from "../ticketing/linear";
import { urls } from "../config/settings";
import { LinearWebhookPayload } from "../utility/LinearWebhookPayload";
import { InputEvent } from "./abstract/InputEvent";
import { InputConfigType } from "@prisma/client";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { EventProcessor } from "../agent/ChannelAgent/EventProcessor";

export class LinearIntegrationManager implements Integration<LinearIntegration, LinearWebhookPayload, typeof LinearIntegrationMetadata>, OAuthIntegrationInstallation<IntegrationType.LINEAR> {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.LINEAR;

    async getInstancesForUser(userId: string): Promise<LinearIntegration[]> {
        const linearIntegrations = await db().linear_integrations.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                workspace_id: true,
                workspace_name: true,
            }
        });
        return linearIntegrations.map((li) => ({
            id: li.id,
            workspaceName: li.workspace_name,
        }));
    }

    async getAllActiveInstances(): Promise<LinearIntegration[]> {
        const integrations = await db().linear_integrations.findMany({
            select: {
                id: true,
                workspace_id: true,
                workspace_name: true,
            },
        });
        return integrations.map((li) => ({
            id: li.id,
            workspaceName: li.workspace_name,
        }));
    }

    async processWebhookEvent(event: LinearWebhookPayload): Promise<void> {
        console.log(
            chalk.blue("📥 [LINEAR INTEGRATION MANAGER] Received webhook event:"),
            chalk.cyan(`Type: ${event.type}, Action: ${event.action}, Organization: ${event.organizationId}`)
        );

        // Find all integrations that match this event based on workspace_id
        // We match by team name from the webhook payload, which should correspond to workspace_id
        const workspaceIdentifier = event.data?.team?.name || event.organizationId;
        
        if (!workspaceIdentifier) {
            console.log(
                chalk.yellow("⚠️  [LINEAR INTEGRATION MANAGER] No workspace identifier found in webhook payload")
            );
            return;
        }

        const matchingIntegrations = await db().linear_integrations.findMany({
            where: {
                workspace_id: workspaceIdentifier,
            },
            include: {
                user: true,
            },
        });

        if (matchingIntegrations.length === 0) {
            console.log(
                chalk.yellow(`⚠️  [LINEAR INTEGRATION MANAGER] No integrations found for workspace: ${workspaceIdentifier}`)
            );
            return;
        }

        console.log(
            chalk.green(`✅ [LINEAR INTEGRATION MANAGER] Found ${matchingIntegrations.length} matching integration(s)`)
        );

        // Process event for each matching integration
        for (const integration of matchingIntegrations) {
            try {
                const user = integration.user;
                if (!user) {
                    console.log(
                        chalk.yellow(`⚠️  [LINEAR INTEGRATION MANAGER] User not found for integration ${integration.id}`)
                    );
                    continue;
                }

                // Enrich context using LinearAdapter
                let enrichedEvent = event;
                try {
                    // Get valid access token (handles refresh automatically)
                    const accessToken = await this.getAccessToken(integration.id);
                    if (!accessToken) {
                        console.log(
                            chalk.yellow(`⚠️  [LINEAR INTEGRATION MANAGER] Could not get valid access token for integration ${integration.id}`)
                        );
                        // Continue with original event if token cannot be obtained
                    } else {
                        const adapter = new LinearAdapter(accessToken);
                        
                        // If this is an Issue event, fetch additional details
                        if (event.type === "Issue" && event.data?.id) {
                            try {
                                const issue = await adapter.findTicket(event.data.id);
                                // Enrich the event with additional context from the API
                                // The event already has most data, but we can add any missing fields
                                console.log(
                                    chalk.blue(`📊 [LINEAR INTEGRATION MANAGER] Enriched issue context for ${event.data.id}`)
                                );
                            } catch (error) {
                                console.log(
                                    chalk.yellow(`⚠️  [LINEAR INTEGRATION MANAGER] Could not enrich issue context: ${error}`)
                                );
                                // Continue with original event if enrichment fails
                            }
                        }
                    }
                } catch (error) {
                    console.log(
                        chalk.yellow(`⚠️  [LINEAR INTEGRATION MANAGER] Error enriching context: ${error}`)
                    );
                    // Continue with original event if enrichment fails
                }

                // Create LinearEvent and process it
                const linearEvent = new LinearEvent(enrichedEvent, integration.id);
                const eventProcessor = new EventProcessor(linearEvent, user);
                await eventProcessor.process();
            } catch (error) {
                console.error(
                    chalk.red(`❌ [LINEAR INTEGRATION MANAGER] Error processing event for integration ${integration.id}:`),
                    error
                );
                // Continue processing other integrations even if one fails
            }
        }
    }

    async getInstallationUrl(userId: string): Promise<OAuthInstallationDetails> {
        // Generate state token for security (prevents CSRF)
        const state = jwt.sign(
            { userId: userId, timestamp: Date.now() },
            settings.jwt.secret,
            { expiresIn: "10m" }
        );

        const clientId = settings.linear.clientId;
        const redirectUri = settings.linear.oauthCallbackUrl;

        // Build OAuth URL with proper encoding
        const authUrl = new URL("https://linear.app/oauth/authorize");
        authUrl.searchParams.append("client_id", clientId);
        authUrl.searchParams.append("redirect_uri", redirectUri);
        authUrl.searchParams.append("response_type", "code");
        authUrl.searchParams.append("scope", "read,write");
        authUrl.searchParams.append("state", state);
        authUrl.searchParams.append("actor", "user"); 
        authUrl.searchParams.append("prompt", "consent");

        return {
            oauthUrl: authUrl.toString()
        };
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query;

        if (error) {
            console.error(chalk.red("Linear OAuth error:"), error);
            res.redirect(`${urls.frontend}/oauth/error`);
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
            const params = new URLSearchParams();
            params.append("code", code as string);
            params.append("redirect_uri", settings.linear.oauthCallbackUrl);
            params.append("client_id", settings.linear.clientId);
            params.append("client_secret", settings.linear.clientSecret);
            params.append("grant_type", "authorization_code");

            const tokenResponse = await fetch("https://api.linear.app/oauth/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error(chalk.red("Linear token exchange failed:"), errorText);
                throw new Error(`Linear token exchange failed: ${errorText}`);
            }

            const tokenData = await tokenResponse.json();
            const { access_token, refresh_token, expires_in } = tokenData;

            if (!access_token) {
                throw new Error("No access token received from Linear");
            }

            // Calculate token expiry if expires_in is provided
            const tokenExpiry = new Date(Date.now() + expires_in * 1000)


            console.log(
                chalk.blue("🔑 Received Linear access token for user"),
                chalk.yellow(decoded.userId)
            );

            // Use the access token to get user and workspace info
            const adapter = new LinearAdapter(access_token);
            const userContext = await adapter.getUserContext();
            const linearUser = userContext.userInfo;
            const organization = userContext.organization;

            console.log(
                chalk.blue("🏢 Workspace:"),
                chalk.yellow(organization.name)
            );

            // Check if a connection for this workspace already exists
            const existing = await db().linear_integrations.findFirst({
                where: {
                    user_id: decoded.userId,
                    workspace_id: organization.name,
                },
            });

            if (!existing) {
                await db().linear_integrations.create({
                    data: {
                        user_id: decoded.userId,
                        linear_user_id: linearUser.id,
                        workspace_id: organization.name,
                        workspace_name: organization.name,
                        access_token: access_token,
                        refresh_token: refresh_token,
                        token_expiry: tokenExpiry,
                    },
                });
                console.log(
                    chalk.green("✅ Created Linear OAuth connection:"),
                    chalk.yellow(organization.name)
                );
            } else {
                // Update existing connection with new token (in case it was revoked and re-authorized)
                await db().linear_integrations.update({
                    where: { id: existing.id },
                    data: {
                        access_token: access_token,
                        refresh_token: refresh_token || existing.refresh_token, // Preserve existing refresh token if new one not provided
                        token_expiry: tokenExpiry
                    },
                });
                console.log(
                    chalk.green("✅ Updated Linear OAuth connection token"),
                    chalk.yellow(organization.name)
                );
            }

            console.log(
                chalk.green("✅ Linear OAuth completed for user"),
                chalk.yellow(decoded.userId)
            );

            // Redirect to success page which will auto-close the popup
            res.redirect(`${urls.frontend}/oauth/success`);
        } catch (error) {
            console.error(chalk.red("Error in Linear OAuth callback:"), error);
            res.redirect(`${urls.frontend}/oauth/error`);
        }
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve();
    }

    async setupChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void> {
        // Linear doesn't require any setup for channel inputs
        // Webhooks are managed at the integration level
    }

    async teardownChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void> {
        // Linear doesn't require any teardown for channel inputs
        // Webhooks are managed at the integration level
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        try {
            const integration = await db().linear_integrations.findUnique({
                where: { id: integrationId },
            });

            if (!integration) {
                console.log(`Linear integration ${integrationId} not found`);
                return false;
            }

            // Store the original token expiry to detect if refresh happened
            const originalTokenExpiry = integration.token_expiry;

            // Use getAccessToken which internally handles token refresh
            const accessToken = await this.getAccessToken(integrationId);
            if (!accessToken) {
                // Check if token was actually refreshed by comparing expiry dates
                const updatedIntegration = await db().linear_integrations.findUnique({
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
            const updatedIntegration = await db().linear_integrations.findUnique({
                where: { id: integrationId },
                select: { token_expiry: true },
            });

            if (!updatedIntegration || !originalTokenExpiry || !updatedIntegration.token_expiry) {
                return false;
            }

            // Token was refreshed if expiry changed
            return updatedIntegration.token_expiry.getTime() !== originalTokenExpiry.getTime();
        } catch (error) {
            console.error(`Error refreshing Linear token for integration ${integrationId}:`, error);
            return false;
        }
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        try {
            const integration = await db().linear_integrations.findUnique({
                where: { id: integrationId },
            });

            if (!integration) {
                console.error(`Linear integration ${integrationId} not found`);
                return null;
            }

            const now = new Date();
            // Check if token is expired or will expire within the refresh threshold
            if (
                integration.token_expiry &&
                integration.token_expiry <= new Date(now.getTime() + OAUTH_TOKEN_REFRESH_THRESHOLD_MS)
            ) {
                console.log(`Linear access token expiring soon for integration ${integrationId}, refreshing...`);

                if (!integration.refresh_token) {
                    console.error(`No refresh token available for Linear integration ${integrationId}`);
                    return integration.access_token; // Return existing token as fallback
                }

                // Exchange refresh token for new access token
                const params = new URLSearchParams();
                params.append("refresh_token", integration.refresh_token);
                params.append("client_id", settings.linear.clientId);
                params.append("client_secret", settings.linear.clientSecret);
                params.append("grant_type", "refresh_token");

                const tokenResponse = await fetch("https://api.linear.app/oauth/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: params.toString(),
                });

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text();
                    console.error(`Linear token refresh failed for integration ${integrationId}:`, errorText);
                    // Return existing token as fallback - it might still work
                    return integration.access_token;
                }

                const tokenData = await tokenResponse.json();
                const { access_token, refresh_token, expires_in } = tokenData;

                if (!access_token) {
                    console.error(`No access token received from Linear refresh for integration ${integrationId}`);
                    // Return existing token as fallback
                    return integration.access_token;
                }

                // Calculate token expiry
                const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);

                // Update the database with new tokens
                await db().linear_integrations.update({
                    where: { id: integration.id },
                    data: {
                        access_token: access_token,
                        refresh_token: refresh_token || integration.refresh_token, // Preserve existing if new one not provided
                        token_expiry: tokenExpiry,
                    },
                });

                console.log(`Successfully refreshed Linear access token for integration ${integrationId}`);
                return access_token;
            }

            // Token is still valid
            return integration.access_token;
        } catch (error) {
            console.error(`Error getting Linear access token for integration ${integrationId}:`, error);
            // Return null on error - caller should handle
            return null;
        }
    }
}

// MARK: - LinearEvent

export class LinearEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.LINEAR;
    data: LinearWebhookPayload;
    private integrationId: string;

    constructor(data: LinearWebhookPayload, integrationId: string) {
        super();
        this.data = data;
        this.integrationId = integrationId;
    }

    formatForChannelAgent(): string {
        const indentMultiline = (text: string): string =>
            text
                .split('\n')
                .map((line) => `        ${line}`)
                .join('\n');

        const sections: string[] = [];

        // Event summary
        sections.push(`Incoming Linear ${this.data.type} Event`);
        sections.push(`Action: ${this.data.action}`);
        sections.push(`Actor: ${this.data.actor.name} (${this.data.actor.email})`);
        sections.push(`Created: ${this.data.createdAt}`);

        // Format based on event type
        if (this.data.type === "Issue" && this.data.data) {
            const issue = this.data.data;
            const issueSections: string[] = [];

            issueSections.push(`Issue: ${issue.identifier} - ${issue.title}`);
            if (issue.description) {
                issueSections.push(`Description:\n${indentMultiline(issue.description)}`);
            }
            issueSections.push(`Priority: ${issue.priorityLabel || issue.priority}`);
            issueSections.push(`State: ${issue.state?.name || 'Unknown'}`);
            issueSections.push(`Team: ${issue.team?.name || 'Unknown'}`);
            
            if (issue.assignee) {
                issueSections.push(`Assignee: ${issue.assignee.name}`);
            }

            if (issue.labels && issue.labels.length > 0) {
                const labelNames = issue.labels.map((l: any) => l.name || l).join(', ');
                issueSections.push(`Labels: ${labelNames}`);
            }

            if (issue.url) {
                issueSections.push(`URL: ${issue.url}`);
            }

            sections.push(issueSections.join('\n'));
        } else if (this.data.type === "Comment" && this.data.data) {
            const comment = this.data.data as any; // Comment events have different structure
            const commentSections: string[] = [];

            commentSections.push(`Comment on Issue: ${comment.issueId || 'Unknown'}`);
            if (comment.body) {
                commentSections.push(`Comment:\n${indentMultiline(comment.body)}`);
            }

            sections.push(commentSections.join('\n'));
        } else {
            // Generic event data
            sections.push(`Event Data:\n${indentMultiline(JSON.stringify(this.data.data, null, 2))}`);
        }

        // Organization context
        if (this.data.organizationId) {
            sections.push(`Organization ID: ${this.data.organizationId}`);
        }

        return sections.join('\n\n');
    }

    debugLog(): string {
        if (this.data.type === "Issue" && this.data.data) {
            return `Linear ${this.data.type} Event: ${this.data.data.identifier} - ${this.data.data.title} (${this.data.action})`;
        } else if (this.data.type === "Comment" && this.data.data) {
            const comment = this.data.data as any; // Comment events have different structure
            return `Linear ${this.data.type} Event: Comment on issue ${comment.issueId || 'Unknown'} (${this.data.action})`;
        }
        return `Linear ${this.data.type} Event: ${this.data.action}`;
    }

    matchesChannelInput(channelInput: ChannelInputWithConfigs): boolean {
        console.log(chalk.cyan(`Checking if Linear event matches channel input: ${channelInput.config_type}`));
        // Check if integration type matches
        if (channelInput.config_type !== InputConfigType.LINEAR) {
            return false;
        }

        // Since we don't filter for a team at the moment, nothing else to check
        return true;
    }

    createTriggerMetadata(): RunHistoryTrigger {
        // Create event name in lowercase snake_case based on event type and action
        const eventTypeSnake = this.data.type.toLowerCase().replace(/\s+/g, '_');
        const actionSnake = this.data.action.toLowerCase();
        const eventName = `${eventTypeSnake}_${actionSnake}`;

        // Get URL from the event data
        let url: string | undefined;
        let title: string | undefined;
        let subheader: string | undefined;
        let source: string;

        if (this.data.type === "Issue" && this.data.data) {
            url = this.data.data.url;
            title = this.data.data.title;
            subheader = `${this.data.data.identifier} - ${this.data.data.state?.name || 'Unknown'}`;
            source = this.data.data.team?.name || this.data.organizationId;
        } else if (this.data.type === "Comment" && this.data.data) {
            const comment = this.data.data as any; // Comment events have different structure
            // Linear webhook payload includes url field at the top level for comments
            url = this.data.url;
            title = `Comment on ${comment.issueId || 'Unknown Issue'}`;
            subheader = this.data.actor.name;
            source = this.data.organizationId;
        } else {
            // For other event types, try to get URL from data or use a generic format
            const data = this.data.data as any;
            url = data?.url || this.data.url;
            title = `${this.data.type} ${this.data.action}`;
            subheader = this.data.actor.name;
            source = this.data.organizationId;
        }

        return {
            event: eventName,
            integration: IntegrationType.LINEAR,
            source: source,
            title: title,
            subheader: subheader,
            url: url,
        };
    }

    getImageUrls(): string[] {
        // Linear events don't include images yet
        return [];
    }
}