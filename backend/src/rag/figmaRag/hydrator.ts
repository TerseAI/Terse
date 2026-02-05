import { FigmaCommentEvent, fetchFigmaCommentThreadFromApi, fetchFileMetadata, resolvePositioningContext } from "../../integrations/FigmaIntegration"
import { isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { IntegrationType } from "../../shared/Integrations"
import { FigmaCommentEventData } from "../../shared/types"
import { HydratorType } from "../../types/rag"
import { HydrationContext, Hydrator, Identifiable } from "../Hydrator"

export class FigmaCommentEventHydrator extends Hydrator<FigmaCommentEvent> {
    readonly entityType = HydratorType.FIGMA_COMMENT_EVENT

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<FigmaCommentEvent> {
        const event = await this.fetchFromFigma(ref.entityId)
        if (!event) {
            throw new Error(`Failed to hydrate Figma comment event: ${ref.entityId}`)
        }
        return event
    }

    async hydrateBulk(refs: Identifiable[]): Promise<FigmaCommentEvent[]> {
        const results = await Promise.all(refs.map(ref => this.fetchFromFigma(ref.entityId)))
        return results.map((event, i) => {
            if (!event) {
                throw new Error(`Failed to hydrate Figma comment event: ${refs[i].entityId}`)
            }
            return event
        })
    }

    private async fetchFromFigma(entityId: string): Promise<FigmaCommentEvent | null> {
        const parts = entityId.split(":")
        if (parts.length < 2) {
            logger.error(`Invalid Figma entityId format: ${entityId}`)
            return null
        }
        const [fileKey, commentId] = parts

        if (!this.ctx.organizationId) {
            logger.error("Figma hydrator requires organizationId in context")
            return null
        }

        const integration = await db().figma_integrations.findFirst({
            where: { organization_id: this.ctx.organizationId }
        })
        if (!integration) {
            logger.error(`No Figma integration found for organization`)
            return null
        }

        const manager = INTEGRATION_REGISTRY.find(m => m.integrationType === IntegrationType.FIGMA)
        if (!manager || !isOAuthIntegrationInstallation(manager)) {
            return null
        }
        const accessToken = await manager.getAccessToken(integration.id)
        if (!accessToken) {
            logger.error(`Could not get Figma access token for ${integration.id}`)
            return null
        }

        try {
            const commentThreadData = await fetchFigmaCommentThreadFromApi(accessToken, fileKey, commentId)
            if (!commentThreadData) {
                return null
            }
            const { comment: commentFromApi, thread } = commentThreadData
            const { positioningData } = resolvePositioningContext(commentFromApi, thread)
            const fileMetadata = await fetchFileMetadata(accessToken, fileKey)

            const threadEntries = thread.map(c => ({
                id: c.id,
                message: c.message,
                author: c.user,
                createdAt: c.created_at,
                resolvedAt: c.resolved_at,
                parentId: c.parent_id ?? null,
                orderId: c.order_id,
                isRoot: !c.parent_id
            }))

            const data: FigmaCommentEventData = {
                commentId,
                fileKey,
                fileUrl: fileMetadata?.url ?? `https://www.figma.com/file/${fileKey}`,
                message: commentFromApi.message ?? "",
                author: commentFromApi.user,
                createdAt: commentFromApi.created_at,
                resolved: commentFromApi.resolved_at !== null,
                thread: threadEntries,
                fileMetadata: fileMetadata ?? undefined,
                positioningData: positioningData ?? undefined
            }
            return new FigmaCommentEvent(data)
        } catch (error) {
            logger.error(`Failed to fetch Figma comment ${commentId}`, { error, entityId })
            return null
        }
    }
}
