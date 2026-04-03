import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { ChatAgentContext } from "../../../agent/ChatAgent/ChatAgentContext"
import { getWebSearchService } from "../../../services/webSearch"
import { TypedToolOptions, defineTool } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

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

export const chatWebExtractTool: TypedToolOptions<"web_extract", ChatAgentContext> = webExtractTool

export const runHistoryWebExtractTool: TypedToolOptions<"web_extract", SessionWithTracking<Session>> = webExtractTool
