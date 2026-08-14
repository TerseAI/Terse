import { ArtifactRegistryClient } from "@google-cloud/artifact-registry"

import logger from "../../common/logger"
import { settings } from "../../settings"

const GRPC_NOT_FOUND = 5
const ARTIFACT_REGISTRY_HOST_SUFFIX = "-docker.pkg.dev"

export class GoogleArtifactRegistryClient implements ContainerRegistryClient {
    constructor(
        private readonly client: ArtifactRegistryClient | undefined,
        private readonly timeoutMs: number = 3_000
    ) {}

    static fromSettings(): GoogleArtifactRegistryClient {
        return new GoogleArtifactRegistryClient(createArtifactRegistryClient())
    }

    async resolveDigest(reference: ImageReference): Promise<string | undefined> {
        if (this.client === undefined) {
            logger.warn("Sandbox base image: Artifact Registry unavailable without GCP credentials, treating tag as absent")
            return undefined
        }

        const parsed = parseArtifactRegistryReference(reference)
        if (parsed === undefined) {
            logger.warn("Sandbox base image: image reference is not Artifact Registry, treating tag as absent", reference)
            return undefined
        }

        const name = this.client.tagPath(parsed.project, parsed.location, parsed.repository, parsed.packageName, parsed.tag)
        try {
            const [tag] = await this.client.getTag({ name }, { timeout: this.timeoutMs })
            return digestFromVersionName(tag.version)
        } catch (error) {
            return digestAfterProbeFailure(name, error)
        }
    }
}

function createArtifactRegistryClient(): ArtifactRegistryClient | undefined {
    if (!settings.gcp) return undefined
    const credentials = JSON.parse(Buffer.from(settings.gcp.serviceAccountBase64, "base64").toString("utf-8"))
    return new ArtifactRegistryClient({ credentials, projectId: settings.gcp.projectId })
}

function parseArtifactRegistryReference(reference: ImageReference): ParsedArtifactRegistryReference | undefined {
    if (!reference.registry.endsWith(ARTIFACT_REGISTRY_HOST_SUFFIX)) return undefined
    const location = reference.registry.slice(0, -ARTIFACT_REGISTRY_HOST_SUFFIX.length)
    const [project, repository, ...packageParts] = reference.repository.split("/")
    if (location === "" || project === undefined || repository === undefined || packageParts.length === 0) return undefined
    return { project, location, repository, packageName: packageParts.join("/"), tag: reference.tag }
}

function digestFromVersionName(versionName: string | null | undefined): string | undefined {
    if (versionName === null || versionName === undefined) return undefined
    const versionId = decodeURIComponent(versionName.split("/").pop() ?? "")
    if (!versionId.startsWith("sha256:")) return undefined
    return versionId
}

function digestAfterProbeFailure(name: string, error: unknown): undefined {
    if (isGrpcNotFound(error)) return undefined
    logger.warn("Sandbox base image: registry probe failed, treating tag as absent", { name, errorMessage: error instanceof Error ? error.message : String(error) })
    return undefined
}

function isGrpcNotFound(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("code" in error)) return false
    return error.code === GRPC_NOT_FOUND || error.code === "5"
}

export interface ImageReference {
    registry: string
    repository: string
    tag: string
}

export interface ContainerRegistryClient {
    resolveDigest(reference: ImageReference): Promise<string | undefined>
}

interface ParsedArtifactRegistryReference {
    project: string
    location: string
    repository: string
    packageName: string
    tag: string
}
