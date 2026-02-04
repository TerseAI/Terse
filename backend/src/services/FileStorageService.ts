import { File, Storage } from "@google-cloud/storage"
import crypto from "crypto"

import { gcp, gcs } from "../config/settings"
import logger from "../logger"

// Check if GCS is configured
if (!gcp.serviceAccountBase64 || !gcp.projectId || !gcs.imageBucket) {
    logger.warn("GCS not configured - file storage disabled. Set GCP_SERVICE_ACCOUNT_BASE64, GCP_PROJECT_ID, and GCS_IMAGE_BUCKET to enable.")
    throw new Error("GCS not configured - file storage disabled. Set GCP_SERVICE_ACCOUNT_BASE64, GCP_PROJECT_ID, and GCS_IMAGE_BUCKET to enable.")
}

export enum FileCategory {
    IMAGE = "image",
    DOCUMENT = "document",
    UNSUPPORTED = "unsupported"
}

export interface StoredFile {
    url: string
    mimeType: string
    category: FileCategory
    filename?: string
    sizeBytes?: number
}

export interface FileDownloadResult {
    data: Buffer
    mimeType: string
    filename?: string
}

export type FileDownloadFn = () => Promise<FileDownloadResult>

// MIME type to category mapping
const MIME_TYPE_CATEGORIES: Record<string, FileCategory> = {
    // Images
    "image/png": FileCategory.IMAGE,
    "image/jpeg": FileCategory.IMAGE,
    "image/jpg": FileCategory.IMAGE,
    "image/gif": FileCategory.IMAGE,
    "image/webp": FileCategory.IMAGE,
    "image/bmp": FileCategory.IMAGE,
    "image/svg+xml": FileCategory.IMAGE,
    "image/tiff": FileCategory.IMAGE,
    // Documents
    "application/pdf": FileCategory.DOCUMENT
}

// File extensions for fallback categorization
const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
    // Images
    ".png": FileCategory.IMAGE,
    ".jpg": FileCategory.IMAGE,
    ".jpeg": FileCategory.IMAGE,
    ".gif": FileCategory.IMAGE,
    ".webp": FileCategory.IMAGE,
    ".bmp": FileCategory.IMAGE,
    ".svg": FileCategory.IMAGE,
    ".tiff": FileCategory.IMAGE,
    ".tif": FileCategory.IMAGE,

    // Documents
    ".pdf": FileCategory.DOCUMENT
}

// Presigned URL expiry: 24 hours
const PRESIGNED_URL_EXPIRY_MS = 24 * 60 * 60 * 1000

// Max file size (50MB, OpenAI's limit)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

let storageClient: Storage | null = null

export function classifyFile(mimeType?: string, filename?: string): FileCategory {
    // Try MIME type first
    const category = classifyFileByMimeType(mimeType)
    if (category !== FileCategory.UNSUPPORTED) {
        return category
    }
    return classifyFileByExtension(filename)
}

export function classifyFileByMimeType(mimeType?: string): FileCategory {
    if (mimeType) {
        const normalizedMime = mimeType.toLowerCase().split(";")[0].trim()
        if (MIME_TYPE_CATEGORIES[normalizedMime]) {
            return MIME_TYPE_CATEGORIES[normalizedMime]
        }
    }
    return FileCategory.UNSUPPORTED
}

export function classifyFileByExtension(filename?: string): FileCategory {
    if (filename) {
        const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]
        if (ext && EXTENSION_CATEGORIES[ext]) {
            return EXTENSION_CATEGORIES[ext]
        }
    }
    return FileCategory.UNSUPPORTED
}

export function isSupportedFileType(mimeType?: string, filename?: string): boolean {
    return classifyFile(mimeType, filename) !== FileCategory.UNSUPPORTED
}

function getStorageClient(): Storage | null {
    if (storageClient !== null) {
        return storageClient
    }

    if (!gcp.serviceAccountBase64 || !gcp.projectId || !gcs.imageBucket) {
        throw new Error("GCS not configured - file storage disabled. Set GCP_SERVICE_ACCOUNT_BASE64, GCP_PROJECT_ID, and GCS_IMAGE_BUCKET to enable.")
    }

    try {
        // Decode service account credentials from base64
        const serviceAccountJson = Buffer.from(gcp.serviceAccountBase64, "base64").toString("utf-8")
        const credentials = JSON.parse(serviceAccountJson)

        storageClient = new Storage({
            projectId: gcp.projectId,
            credentials
        })
        logger.info("GCS storage client initialized", { bucket: gcs.imageBucket, prefix: gcs.imagePrefix })
        return storageClient
    } catch (error) {
        logger.error("Failed to initialize GCS storage client", { error })
        return null
    }
}

