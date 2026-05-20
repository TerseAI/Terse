import { getWebSearchService } from "../../../services/webSearch"
import { defineTool } from "../../../tools/toolUtils"

export const webExtractTool = defineTool({
    name: "web_extract",
    description: "Extract the full text content from one or more web page URLs. Use this when you need to read the complete contents of a specific page.",
    execute: async ({ urls, extract_depth }) => {
        const service = getWebSearchService()
        const urlList = Array.isArray(urls) ? urls : [urls]
        const extractDepth = extract_depth ?? "basic"
        return service.extract({
            urls: urlList,
            extractDepth
        })
    }
})
