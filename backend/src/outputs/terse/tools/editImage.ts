import { GoogleGenAI } from "@google/genai"
import axios from "axios"
import { ImageEditConfig } from "terse-types"

import { gemini } from "../../../config/settings"
import logger from "../../../logger"
import { assertInternalGcsBucketUrl, buildImageEditKey, ensureStoredWithMetadata } from "../../../services/FileStorageService"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

export const imageEditTool = defineSessionTool({
    name: "image_edit",
    description:
        "Edit or transform an image from a URL using a natural language prompt. Supports crops, style changes, object removal/addition, color adjustments, and other visual edits. The edited image is automatically sent to the chat UI for the user to see.",
    execute: async ({ image_url, prompt }) => {
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

        return {
            success: true,
            url: storedFile.url,
            image_url: storedFile.url,
            summary: "Image edited successfully.",
            snippets: [{ type: "image", url: storedFile.url }]
        }
    }
})
