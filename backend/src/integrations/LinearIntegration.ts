import { Integration, OAuthIntegrationInstallation } from "./abstract/Integration";
import { db } from "../prismaClient";
import { LinearIntegration, LinearIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "../shared/Integrations";
import { AutomationInputWithConfigs } from "../types/prisma";
import { OAuthInstallationDetails } from "../shared/types";
import jwt from "jsonwebtoken";
import { settings } from "../config/settings";
import { Request, Response } from "express";
import chalk from "chalk";
import { LinearAdapter } from "../ticketing/linear";
import { urls } from "../config/settings";
import { LinearWebhookPayload } from "../utility/LinearWebhookPayload";
import { InputEvent } from "./abstract/InputEvent";
import { InputConfigType } from "@prisma/client";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { EventProcessor } from "../agent/AutomationAgent/EventProcessor";

export class LinearIntegrationManager implements Integration<LinearIntegration, LinearWebhookPayload, typeof LinearIntegrationMetadata>, OAuthIntegrationInstallation {
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
                    const adapter = new LinearAdapter(integration.access_token);
                    
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
        authUrl.searchParams.append("actor", "app"); // Resources created as the application (for agents)
        authUrl.searchParams.append("prompt", "consent"); // Always show consent screen

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

    async setupAutomationInput(integrationId: string, automationInput: AutomationInputWithConfigs): Promise<void> {
        // Linear doesn't require any setup for automation inputs
        // Webhooks are managed at the integration level
    }

    async teardownAutomationInput(integrationId: string, automationInput: AutomationInputWithConfigs): Promise<void> {
        // Linear doesn't require any teardown for automation inputs
        // Webhooks are managed at the integration level
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

    formatForAutomationAgent(): string {
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

    matchesAutomationInput(automationInput: AutomationInputWithConfigs): boolean {
        console.log(chalk.cyan(`Checking if Linear event matches automation input: ${automationInput.config_type}`));
        // Check if integration type matches
        if (automationInput.config_type !== InputConfigType.LINEAR) {
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