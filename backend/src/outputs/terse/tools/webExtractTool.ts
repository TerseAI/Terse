import { getWebSearchService } from "../../../services/webSearch"
import { defineTool } from "../../../tools/toolUtils"

export const webExtractTool = defineTool({
    name: "web_extract",
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
