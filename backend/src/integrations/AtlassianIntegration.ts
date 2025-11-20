import { Integration, OAuthIntegrationInstallation } from "./abstract/Integration";
import { db } from "../prismaClient";
import { AtlassianIntegration, AtlassianIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "../shared/Integrations";
import { AutomationInputWithConfigs } from "../types/prisma";
import { OAuthInstallationDetails } from "../shared/types";
import jwt from "jsonwebtoken";
import { settings } from "../config/settings";
import { Request, Response } from "express";
import chalk from "chalk";
import { urls } from "../config/settings";
import { generateWebhookSecret } from "../utility/webhookSecrets";
import { JiraWebhookPayload, JiraWebhookEvent } from "../utility/JiraWebhookPayload";
import { InputEvent } from "./abstract/InputEvent";
import { InputConfigType } from "@prisma/client";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { EventProcessor } from "../agent/AutomationAgent/EventProcessor";

export class AtlassianIntegrationManager implements Integration<AtlassianIntegration, JiraWebhookPayload, typeof AtlassianIntegrationMetadata>, OAuthIntegrationInstallation {
    integrationType: IntegrationType = IntegrationType.ATLASSIAN;
    constructor() { }

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

        const webhookUrl = `${backendUrl}/webhooks/jira/${accountId}`;

        const webhookResponse = await fetch(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/webhook`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: "Terse AI Ticket Management",
                    url: webhookUrl,
                    events: webhookEvents,
                    // Jira REST API v3 doesn't support webhook secrets directly
                    // We store webhook_secret for potential future verification mechanisms
                }),
            }
        );

        if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text();
            console.error(chalk.red("Failed to create Jira webhook:"), errorText);
            throw new Error(`Failed to create Jira webhook: ${errorText}`);
        }

        const webhook = await webhookResponse.json();
        
        // Extract webhook ID from the self URL (format: .../webhook/{id})
        const webhookId = webhook.self?.split('/').pop() || webhook.id?.toString();
        
        if (!webhookId) {
            throw new Error("Could not extract webhook ID from Jira API response");
        }

        console.log(
            chalk.green("✅ Created Jira webhook:"),
            chalk.cyan(webhookId),
            chalk.blue("with events:"),
            chalk.yellow(webhookEvents.join(", "))
        );

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
        const webhookResponse = await fetch(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/webhook/${webhookId}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                },
            }
        );

        if (!webhookResponse.ok && webhookResponse.status !== 404) {
            const errorText = await webhookResponse.text();
            console.error(chalk.red("Failed to delete Jira webhook:"), errorText);
            throw new Error(`Failed to delete Jira webhook: ${errorText}`);
        }

        console.log(chalk.green("✅ Deleted Jira webhook:"), chalk.cyan(webhookId));
    }

    async getInstallationUrl(userId: string): Promise<OAuthInstallationDetails> {
        // Generate state token for security (prevents CSRF)
        const state = jwt.sign(
            { userId: userId, timestamp: Date.now() },
            settings.jwt.secret,
            { expiresIn: "10m" }
        );

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
            'readonly:content.attachment:confluence',
            'search:confluence-content',
            'write:confluence-content',
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

        console.log(chalk.green("Atlassian OAuth URL:"), authUrl.toString());

        return {
            oauthUrl: authUrl.toString()
        };
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query;

        if (error) {
            console.error(chalk.red("Atlassian OAuth error:"), error);
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
                console.error(chalk.red("Atlassian token exchange failed:"), errorText);
                throw new Error(`Atlassian token exchange failed: ${errorText}`);
            }

            const tokenData = await tokenResponse.json();
            const { access_token, expires_in, scope } = tokenData;

            if (!access_token) {
                throw new Error("No access token received from Atlassian");
            }

            // Calculate token expiry
            const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);

            console.log(
                chalk.blue("🔑 Received Atlassian access token for user"),
                chalk.yellow(decoded.userId)
            );

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
                console.error(chalk.red("Failed to get accessible resources:"), errorText);
                throw new Error(`Failed to get accessible resources: ${errorText}`);
            }

            const resources = await resourcesResponse.json();
            
            if (!resources || resources.length === 0) {
                console.error(chalk.red("No accessible resources found"));
                res.redirect(`${urls.frontend}/oauth/error`);
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
                console.warn(chalk.yellow("⚠️  Could not determine user email from Atlassian API"));
            }

            // Extract site name from baseUrl
            let siteName = baseUrl;
            const siteNameMatch = baseUrl.match(/https?:\/\/([^.]+)/);
            if (siteNameMatch) {
                siteName = siteNameMatch[1];
            }

            console.log(
                chalk.blue("🏢 Atlassian site:"),
                chalk.yellow(siteName),
                chalk.blue("(cloudId:"),
                chalk.yellow(cloudId),
                chalk.blue(")")
            );

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
                            console.warn(chalk.yellow("⚠️  Could not delete existing webhook, continuing with creation"), error);
                        }
                    }

                    const webhook = await this.createJiraWebhook(cloudId, access_token, accountId);
                    webhookId = webhook.webhookId;
                    webhookSecret = webhook.webhookSecret;
                } catch (error) {
                    console.error(chalk.red("⚠️  Failed to create webhook, continuing without it:"), error);
                    // Continue with installation even if webhook creation fails
                }
            } else {
                console.warn(chalk.yellow("⚠️  Could not determine accountId, skipping webhook creation"));
            }

            if (!existing) {
                await db().atlassian_integrations.create({
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
                console.log(
                    chalk.green("✅ Created Atlassian OAuth connection:"),
                    chalk.yellow(siteName),
                    webhookId ? chalk.blue("with webhook") : chalk.yellow("(no webhook)")
                );
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
                console.log(
                    chalk.green("✅ Updated Atlassian OAuth connection token"),
                    chalk.yellow(siteName),
                    webhookId ? chalk.blue("with updated webhook") : ""
                );
            }

            console.log(
                chalk.green("✅ Atlassian OAuth completed for user"),
                chalk.yellow(decoded.userId)
            );

            // Redirect to success page which will auto-close the popup
            res.redirect(`${urls.frontend}/oauth/success`);
        } catch (error) {
            console.error(chalk.red("Error in Atlassian OAuth callback:"), error);
            res.redirect(`${urls.frontend}/oauth/error`);
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
        
        // Legacy API key integrations (for backward compatibility)
        const legacyIntegrations = await db().jira_api_keys.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                jira_user_email: true,
                base_url: true,
                site_name: true,
            }
        });
        
        // Combine both types
        const allIntegrations = [
            ...oauthIntegrations.map(oi => ({
                id: oi.id,
                email: oi.jira_user_email,
                baseUrl: oi.base_url,
                siteName: oi.site_name || undefined,
            })),
            ...legacyIntegrations.map(li => ({
                id: li.id,
                email: li.jira_user_email,
                baseUrl: li.base_url,
                siteName: li.site_name || undefined,
            }))
        ];
        
        return allIntegrations;
    }

    async processWebhookEvent(event: JiraWebhookPayload): Promise<void> {
        console.log(
            chalk.blue("📥 [JIRA INTEGRATION MANAGER] Received webhook event:"),
            chalk.cyan(`Event: ${event.webhookEvent}, Issue: ${event.issue?.key || 'N/A'}`)
        );

        // Extract base URL from the issue self URL or match by user email
        // The webhook payload includes user email, which we can use to match integrations
        const userEmail = event.user?.emailAddress;
        const issueUrl = event.issue?.self;
        
        if (!userEmail && !issueUrl) {
            console.log(
                chalk.yellow("⚠️  [JIRA INTEGRATION MANAGER] No user email or issue URL found in webhook payload")
            );
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
                console.warn(chalk.yellow("⚠️  Could not parse issue URL:"), issueUrl);
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
            console.log(
                chalk.yellow(`⚠️  [JIRA INTEGRATION MANAGER] No integrations found for user email: ${userEmail || 'N/A'} or base URL: ${baseUrl || 'N/A'}`)
            );
            return;
        }

        console.log(
            chalk.green(`✅ [JIRA INTEGRATION MANAGER] Found ${matchingIntegrations.length} matching integration(s)`)
        );

        // Process event for each matching integration
        for (const integration of matchingIntegrations) {
            try {
                const user = integration.user;
                if (!user) {
                    console.log(
                        chalk.yellow(`⚠️  [JIRA INTEGRATION MANAGER] User not found for integration ${integration.id}`)
                    );
                    continue;
                }

                // Enrich context using JiraAdapter if needed
                let enrichedEvent = event;
                try {
                    // If this is an issue event, we could fetch additional details
                    if (event.issue?.id && integration.cloud_id && integration.access_token) {
                        // For now, we'll use the event as-is since it already contains rich information
                        // Future: Could fetch additional context using OAuth token
                        console.log(
                            chalk.blue(`📊 [JIRA INTEGRATION MANAGER] Using webhook payload for issue ${event.issue.key}`)
                        );
                    }
                } catch (error) {
                    console.log(
                        chalk.yellow(`⚠️  [JIRA INTEGRATION MANAGER] Error enriching context: ${error}`)
                    );
                    // Continue with original event if enrichment fails
                }

                // Create JiraEvent and process it
                const jiraEvent = new JiraEvent(enrichedEvent, integration.id);
                const eventProcessor = new EventProcessor(jiraEvent, user);
                await eventProcessor.process();
            } catch (error) {
                console.error(
                    chalk.red(`❌ [JIRA INTEGRATION MANAGER] Error processing event for integration ${integration.id}:`),
                    error
                );
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
                console.warn(chalk.yellow("⚠️  Integration not found for deletion:"), integrationId);
                return;
            }

            // Delete webhook if it exists
            if (integration.webhook_id && integration.cloud_id && integration.access_token) {
                try {
                    await this.deleteJiraWebhook(
                        integration.cloud_id,
                        integration.access_token,
                        integration.webhook_id
                    );
                } catch (error) {
                    console.error(chalk.red("⚠️  Failed to delete webhook during integration deletion:"), error);
                    // Continue with deletion even if webhook deletion fails
                }
            }

            // Delete the integration record
            await db().atlassian_integrations.delete({
                where: { id: integrationId },
            });

            console.log(
                chalk.green("✅ Deleted Atlassian integration:"),
                chalk.cyan(integrationId)
            );
        } catch (error) {
            console.error(chalk.red("Error deleting Atlassian integration:"), error);
            throw error;
        }
    }

    async setupAutomationInput(integrationId: string, automationInput: AutomationInputWithConfigs): Promise<void> {
        // Atlassian doesn't require any setup for automation inputs
        // Webhooks are managed at the integration level
    }

    async teardownAutomationInput(integrationId: string, automationInput: AutomationInputWithConfigs): Promise<void> {
        // Atlassian doesn't require any teardown for automation inputs
        // Webhooks are managed at the integration level
    }
}

// MARK: - JiraEvent

export class JiraEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.ATLASSIAN;
    data: JiraWebhookPayload;
    private integrationId: string;

    constructor(data: JiraWebhookPayload, integrationId: string) {
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
            issueSections.push(`Priority: ${issue.fields.priority.name}`);
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

            issueSections.push(`URL: ${issue.self.replace('/rest/api/3/issue/', '/browse/')}`);

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

    matchesAutomationInput(automationInput: AutomationInputWithConfigs): boolean {
        console.log(chalk.cyan(`Checking if Jira event matches automation input: ${automationInput.config_type}`));
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
            url = issue.self.replace('/rest/api/3/issue/', '/browse/');
            title = issue.fields.summary;
            subheader = `${issue.key} - ${issue.fields.status.name}`;
            source = issue.fields.project.name || issue.fields.project.key;
        } else if (comment) {
            // For comment events, construct URL from issue if available
            // Use this.data.issue directly to avoid type narrowing issues
            const commentIssue = this.data.issue;
            if (commentIssue) {
                url = commentIssue.self.replace('/rest/api/3/issue/', '/browse/');
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
}

