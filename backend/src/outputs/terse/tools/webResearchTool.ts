import { WebConfig } from "terse-types"

import { getWebSearchService } from "../../../services/webSearch"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

export const webResearchTool = defineSessionTool({
    name: "web_research",
    execute: async ({ input, model }) => {
        const service = getWebSearchService()
        const result = await service.research({
            input,
            model: model ?? "auto"
        })
        return {
            success: true,
            ...result
        }
    }
})
