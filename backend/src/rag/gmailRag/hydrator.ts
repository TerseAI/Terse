import { gmail as createGmailClient } from "@googleapis/gmail"
import { IntegrationType } from "terse-types"

import { GmailTriggerRuntime, fetchAndParseEmail, getOAuth2Client } from "../../integrations/GmailIntegration"
import { isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { getSecrets } from "../../services/SecretService"
import { HydrationContext, Hydrator, Identifiable } from "../Hydrator"

export class GmailEventHydrator extends Hydrator<GmailTriggerRuntime> {
    readonly entityType = "gmail_event"

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<GmailTriggerRuntime> {
        const event = await this.fetchFromGmail(ref.entityId)
        if (!event) {
            throw new Error(`Failed to hydrate Gmail event: ${ref.entityId}`)
        }
        return event
    }

    async hydrateBulk(refs: Identifiable[]): Promise<GmailTriggerRuntime[]> {
        const results = await Promise.all(refs.map(ref => this.fetchFromGmail(ref.entityId)))
        return results.map((event, i) => {
            if (!event) {
                throw new Error(`Failed to hydrate Gmail event: ${refs[i].entityId}`)
            }
            return event
        })
    }

    private async fetchFromGmail(entityId: string): Promise<GmailTriggerRuntime | null> {
        const parts = entityId.split(":")
        if (parts.length < 2) {
            logger.error(`Invalid Gmail entityId format: ${entityId}`)
            return null
        }
        const [integrationId, messageId] = parts

        if (!this.ctx.organizationId) {
            logger.error("Gmail hydrator requires organizationId in context")
            return null
        }

        const integration = await db().gmail_integrations.findFirst({
            where: {
                id: integrationId,
                is_active: true,
                organization_id: this.ctx.organizationId
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
            const secrets_refreshToken = await getSecrets({ type: "integration", secret: { integrationType: IntegrationType.GMAIL, recordId: integration.id } })
            const refreshToken = secrets_refreshToken?.refreshToken
            oauth2Client.setCredentials({
                access_token: accessToken,
                ...(refreshToken ? { refresh_token: refreshToken } : {})
            })
            const gmail = createGmailClient({ version: "v1", auth: oauth2Client })
            const parsed = await fetchAndParseEmail(gmail, messageId)
            if (!parsed) {
                return null
            }
            if (!parsed.labelIds.includes("INBOX")) {
                parsed.labelIds = [...parsed.labelIds, "INBOX"]
            }
            return new GmailTriggerRuntime(parsed, integrationId)
        } catch (error) {
            logger.error(`Failed to fetch Gmail message ${messageId}`, { error, entityId })
            return null
        }
    }
}
