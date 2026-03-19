import { Request, Response } from "express"

import { AttioIntegrationManager } from "../integrations/AttioIntegration"
import logger from "../logger"
import type { AttioAttribute, AttioObject, AttioObjectWithAttributes } from "../shared/types"

export async function getAttioIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new AttioIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Attio integrations:", { error })
        res.status(500).json({ error: "Failed to fetch Attio integrations" })
    }
}

export async function getAttioObjects(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const { integrationId } = req.params
    if (!integrationId) {
        res.status(400).json({ error: "Missing integrationId parameter" })
        return
    }

    try {
        const manager = new AttioIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            res.status(404).json({ error: "Attio integration not found or not connected" })
            return
        }

        const response = await fetch("https://api.attio.com/v2/objects", {
            headers: { Authorization: `Bearer ${accessToken}` }
        })

        if (!response.ok) {
            const errorText = await response.text()
            logger.error("Failed to fetch Attio objects", { status: response.status, error: errorText })
            res.status(response.status).json({ error: "Failed to fetch Attio objects" })
            return
        }

        const data = (await response.json()) as { data?: AttioObject[] }
        const objects = data?.data || []

        const objectsWithAttributes = await Promise.all(
            objects.map(async (obj): Promise<AttioObjectWithAttributes> => {
                const attrResponse = await fetch(`https://api.attio.com/v2/objects/${encodeURIComponent(obj.api_slug)}/attributes`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                })
                const attributes = attrResponse.ok ? ((await attrResponse.json()) as { data?: AttioAttribute[] })?.data || [] : []
                return { ...obj, attributes }
            })
        )

        res.status(200).json(objectsWithAttributes)
    } catch (error) {
        logger.error("Error fetching Attio objects:", { error })
        res.status(500).json({ error: "Failed to fetch Attio objects" })
    }
}

export const attioOAuthCallback = async (req: Request, res: Response) => {
    const integration = new AttioIntegrationManager()
    await integration.processInstallationCallback(req, res)
}
