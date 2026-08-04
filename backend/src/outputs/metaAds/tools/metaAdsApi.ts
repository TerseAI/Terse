import { RunContext } from "@openai/agents"
import type { ToolInputByName, ToolName, ToolOutputByName } from "terse-types"

import logger from "../../../common/logger"
import { Session } from "../../../express"
import { MetaAdsIntegrationManager } from "../../../integrations/metaAds/integration"
import { SessionWithTracking } from "../../../modules/agents/AgentRunner/BaseAgentRunner"
import { formatError } from "../../../tools/toolUtils"

import { MetaAdsClient } from "./metaAdsClient"

export function metaAdsToolExecute<TName extends MetaAdsToolName>(toolName: TName, handler: (request: ToolInputByName[TName]["request"], client: MetaAdsClient) => Promise<ToolOutputByName[TName]>) {
    return async (input: ToolInputByName[TName], runContext?: RunContext<SessionWithTracking<Session>>): Promise<ToolOutputByName[TName]> => {
        logger.debug(`Executing ${toolName} tool`, { integrationId: input.integrationId })
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await resolveMetaAdsAccessToken(input.integrationId, runContext)

        try {
            return await handler(input.request, new MetaAdsClient(accessToken))
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error(`Error executing ${toolName}`, { error: errorMessage, integrationId: input.integrationId })
            throw new Error(errorMessage)
        }
    }
}

export async function resolveMetaAdsAccessToken(integrationId: string, runContext: RunContext<SessionWithTracking<Session>> | undefined): Promise<string> {
    if (!runContext?.context) {
        throw new Error("No context provided")
    }

    const manager = new MetaAdsIntegrationManager()
    const orgIntegrations = await manager.getInstancesForOrganization(runContext.context.user.organizationId)
    if (!orgIntegrations.some(i => i.id === integrationId)) {
        throw new Error("Meta Ads integration not found or not authorized for this organization.")
    }

    const accessToken = await manager.getAccessToken(integrationId)
    if (!accessToken) {
        throw new Error("Failed to get Meta Ads access token. The integration may not be connected.")
    }
    return accessToken
}

type MetaAdsToolName = Extract<ToolName, `meta_ads_${string}`>
