import logger from "../../common/logger"

const MANIFEST_ACCEPT_HEADERS = [
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.docker.distribution.manifest.list.v2+json"
].join(", ")

/**
 * Reads manifest digests from a public OCI registry. Artifact Registry serves anonymous manifest
 * requests for public repositories, so no credentials are involved and a probe never blocks a
 * deploy: any failure reads as "no such tag", which sends the build down the from-scratch path.
 */
export class PublicOciRegistryClient implements ContainerRegistryClient {
    constructor(private readonly timeoutMs: number = 3_000) {}

    async resolveDigest(reference: ImageReference): Promise<string | undefined> {
        const url = `https://${reference.registry}/v2/${reference.repository}/manifests/${reference.tag}`
        try {
            const response = await fetch(url, {
                method: "HEAD",
                headers: { Accept: MANIFEST_ACCEPT_HEADERS },
                signal: AbortSignal.timeout(this.timeoutMs)
            })
            if (!response.ok) return undefined
            return response.headers.get("docker-content-digest") ?? undefined
        } catch (error) {
            logger.warn("Sandbox base image: registry probe failed, treating tag as absent", { url, errorMessage: error instanceof Error ? error.message : String(error) })
            return undefined
        }
    }
}

export interface ImageReference {
    registry: string
    repository: string
    tag: string
}

export interface ContainerRegistryClient {
    resolveDigest(reference: ImageReference): Promise<string | undefined>
}
