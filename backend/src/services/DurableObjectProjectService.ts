import { randomUUID } from "node:crypto"
import type { SdkDurableObjectEnvironment } from "terse-types"

import { db } from "../loaders/prisma"
import { settings } from "../settings"

import { DURABLE_OBJECT_STORAGE_REGION, DurableObjectControlPlaneClient } from "./DurableObjectControlPlaneClient"
import type { DurableObjectControlPlane, DurableObjectControlPlaneConfig } from "./DurableObjectControlPlaneClient"
import { SDK_SOURCE_IMAGE_PROJECT_DIR } from "./sdkRuntimeExecutors/types"

const ACTOR_ENTRYPOINT = "src/durable-objects.ts"
const LOCAL_EXECUTION_DEADLINE_MS = 24 * 60 * 60 * 1000

class DurableObjectProjectService {
    private static instance: DurableObjectProjectService | undefined

    private constructor(private readonly controlPlane: DurableObjectControlPlane) {}

    static getInstance(config: DurableObjectControlPlaneConfig): DurableObjectProjectService {
        if (!DurableObjectProjectService.instance) {
            DurableObjectProjectService.instance = new DurableObjectProjectService(DurableObjectControlPlaneClient.getInstance(config))
        }
        return DurableObjectProjectService.instance
    }

    async registerDeployment(namespaceId: string, image: DurableObjectProjectImage): Promise<void> {
        await this.controlPlane.registerDeployment(namespaceId, {
            codeRevision: image.buildHash,
            imageRef: image.imageRef,
            workingDirectory: SDK_SOURCE_IMAGE_PROJECT_DIR,
            actorEntrypoint: ACTOR_ENTRYPOINT
        })
    }

    async issueLocalTestEnvironment(projectId: string): Promise<SdkDurableObjectEnvironment | undefined> {
        const image = await this.activeProjectImage(projectId)
        if (!image) return undefined

        const namespaceId = `test.${projectId}`
        await this.registerDeployment(namespaceId, image)

        const deadlineUnixMs = Date.now() + LOCAL_EXECUTION_DEADLINE_MS
        const token = await this.controlPlane.issueWorkflowToken(namespaceId, `local-test.${randomUUID()}`, DURABLE_OBJECT_STORAGE_REGION, deadlineUnixMs)
        return {
            token: token.token,
            namespaceId,
            controlPlaneUrl: this.controlPlane.controlPlaneUrl,
            socketGatewayUrl: settings.durableObjects?.socketGatewayUrl ?? this.controlPlane.controlPlaneUrl,
            expiresAtMs: token.expiresAtMs
        }
    }

    private async activeProjectImage(projectId: string): Promise<DurableObjectProjectImage | undefined> {
        const deploy = await db().project_deploys.findFirst({
            where: { project_id: projectId, status: "SUCCEEDED" },
            orderBy: { created_at: "desc" },
            select: {
                sdk_source_image: {
                    select: { build_hash: true, image_id: true }
                }
            }
        })
        if (!deploy?.sdk_source_image) return undefined
        return {
            buildHash: deploy.sdk_source_image.build_hash,
            imageRef: deploy.sdk_source_image.image_id
        }
    }
}

export { DurableObjectProjectService }

export interface DurableObjectProjectImage {
    readonly buildHash: string
    readonly imageRef: string
}
