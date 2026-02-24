import { GoogleGenAI } from "@google/genai"
import { tool } from "@openai/agents"
import type { RunContext } from "@openai/agents"
import axios from "axios"
import { z } from "zod"

import type { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { emitAndPersistSnippetEvent } from "../../../agent/systemEvents/emitAndPersistSnippetEvent"
import { gemini } from "../../../config/settings"
import logger from "../../../logger"
import { assertInternalGcsBucketUrl, buildImageEditKey, ensureStoredWithMetadata } from "../../../services/FileStorageService"
import { ToolName } from "../../../tools/ToolNames"
import type { Session } from "../../../types/session"

export const imageEditTool = tool({
    name: ToolName.IMAGE_EDIT,
    description:
        "Edit or transform an image from a URL using a natural language prompt. Supports crops, style changes, object removal/addition, color adjustments, and other visual edits. The edited image is automatically sent to the chat UI for the user to see.",
    parameters: z.object({
        image_url: z.string().describe("URL of the image to edit. Must be a signed URL from our internal GCS image bucket."),
        prompt: z.string().describe("Natural language instruction describing how to edit the image.")
    }),
    execute: async ({ image_url, prompt }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        assertInternalGcsBucketUrl(image_url)

        // 1. Download source image
        const downloadResponse = await axios.get(image_url, { responseType: "arraybuffer" })
        const imageBuffer = Buffer.from(downloadResponse.data)
        const mimeType = (downloadResponse.headers["content-type"] || "image/png").split(";")[0].trim()
        const base64Image = imageBuffer.toString("base64")

        logger.info("Sending image to Gemini for editing", { image_url, prompt, mimeType })

        // 2. Call Gemini image model
        const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
        const geminiResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: [
                {
                    parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }]
                }
            ]
        })

        // 3. Extract generated image data
        const parts = geminiResponse.candidates?.[0]?.content?.parts ?? []
        const imagePart = parts.find(p => p.inlineData?.data)
        if (!imagePart?.inlineData?.data) {
            throw new Error("Gemini did not return an image. Try rephrasing the prompt.")
        }

        const outputBase64 = imagePart.inlineData.data
        const outputMimeType = imagePart.inlineData.mimeType || "image/png"
        const outputBuffer = Buffer.from(outputBase64, "base64")
        const ext = outputMimeType.split("/")[1] || "png"

        // 4. Upload to GCS
        const storageKey = buildImageEditKey(image_url, prompt)
        const storedFile = await ensureStoredWithMetadata(storageKey, async () => ({
            data: outputBuffer,
            mimeType: outputMimeType,
            filename: `edited-image.${ext}`
        }))

        if (!storedFile) {
            throw new Error("Failed to store the edited image.")
        }

        logger.info("Image edit complete", { image_url, storageKey, url: storedFile.url })

        // 5. Persist and emit image snippet for live + historical chat
        await emitAndPersistSnippetEvent({
            organizationId: runContext?.context?.user?.organizationId,
            runId: runContext?.context?.runId,
            agentId: runContext?.context?.agentId,
            snippet: { type: "image", url: storedFile.url }
        })

        return {
            success: true,
            url: storedFile.url,
            image_url: storedFile.url,
            summary: "Image edited successfully."
        }
    }
})
