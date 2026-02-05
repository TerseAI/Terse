import { google } from "googleapis"

import { GmailEvent, fetchAndParseEmail, getOAuth2Client } from "../../integrations/GmailIntegration"
import { isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { IntegrationType } from "../../shared/Integrations"
import { HydratorType } from "../../types/rag"
import { HydrationContext, Hydrator, Identifiable } from "../Hydrator"

export class GmailEventHydrator extends Hydrator<GmailEvent> {
    readonly entityType = HydratorType.GMAIL_EVENT

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<GmailEvent> {
        const event = await this.fetchFromGmail(ref.entityId)
        if (!event) {
            throw new Error(`Failed to hydrate Gmail event: ${ref.entityId}`)
        }
        return event
    }

    async hydrateBulk(refs: Identifiable[]): Promise<GmailEvent[]> {
        const results = await Promise.all(refs.map(ref => this.fetchFromGmail(ref.entityId)))
        return results.map((event, i) => {
            if (!event) {
                throw new Error(`Failed to hydrate Gmail event: ${refs[i].entityId}`)
            }
            return event
        })
    }

    private async fetchFromGmail(entityId: string): Promise<GmailEvent | null> {
        const parts = entityId.split(":")
        if (parts.length < 2) {
            logger.error(`Invalid Gmail entityId format: ${entityId}`)
            return null
        }
        const [integrationId, messageId] = parts

        const integration = await db().gmail_integrations.findFirst({
            where: {
                id: integrationId,
                is_active: true,
                ...(this.ctx.organizationId && { organization_id: this.ctx.organizationId })
            }
        })
        if (!integration) {
            logger.error(`Gmail integration ${integrationId} not found`)
            return null
        }

        const manager = INTEGRATION_REGISTRY.find(m => m.integrationType === IntegrationType.GMAIL)
        if (!manager || !isOAuthIntegrationInstallation(manager)) {
            return null
        }
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            logger.error(`Could not get Gmail access token for ${integrationId}`)
            return null
        }

        try {
            const oauth2Client = getOAuth2Client()
            oauth2Client.setCredentials({
                access_token: accessToken,
                refresh_token: integration.refresh_token
            })
            const gmail = google.gmail({ version: "v1", auth: oauth2Client })
            const parsed = await fetchAndParseEmail(gmail, messageId)
            if (!parsed) {
                return null
            }
            if (!parsed.labelIds.includes("INBOX")) {
                parsed.labelIds = [...parsed.labelIds, "INBOX"]
            }
            return new GmailEvent(parsed, integrationId)
        } catch (error) {
            logger.error(`Failed to fetch Gmail message ${messageId}`, { error, entityId })
            return null
        }
    }
}
