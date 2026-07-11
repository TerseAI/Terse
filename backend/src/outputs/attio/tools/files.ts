import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioFileSchema } from "terse-types"
import type { AttioFile, AttioFilesRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import logger from "../../../common/logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"

import { AttioApiError, attioApiRequest, attioRequestData, attioRequestPage, buildQueryString, parseAttioData, resolveAttioAccessToken } from "./attioApi"

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const attioFilesTool = defineSessionTool({
    name: "attio_files",
    description: `Manage files attached to Attio records. Actions: 'list' (files on a record; cursor pagination), 'get' (file metadata), 'upload' (base64 content to native Attio storage, max 50 MB), 'get_download_url' (signed URL for a file), 'delete'.`,
    execute: async ({ integrationId, request }, runContext) => {
        logger.debug("Executing attio_files tool", { integrationId, action: request.action })
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await resolveAttioAccessToken(integrationId, runContext)

        try {
            return await executeFilesRequest(request, accessToken)
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error executing attio_files", { error: errorMessage, integrationId, action: request.action })
            throw new Error(errorMessage)
        }
    }
})

async function executeFilesRequest(request: AttioFilesRequest, accessToken: string): Promise<AttioFilesOutput> {
    switch (request.action) {
        case "list": {
            const query = buildQueryString({ object: request.objectSlug, record_id: request.recordId, limit: request.limit, cursor: request.cursor })
            const page = await attioRequestPage(accessToken, `/files${query}`, z.array(attioFileSchema), "files")
            return {
                success: true,
                action: request.action,
                files: page.data,
                count: page.data.length,
                nextCursor: page.nextCursor,
                actions: [fileAction("Listed files", `${request.objectSlug}/${request.recordId}`, `Found ${page.data.length} file(s)`, RunHistoryActionType.read)]
            }
        }
        case "get": {
            const file = await attioRequestData(accessToken, `/files/${encodeURIComponent(request.fileId)}`, attioFileSchema, "file")
            return {
                success: true,
                action: request.action,
                file,
                actions: [fileAction("Fetched file", request.fileId, "Fetched file metadata", RunHistoryActionType.read)]
            }
        }
        case "upload": {
            const file = await uploadFile(request, accessToken)
            return {
                success: true,
                action: request.action,
                file,
                actions: [fileAction("Uploaded file", `${request.objectSlug}/${request.recordId}`, `Uploaded "${request.fileName}"`, RunHistoryActionType.create)]
            }
        }
        case "get_download_url": {
            const downloadUrl = await fetchDownloadUrl(request.fileId, accessToken)
            return { success: true, action: request.action, downloadUrl, actions: [fileAction("Fetched download URL", request.fileId, "Fetched signed download URL", RunHistoryActionType.read)] }
        }
        case "delete": {
            await attioApiRequest(accessToken, `/files/${encodeURIComponent(request.fileId)}`, { method: "DELETE" })
            return { success: true, action: request.action, deleted: true, actions: [fileAction("Deleted file", request.fileId, "Permanently deleted file", RunHistoryActionType.delete)] }
        }
        default:
            throw request satisfies never
    }
}

async function uploadFile(request: Extract<AttioFilesRequest, { action: "upload" }>, accessToken: string): Promise<AttioFile> {
    const content = Buffer.from(request.contentBase64, "base64")
    if (content.byteLength > MAX_UPLOAD_BYTES) {
        throw new Error(`File is ${content.byteLength} bytes; Attio's upload limit is 50 MB.`)
    }

    const form = new FormData()
    form.append("file", new Blob([content], { type: request.contentType ?? "application/octet-stream" }), request.fileName)
    form.append("object", request.objectSlug)
    form.append("record_id", request.recordId)

    const response = await fetch("https://api.attio.com/v2/files/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
    })
    if (!response.ok) {
        throw new AttioApiError(response.status, await response.text())
    }
    return parseAttioData(await response.json(), attioFileSchema, "file")
}

async function fetchDownloadUrl(fileId: string, accessToken: string): Promise<string> {
    const response = await fetch(`https://api.attio.com/v2/files/${encodeURIComponent(fileId)}/download`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: "manual"
    })
    const location = response.headers.get("location")
    if (!location) {
        throw new AttioApiError(response.status, await response.text())
    }
    return location
}

function fileAction(action: string, target: string, details: string, type: RunHistoryActionType) {
    return { action, integration: IntegrationType.ATTIO, target, details, type }
}

type AttioFilesOutput = ToolOutputByName["attio_files"]
