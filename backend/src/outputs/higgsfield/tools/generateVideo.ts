import { generateHiggsfieldVideos } from "../../../integrations/higgsfield/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { higgsfieldAction, requireHiggsfieldCredentials, storeGeneratedAsset } from "./toolContext"

export const higgsfieldGenerateVideoTool = defineSessionTool({
    name: "higgsfield_generate_video",
    execute: async (input, runContext) => {
        const { credentials, organizationId } = await requireHiggsfieldCredentials(input.integrationId, runContext)
        const generated = await generateHiggsfieldVideos(credentials, {
            imageUrl: input.imageUrl,
            prompt: input.prompt,
            model: input.model,
            motionId: input.motionId,
            motionStrength: input.motionStrength,
            seed: input.seed
        })

        const videos = await Promise.all(generated.map(result => storeGeneratedAsset(result, organizationId, "video/mp4")))

        return {
            success: true,
            videos,
            count: videos.length,
            actions: [higgsfieldAction("Generated video creative", `Animated 1 image into ${videos.length} video(s) for "${input.prompt}"`)]
        }
    }
})
