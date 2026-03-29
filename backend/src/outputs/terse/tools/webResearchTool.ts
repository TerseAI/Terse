import { z } from "zod"

import { getWebSearchService } from "../../../services/webSearch"
import { ToolName } from "../../../tools/ToolNames"
import { SessionToolOptions } from "../../../tools/toolUtils"

const parameters = z.object({
    input: z.string().describe("The research question or topic to investigate"),
    model: z.enum(["mini", "pro", "auto"]).nullable().describe("'mini' for quick focused research, 'pro' for comprehensive multi-angle research, 'auto' picks automatically")
})

export const webResearchTool: SessionToolOptions<typeof parameters> = {
    name: ToolName.WEB_RESEARCH,
    description:
        "Conduct deep, multi-source research on a topic. Autonomously searches across many sources and returns a comprehensive report with citations. Best for complex questions requiring synthesis across multiple sources. Takes longer than a regular search (up to 2 minutes).",
    parameters: parameters,
    execute: async ({ input, model }) => {
        const service = getWebSearchService()
        return service.research({
            input,
            model: model ?? "auto"
        })
    }
}
