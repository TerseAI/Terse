import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, attioFileSchema } from "terse-types"
import type { AttioDeleteFileRequest, AttioFile, AttioReadFilesRequest, AttioUploadFileRequest, ToolOutputByName } from "terse-types"
import { z } from "zod"

import { defineSessionTool } from "../../../tools/toolUtils"

import { AttioApiError, attioApiRequest, attioRequestData, attioRequestPage, attioToolExecute, buildQueryString, parseAttioData } from "./attioApi"

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const attioReadFilesTool = defineSessionTool({
    name: "attio_read_files",
    description: `Read files attached to Attio records. Actions: 'list' (files on a record; cursor pagination), 'get' (file metadata), 'get_download_url' (signed URL for a file).`,
    execute: attioToolExecute("attio_read_files", executeReadFilesRequest)
})

export const attioUploadFileTool = defineSessionTool({
    name: "attio_upload_file",
    description: `Upload a file to an Attio record from base64 content (native Attio storage, max 50 MB).`,
    execute: attioToolExecute("attio_upload_file", uploadFileRequest)
})

export const attioDeleteFileTool = defineSessionTool({
    name: "attio_delete_file",
    description: `Permanently delete a file from Attio (deleting a folder deletes its descendants).`,
    execute: attioToolExecute("attio_delete_file", deleteFile)
})

async function executeReadFilesRequest(request: AttioReadFilesRequest, accessToken: string): Promise<AttioFilesOutput> {
    switch (request.action) {
        case "list": {
            const query = buildQueryString({ object: request.objectSlug, record_id: request.recordId, limit: request.limit, cursor: request.cursor })
            const page = await attioRequestPage(accessToken, `/files${query}`, z.array(attioFileSchema), "files")
            return {
                files: page.data,
                count: page.data.length,
                nextCursor: page.nextCursor,
                actions: [fileAction("Listed files", `${request.objectSlug}/${request.recordId}`, `Found ${page.data.length} file(s)`, RunHistoryActionType.read)]
            }
        }
        case "get": {
            const file = await attioRequestData(accessToken, `/files/${encodeURIComponent(request.fileId)}`, attioFileSchema, "file")
            return {
                file,
                actions: [fileAction("Fetched file", request.fileId, "Fetched file metadata", RunHistoryActionType.read)]
            }
        }
        case "get_download_url": {
            const downloadUrl = await fetchDownloadUrl(request.fileId, accessToken)
            return { downloadUrl, actions: [fileAction("Fetched download URL", request.fileId, "Fetched signed download URL", RunHistoryActionType.read)] }
        }
        default:
            throw request satisfies never
    }
}

async function uploadFileRequest(request: AttioUploadFileRequest, accessToken: string): Promise<AttioFilesOutput> {
    const file = await uploadFile(request, accessToken)
    return {
        file,
        actions: [fileAction("Uploaded file", `${request.objectSlug}/${request.recordId}`, `Uploaded "${request.fileName}"`, RunHistoryActionType.create)]
    }
}

async function deleteFile(request: AttioDeleteFileRequest, accessToken: string): Promise<AttioFilesOutput> {
    await attioApiRequest(accessToken, `/files/${encodeURIComponent(request.fileId)}`, { method: "DELETE" })
    return { actions: [fileAction("Deleted file", request.fileId, "Permanently deleted file", RunHistoryActionType.delete)] }
}

async function uploadFile(request: AttioUploadFileRequest, accessToken: string): Promise<AttioFile> {
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

type AttioFilesOutput = ToolOutputByName["attio_read_files"]