function sanitizeObjectKey(primaryKey: string): string {
    // Allow alphanumeric, dots, underscores, hyphens, and forward slashes
    // Replace anything else with underscore
    return primaryKey.replace(/[^a-zA-Z0-9._\-\/]/g, "_")
}

function buildObjectName(primaryKey: string): string {
    const sanitized = sanitizeObjectKey(primaryKey)
    if (gcs.imagePrefix) {
        return `${gcs.imagePrefix}/${sanitized}`
    }
    return sanitized
}

function getFile(primaryKey: string): File | null {
    const storage = getStorageClient()
    if (!storage || !gcs.imageBucket) {
        return null
    }
    const objectName = buildObjectName(primaryKey)
    return storage.bucket(gcs.imageBucket).file(objectName)
}

async function generatePresignedUrl(file: File): Promise<string> {
    const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + PRESIGNED_URL_EXPIRY_MS
    })
    return signedUrl
}

export async function ensureStoredWithMetadata(primaryKey: string, download: FileDownloadFn): Promise<StoredFile | null> {
    const file = getFile(primaryKey)

    if (!file) {
        logger.debug("GCS not configured, skipping file storage", { primaryKey })
        return null
    }

    try {
        // Check if object already exists
        const [exists] = await file.exists()
        if (exists) {
            const [metadata] = await file.getMetadata()
            const url = await generatePresignedUrl(file)
            const contentType = typeof metadata.contentType === "string" ? metadata.contentType : undefined
            const originalFilename = metadata.metadata?.originalFilename
            const filenameStr = typeof originalFilename === "string" ? originalFilename : undefined
            return {
                url,
                mimeType: contentType || "application/octet-stream",
                category: classifyFile(contentType, filenameStr),
                filename: filenameStr,
                sizeBytes: Number(metadata.size) || undefined
            }
        }

        // Download the file
        const { data, mimeType, filename } = await download()

        // Check file size
        if (data.length > MAX_FILE_SIZE_BYTES) {
            logger.warn("File exceeds maximum size limit, skipping", {
                primaryKey,
                sizeBytes: data.length,
                maxSizeBytes: MAX_FILE_SIZE_BYTES,
                filename
            })
            return null
        }

        // Classify the file
        const category = classifyFile(mimeType, filename)
        if (category === FileCategory.UNSUPPORTED) {
            logger.debug("Unsupported file type, skipping", { primaryKey, mimeType, filename })
            return null
        }

        // Upload to GCS
        await file.save(data, {
            contentType: mimeType,
            metadata: {
                cacheControl: "public, max-age=86400",
                originalFilename: filename
            }
        })

        const url = await generatePresignedUrl(file)

        logger.info("File uploaded to GCS", {
            primaryKey,
            mimeType,
            sizeBytes: data.length,
            filename,
            category
        })

        return {
            url,
            mimeType,
            category,
            filename,
            sizeBytes: data.length
        }
    } catch (error) {
        logger.error("Error storing file in GCS", { primaryKey, error })
        return null
    }
}

// Helper functions for generating primary keys

export function md5Hash(input: string): string {
    return crypto.createHash("md5").update(input, "utf8").digest("hex")
}

export function buildGmailFileKey(integrationId: string, messageId: string, attachmentId: string): string {
    const hash = md5Hash(`${messageId}/${attachmentId}`)
    return `gmail/${integrationId}/${hash}`
}

export function buildSlackFileKey(teamId: string, fileId: string): string {
    const hash = md5Hash(fileId)
    return `slack/${teamId}/${hash}`
}

// Organization logo helpers

export function buildOrgLogoKey(workosOrgId: string): string {
    return `org-logos/${workosOrgId}`
}

export async function getOrgLogoUploadUrl(workosOrgId: string, contentType: string): Promise<string | null> {
    const primaryKey = buildOrgLogoKey(workosOrgId)
    const file = getFile(primaryKey)

    if (!file) {
        logger.debug("GCS not configured, cannot generate upload URL", { workosOrgId })
        return null
    }

    try {
        const [signedUrl] = await file.getSignedUrl({
            version: "v4",
            action: "write",
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType
        })
        return signedUrl
    } catch (error) {
        logger.error("Error generating org logo upload URL", { workosOrgId, error })
        return null
    }
}

export async function getOrgLogoDownloadUrl(workosOrgId: string): Promise<string | null> {
    const primaryKey = buildOrgLogoKey(workosOrgId)
    const file = getFile(primaryKey)

    if (!file) {
        return null
    }

    try {
        const [exists] = await file.exists()
        if (!exists) {
            return null
        }
        return await generatePresignedUrl(file)
    } catch (error) {
        logger.error("Error getting org logo download URL", { workosOrgId, error })
        return null
    }
}
