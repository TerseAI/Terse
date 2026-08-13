import { Storage } from "@google-cloud/storage"
import crypto from "crypto"

import logger from "../../common/logger"
import { settings } from "../../settings"

const UPLOAD_URL_TTL_MS = 15 * 60 * 1000
const ARCHIVE_PREFIX = "sdk-deploys"
const ARCHIVE_CONTENT_TYPE = "application/zip"

/**
 * Holds a deploy's source archive between the CLI and the build.
 *
 * The CLI used to base64 the whole project into the deploy request body, which inflates it by a
 * third and buffers it in the control plane. Uploading straight to object storage keeps large
 * projects (data files, fixtures) off the request path entirely.
 */
export class GcsSourceArchiveStore implements SourceArchiveStore {
    private static instance: SourceArchiveStore | undefined

    private constructor(
        private readonly storage: Storage,
        private readonly bucket: string
    ) {}

    /** Undefined when GCS is not configured, e.g. self-host. Callers fall back to an inline upload. */
    static getInstance(): SourceArchiveStore | undefined {
        if (GcsSourceArchiveStore.instance) return GcsSourceArchiveStore.instance
        if (!settings.gcp || !settings.gcs.imageBucket) return undefined

        const credentials: unknown = JSON.parse(Buffer.from(settings.gcp.serviceAccountBase64, "base64").toString("utf-8"))
        const storage = new Storage({ projectId: settings.gcp.projectId, credentials: asCredentials(credentials) })
        GcsSourceArchiveStore.instance = new GcsSourceArchiveStore(storage, settings.gcs.imageBucket)
        return GcsSourceArchiveStore.instance
    }

    /**
     * A resumable session rather than a plain signed PUT, so one mechanism covers every size: a
     * small archive is a single chunk, and a large one (a project carrying data files) uploads in
     * chunks that can resume after a dropped connection instead of starting over.
     *
     * The session URI is a write capability for this object key alone, and the key is prefixed by
     * organization, so it can neither be pointed at another tenant's path nor read anything back.
     */
    async createUpload(organizationId: string): Promise<SourceArchiveUpload> {
        const objectKey = `${ARCHIVE_PREFIX}/${organizationId}/${crypto.randomUUID()}.zip`
        const [uploadUrl] = await this.storage
            .bucket(this.bucket)
            .file(objectKey)
            .createResumableUpload({ metadata: { contentType: ARCHIVE_CONTENT_TYPE } })

        return { objectKey, uploadUrl, contentType: ARCHIVE_CONTENT_TYPE, expiresAtMs: Date.now() + UPLOAD_URL_TTL_MS }
    }

    async download(objectKey: string, organizationId: string): Promise<Buffer> {
        assertOwnedBy(objectKey, organizationId)
        const [contents] = await this.storage.bucket(this.bucket).file(objectKey).download()
        return contents
    }

    /** Best-effort: a leftover archive is bounded by the bucket's lifecycle rule, not by this. */
    async discard(objectKey: string, organizationId: string): Promise<void> {
        try {
            assertOwnedBy(objectKey, organizationId)
            await this.storage.bucket(this.bucket).file(objectKey).delete()
        } catch (error) {
            logger.warn("Source archive: discard failed", { objectKey, errorMessage: error instanceof Error ? error.message : String(error) })
        }
    }
}

/** A signed URL says nothing about who may read the object back, so the key is checked on use. */
function assertOwnedBy(objectKey: string, organizationId: string): void {
    if (!objectKey.startsWith(`${ARCHIVE_PREFIX}/${organizationId}/`)) {
        throw new SourceArchiveAccessError(`Source archive ${objectKey} does not belong to this organization`)
    }
}

function asCredentials(parsed: unknown): { client_email: string; private_key: string } {
    if (typeof parsed === "object" && parsed !== null && "client_email" in parsed && "private_key" in parsed) {
        const { client_email, private_key } = parsed
        if (typeof client_email === "string" && typeof private_key === "string") return { client_email, private_key }
    }
    throw new Error("GCP_SERVICE_ACCOUNT_BASE64 does not contain a usable service account")
}

export class SourceArchiveAccessError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SourceArchiveAccessError"
    }
}

export interface SourceArchiveUpload {
    objectKey: string
    uploadUrl: string
    contentType: string
    expiresAtMs: number
}

export interface SourceArchiveStore {
    createUpload(organizationId: string): Promise<SourceArchiveUpload>
    download(objectKey: string, organizationId: string): Promise<Buffer>
    discard(objectKey: string, organizationId: string): Promise<void>
}
