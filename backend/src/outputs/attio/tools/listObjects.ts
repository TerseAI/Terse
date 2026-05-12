import { RunHistoryActionType } from "@prisma/client"
import { AttioOutputConfig, IntegrationType } from "terse-types"
import type { AttioAttribute, AttioObject } from "terse-types"

import { AttioIntegrationManager } from "../../../integrations/AttioIntegration"
import logger from "../../../logger"
import { defineSessionTool, formatError } from "../../../tools/toolUtils"
import { ToolACLValidator, verifyIntegrationIdExists } from "../../abstract/acl"

export const attioListObjectsTool = defineSessionTool({
    name: "attio_list_objects",
    description: `List all available object types in the Attio workspace, including their attributes and field definitions. Use this to discover what object types (e.g. people, companies, deals) exist and what attributes are available before creating or updating records.`,
    execute: async ({ integrationId }, runContext) => {
        logger.debug("Executing attio_list_objects tool", { integrationId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new AttioIntegrationManager()
        const orgIntegrations = await manager.getInstancesForOrganization(runContext.context.user.organizationId)
        if (!orgIntegrations.some(i => i.id === integrationId)) {
            throw new Error("Attio integration not found or not authorized for this organization.")
        }

        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error("Failed to get Attio access token. The integration may not be connected.")
        }

        try {
            const response = await fetch("https://api.attio.com/v2/objects", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })

            if (!response.ok) {
                const errorText = await response.text()
                logger.error("Attio list objects failed", { status: response.status, error: errorText })
                throw new Error(`Attio API error (${response.status}): ${errorText}`)
            }

            const data = (await response.json()) as { data?: AttioObject[] }
            const objects = data?.data || []

            const objectsWithAttributes = await Promise.all(
                objects.map(async (obj: AttioObject) => {
                    const attrResponse = await fetch(`https://api.attio.com/v2/objects/${encodeURIComponent(obj.api_slug)}/attributes`, {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    })
                    const attributes = attrResponse.ok ? ((await attrResponse.json()) as { data?: AttioAttribute[] })?.data || [] : []
                    return { ...obj, attributes }
                })
            )

            const action = {
                action: "Listed objects",
                integration: IntegrationType.ATTIO,
                target: "Attio workspace",
                details: `Found ${objects.length} object type(s)`,
                type: RunHistoryActionType.read
            }

            return { success: true, objects: objectsWithAttributes, count: objectsWithAttributes.length, actions: [action] }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("Error listing Attio objects", { error: errorMessage, integrationId })
            throw new Error(errorMessage)
        }
    }
})

export const validateAttioListObjects: ToolACLValidator<"attio_list_objects", AttioOutputConfig> = ({ args, configs }) => verifyIntegrationIdExists(args.integrationId, configs)
