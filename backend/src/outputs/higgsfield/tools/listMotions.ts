import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import { listHiggsfieldMotions } from "../../../integrations/higgsfield/apiClient"
import { defineSessionTool } from "../../../tools/toolUtils"

import { requireHiggsfieldCredentials } from "./toolContext"

export const higgsfieldListMotionsTool = defineSessionTool({
    name: "higgsfield_list_motions",
    execute: async (input, runContext) => {
        const { credentials } = await requireHiggsfieldCredentials(input.integrationId, runContext)
        const motions = await listHiggsfieldMotions(credentials)

        return {
            success: true,
            motions,
            count: motions.length,
            actions: [
                {
                    action: "Listed motion presets",
                    integration: IntegrationType.HIGGSFIELD,
                    target: "Higgsfield",
                    details: `Found ${motions.length} motion preset(s)`,
                    type: RunHistoryActionType.read,
                    isReadOnly: true
                }
            ]
        }
    }
})
