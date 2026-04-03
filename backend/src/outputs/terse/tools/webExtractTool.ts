import { ToolName } from "terse-types"
import { z } from "zod"

import { getWebSearchService } from "../../../services/webSearch"
import { TypedToolOptions } from "../../../tools/toolUtils"

const parameters = z.object({
    urls: z.union([z.string(), z.array(z.string())]).describe("URL or list of URLs to extract content from"),
    extract_depth: z.enum(["basic", "advanced"]).nullable().describe("'advanced' handles JavaScript-heavy pages but is slower")
})

export const webExtractTool: TypedToolOptions<typeof parameters, typeof ToolName.WEB_EXTRACT> = {
    name: ToolName.WEB_EXTRACT,
    description: "Extract the full text content from one or more web page URLs. Use this when you need to read the complete contents of a specific page.",
    parameters: parameters,
    execute: async ({ urls, extract_depth }) => {
        const service = getWebSearchService()
        const urlList = Array.isArray(urls) ? urls : [urls]
        const extractDepth = extract_depth ?? "basic"
        return service.extract({
            urls: urlList,
            extractDepth
        })
    }
}
