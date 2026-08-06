import { RunContext } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import axios from "axios"
import { IntegrationType, RunHistoryAction } from "terse-types"

import { Session } from "../../../express"
import { HiggsfieldGenerationResult } from "../../../integrations/higgsfield/apiClient"
import { HiggsfieldIntegrationManager } from "../../../integrations/higgsfield/integration"
import { SessionWithTracking } from "../../../modules/agents/AgentRunner/BaseAgentRunner"
import { buildGeneratedImageKey, ensureStoredWithMetadata } from "../../../services/FileStorageService"

export async function requireHiggsfieldCredentials(integrationId: string, runContext: RunContext<SessionWithTracking<Session>> | undefined): Promise<{ credentials: string; organizationId: string }> {
    if (!runContext?.context) {
        throw new Error("No context provided")
    }
    const organizationId = runContext.context.user.organizationId

    const manager = new HiggsfieldIntegrationManager()
    const orgIntegrations = await manager.getInstancesForOrganization(organizationId)
    if (!orgIntegrations.some(integration => integration.id === integrationId)) {
        throw new Error("Higgsfield integration not found or not authorized for this organization.")
    }
    return { credentials: await manager.getCredentials(integrationId), organizationId }
}

/**
 * Higgsfield does not document how long its result URLs stay alive, and the
 * approval step can take days, so every asset is copied into our own storage
 * before anything else is allowed to depend on it.
 */
export async function storeGeneratedAsset(result: HiggsfieldGenerationResult, organizationId: string, fallbackMimeType: string): Promise<StoredAsset> {
    const [url, thumbnailUrl] = await Promise.all([
        storeRemoteAsset(result.url, buildGeneratedImageKey(organizationId, result.jobId, result.url), fallbackMimeType),
        result.thumbnailUrl ? storeRemoteAsset(result.thumbnailUrl, buildGeneratedImageKey(organizationId, result.jobId, result.thumbnailUrl), "image/jpeg") : Promise.resolve(null)
    ])

    return { jobId: result.jobId, url, thumbnailUrl }
}

export function higgsfieldAction(action: string, details: string): RunHistoryAction {
    return {
        action,
        integration: IntegrationType.HIGGSFIELD,
        target: "Higgsfield",
        details,
        type: RunHistoryActionType.create,
        isReadOnly: false
    }
}

async function storeRemoteAsset(sourceUrl: string, storageKey: string, fallbackMimeType: string): Promise<string> {
    const stored = await ensureStoredWithMetadata(storageKey, async () => {
        const response = await axios.get(sourceUrl, { responseType: "arraybuffer" })
        const mimeType = (response.headers["content-type"]?.toString() || fallbackMimeType).split(";")[0].trim()
        return { data: Buffer.from(response.data), mimeType, filename: `creative.${extensionFor(mimeType)}` }
    })

    if (!stored) {
        throw new Error("The generated asset could not be stored. File storage is not configured for this environment.")
    }
    return stored.url
}

function extensionFor(mimeType: string): string {
    return mimeType.split("/")[1] || "bin"
}

export interface StoredAsset {
    readonly jobId: string
    readonly url: string
    readonly thumbnailUrl: string | null
}
