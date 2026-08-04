import { RunContext } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import axios from "axios"
import { IntegrationType } from "terse-types"
import type { HiggsfieldGeneratedImage, ToolInputByName, ToolOutputByName } from "terse-types"

import logger from "../../../common/logger"
import { Session } from "../../../express"
import { HiggsfieldGenerationResult, generateHiggsfieldImages } from "../../../integrations/higgsfield/apiClient"
import { HiggsfieldIntegrationManager } from "../../../integrations/higgsfield/integration"
import { SessionWithTracking } from "../../../modules/agents/AgentRunner/BaseAgentRunner"
import { buildGeneratedImageKey, ensureStoredWithMetadata } from "../../../services/FileStorageService"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

export const higgsfieldGenerateImageTool = defineSessionTool({
    name: "higgsfield_generate_image",
    execute: async (input: HiggsfieldGenerateImageInput, runContext?: RunContext<SessionWithTracking<Session>>): Promise<HiggsfieldGenerateImageOutput> => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const organizationId = runContext.context.user.organizationId
        const credentials = await resolveCredentials(input.integrationId, organizationId)

        try {
            return await generateAndStore(input, credentials, organizationId)
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error executing higgsfield_generate_image", { error: errorMessage, integrationId: input.integrationId })
            throw new Error(errorMessage)
        }
    }
})

async function generateAndStore(input: HiggsfieldGenerateImageInput, credentials: string, organizationId: string): Promise<HiggsfieldGenerateImageOutput> {
    const generated = await generateHiggsfieldImages(credentials, {
        prompt: input.prompt,
        size: input.size,
        quality: input.quality,
        batchSize: input.batchSize,
        styleId: input.styleId,
        referenceImageUrls: input.referenceImageUrls
    })

    // Higgsfield does not document how long its result URLs stay alive, and the
    // approval step can take days, so every image is copied into our own storage
    // before anything else is allowed to depend on it.
    const images = await Promise.all(generated.map(result => storeGeneratedImage(result, organizationId)))

    return {
        success: true,
        images,
        count: images.length,
        actions: [
            {
                action: "Generated creative",
                integration: IntegrationType.HIGGSFIELD,
                target: "Higgsfield",
                details: `Generated ${images.length} image(s) for "${input.prompt}"`,
                type: RunHistoryActionType.create
            }
        ]
    }
}

async function storeGeneratedImage(result: HiggsfieldGenerationResult, organizationId: string): Promise<HiggsfieldGeneratedImage> {
    const [url, thumbnailUrl] = await Promise.all([
        storeRemoteImage(result.url, buildGeneratedImageKey(organizationId, result.jobId, result.url)),
        result.thumbnailUrl ? storeRemoteImage(result.thumbnailUrl, buildGeneratedImageKey(organizationId, result.jobId, result.thumbnailUrl)) : Promise.resolve(null)
    ])

    return { jobId: result.jobId, url, thumbnailUrl }
}

async function storeRemoteImage(sourceUrl: string, storageKey: string): Promise<string> {
    const stored = await ensureStoredWithMetadata(storageKey, async () => {
        const response = await axios.get(sourceUrl, { responseType: "arraybuffer" })
        const mimeType = (response.headers["content-type"]?.toString() || "image/jpeg").split(";")[0].trim()
        return { data: Buffer.from(response.data), mimeType, filename: `creative.${mimeType.split("/")[1] || "jpg"}` }
    })

    if (!stored) {
        throw new Error("Generated image could not be stored. File storage is not configured for this environment.")
    }
    return stored.url
}

async function resolveCredentials(integrationId: string, organizationId: string): Promise<string> {
    const manager = new HiggsfieldIntegrationManager()
    const orgIntegrations = await manager.getInstancesForOrganization(organizationId)
    if (!orgIntegrations.some(integration => integration.id === integrationId)) {
        throw new Error("Higgsfield integration not found or not authorized for this organization.")
    }
    return manager.getCredentials(integrationId)
}

type HiggsfieldGenerateImageInput = ToolInputByName["higgsfield_generate_image"]
type HiggsfieldGenerateImageOutput = ToolOutputByName["higgsfield_generate_image"]
