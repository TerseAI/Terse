import { generateHiggsfieldImages } from "../../../integrations/higgsfield/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { higgsfieldAction, requireHiggsfieldCredentials, storeGeneratedAsset } from "./toolContext"

export const higgsfieldGenerateImageTool = defineSessionTool({
    name: "higgsfield_generate_image",
    execute: async (input, runContext) => {
        const { credentials, organizationId } = await requireHiggsfieldCredentials(input.integrationId, runContext)
        const generated = await generateHiggsfieldImages(credentials, {
            prompt: input.prompt,
            size: input.size,
            quality: input.quality,
            batchSize: input.batchSize,
            styleId: input.styleId,
            referenceImageUrls: input.referenceImageUrls
        })

        const images = await Promise.all(generated.map(result => storeGeneratedAsset(result, organizationId, "image/jpeg")))

        return {
            success: true,
            images,
            count: images.length,
            actions: [higgsfieldAction("Generated creative", `Generated ${images.length} image(s) for "${input.prompt}"`)]
        }
    }
})
