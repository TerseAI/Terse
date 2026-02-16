import { Request, Response } from "express"
import jwt from "jsonwebtoken"

import { attio as attioConfig, jwt as jwtSettings, urls } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"
import { FrontendRoutes } from "../shared/FrontendRoutes"
import { AdditionalStateParams, AttioIntegration, AttioIntegrationMetadata, InstallationOptionsFor, IntegrationType } from "../shared/Integrations"
import { OAuthInstallationDetails } from "../shared/types"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { createOAuthStateToken } from "../utility/oauth"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { integrationTaskQueue } from "./IntegrationTaskQueues"
import { ConfigurationFieldDefinition, Integration, OAuthIntegrationInstallation } from "./abstract/Integration"

export class AttioIntegrationManager implements Integration<AttioIntegration, never, typeof AttioIntegrationMetadata, never>, OAuthIntegrationInstallation<IntegrationType.ATTIO> {
    constructor() {}
    integrationType: IntegrationType = IntegrationType.ATTIO

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(organizationId: string): Promise<AttioIntegration[]> {
        const integrations = await db().attio_integrations.findMany({
            where: { organization_id: organizationId },
            select: {
                id: true,
                access_token: true
            }
        })
        return Promise.all(integrations.map(async i => ({
            id: i.id,
            workspaceName: await this.fetchWorkspaceName(i.access_token)
        })))
    }

    formatIntegrationInstanceForAgent(instance: AttioIntegration): string {
        const details: string[] = []
        if (instance.workspaceName) {
            details.push(`workspace "${instance.workspaceName}"`)
        }
        const detailText = details.length ? ` (${details.join(", ")})` : ""
        return `Attio${detailText} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<AttioIntegration[]> {
        const integrations = await db().attio_integrations.findMany({
            select: {
                id: true,
                access_token: true
            }
        })
        return Promise.all(integrations.map(async i => ({
            id: i.id,
            workspaceName: await this.fetchWorkspaceName(i.access_token)
        })))
    }

    async processWebhookEvent(event: never): Promise<void> {
        throw new Error("Attio webhooks are not processed through this integration manager")
    }

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        options?: InstallationOptionsFor<IntegrationType.ATTIO>,
        additionalStatePayload?: AdditionalStateParams
    ): Promise<OAuthInstallationDetails> {
        const state = createOAuthStateToken({
            userId,
            organizationId,
            additionalFields: { timestamp: Date.now() },
            additionalStatePayload
        })

        const authUrl = new URL("https://app.attio.com/authorize")
        authUrl.searchParams.append("client_id", attioConfig.clientId)
        authUrl.searchParams.append("response_type", "code")
        authUrl.searchParams.append("redirect_uri", attioConfig.redirectUri)
        authUrl.searchParams.append("state", state)

        return {
            oauthUrl: authUrl.toString()
        }
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query

        if (error) {
            logger.error("Attio OAuth error", { error: String(error) })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        if (!code || !state) {
            res.status(400).json({ error: "Missing code or state parameter" })
            return
        }

        try {
            const decoded = jwt.verify(state as string, jwtSettings.secret) as {
                userId: string
                organizationId: string
                timestamp: number
                chatId?: string
                channel?: string
                integrationType?: string
            }

            if (!decoded.organizationId || typeof decoded.organizationId !== "string") {
                logger.error("Attio OAuth: organizationId is required in state", {
                    userId: decoded.userId
                })
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Exchange authorization code for access token
            const tokenResponse = await fetch("https://app.attio.com/oauth/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code as string,
                    redirect_uri: attioConfig.redirectUri,
                    client_id: attioConfig.clientId,
                    client_secret: attioConfig.clientSecret
                }).toString()
            })

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text()
                logger.error("Attio token exchange failed", { error: errorText })
                throw new Error(`Attio token exchange failed: ${errorText}`)
            }

            const tokenData = await tokenResponse.json()
            const { access_token } = tokenData

            logger.info("Received Attio access token for user", {
                userId: decoded.userId
            })

            // Check if a connection for this organization already exists
            const existing = await db().attio_integrations.findFirst({
                where: {
                    organization_id: decoded.organizationId
                }
            })

            let integrationId: string
            if (!existing) {
                const newIntegration = await db().attio_integrations.create({
                    data: {
                        user_id: decoded.userId,
                        organization_id: decoded.organizationId,
                        access_token: access_token
                    }
                })
                integrationId = newIntegration.id
            } else {
                await db().attio_integrations.update({
                    where: { id: existing.id },
                    data: {
                        access_token: access_token,
                        organization_id: decoded.organizationId
                    }
                })
                integrationId = existing.id
                logger.info("Updated Attio connection token", {
                    integrationId: existing.id,
                    userId: decoded.userId
                })
            }

            logger.info("Attio OAuth completed for user", {
                userId: decoded.userId
            })

            integrationTaskQueue.emit(new IntegrationCompletedTask(IntegrationType.ATTIO, integrationId, decoded.userId, decoded, new Date()))

            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (error) {
            logger.error("Error in Attio OAuth callback", { error })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve()
    }

    async setupAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {
        // Attio is output-only, no trigger setup needed
    }

    async teardownAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {
        // Attio is output-only, no trigger teardown needed
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        // Attio OAuth doesn't use refresh tokens
        return false
    }

    private async fetchWorkspaceName(accessToken: string): Promise<string | undefined> {
        try {
            const response = await fetch("https://api.attio.com/v2/self", {
                headers: { Authorization: `Bearer ${accessToken}` }
            })
            if (response.ok) {
                const data = await response.json()
                return data?.data?.workspace?.name || undefined
            }
        } catch (error) {
            logger.warn("Failed to fetch Attio workspace info", { error })
        }
        return undefined
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        try {
            const integration = await db().attio_integrations.findUnique({
                where: { id: integrationId },
                select: {
                    access_token: true
                }
            })

            if (!integration) {
                logger.error(`Attio integration ${integrationId} not found`, { integrationId })
                return null
            }

            return integration.access_token || null
        } catch (error) {
            logger.error(`Error getting Attio access token for integration ${integrationId}`, { error, integrationId })
            return null
        }
    }
}
