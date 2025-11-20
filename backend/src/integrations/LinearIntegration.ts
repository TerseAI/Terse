import { Integration, OAuthIntegrationInstallation } from "./abstract/Integration";
import { db } from "../prismaClient";
import { LinearIntegration, LinearIntegrationMetadata } from "../shared/Integrations";
import { IntegrationType } from "../shared/Integrations";
import { AutomationInputWithConfigs } from "../types/prisma";
import { OAuthInstallationDetails } from "src/shared/types";
import jwt from "jsonwebtoken";
import { settings } from "../config/settings";
import { Request, Response } from "express";
import chalk from "chalk";
import { LinearAdapter } from "../ticketing/linear";
import { urls } from "../config/settings";

export class LinearIntegrationManager implements Integration<LinearIntegration, never, typeof LinearIntegrationMetadata>, OAuthIntegrationInstallation {
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

    async processWebhookEvent(event: never): Promise<void> {
        // Linear webhooks are handled elsewhere
        throw new Error("Linear webhooks are not processed through this integration manager");
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

