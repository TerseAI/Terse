import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import type { ToolOutputByName } from "../../../shared/types"
import { ToolName } from "../../../tools/ToolNames"
import { Session } from "../../../types/session"
import { createGitHubClient, getFileContents, getGitHubAccessToken, parseRepoFullName } from "../githubApiClient"

/**
 * Tool for reading file contents from GitHub repositories.
 * Uses GitHub's Contents API to fetch file contents from the default branch.
 */
export const readGitHubFileTool = tool<z.ZodObject<any>, SessionWithTracking<Session>, ToolOutputByName["readGitHubFile"]>({
    name: ToolName.GITHUB_READ_FILE,
    description: `Read the full contents of a file from a GitHub repository. Use this after finding relevant files via search to:
- Understand the complete implementation of a function or class
- See imports and dependencies
- Review the full context around a code snippet
- Understand file structure and organization

Note: This reads from the default branch (main/master). Large files may be truncated.`,
    parameters: z.object({
        repository: z.string().describe('The repository in "owner/repo" format (e.g., "facebook/react"). Must be one of the configured repositories.'),
        path: z.string().describe('The file path within the repository (e.g., "src/components/Button.tsx" or "README.md")'),
        startLine: z.union([z.number(), z.null()]).describe("Start reading from this line number (1-indexed). Use with endLine for partial file reads. Use null to start from beginning."),
        endLine: z.union([z.number(), z.null()]).describe("Stop reading at this line number (1-indexed, inclusive). Use with startLine for partial file reads. Use null to read to end.")
    }),
    execute: async ({ repository, path, startLine, endLine }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await getGitHubAccessToken(runContext.context.user.id)
        if (!accessToken) {
            throw new Error(`GitHub access token not found for user`)
        }

        const client = createGitHubClient(accessToken)
        const { owner, repo } = parseRepoFullName(repository)

        const requestParams = {
            tool: "readGitHubFile",
            repository,
            owner,
            repo,
            path,
            startLine,
            endLine
        }
        logger.info("[GitHub KB] readGitHubFile - Request", requestParams)
        logger.debug("[GitHub KB] readGitHubFile - Full request params", { requestParams })

        try {
            const fileContent = await getFileContents(client, owner, repo, path)

            logger.debug("[GitHub KB] readGitHubFile - Raw API response", {
                name: fileContent.name,
                path: fileContent.path,
                sha: fileContent.sha,
                size: fileContent.size,
                encoding: fileContent.encoding,
                contentLength: fileContent.content.length
            })

            let content = fileContent.content
            let totalLines = content.split("\n").length
            let displayedLines = { start: 1, end: totalLines }

            // Handle line range if specified
            if (startLine !== undefined || endLine !== undefined) {
                const lines = content.split("\n")
                const start = Math.max(1, startLine || 1) - 1 // Convert to 0-indexed
                const end = Math.min(lines.length, endLine || lines.length)
                content = lines.slice(start, end).join("\n")
                displayedLines = { start: start + 1, end }
            }

            // Add line numbers to content for easier reference
            const numberedContent = content
                .split("\n")
                .map((line, index) => {
                    const lineNum = (displayedLines.start + index).toString().padStart(4, " ")
                    return `${lineNum} | ${line}`
                })
                .join("\n")

            // Warn if file is very large
            const isLarge = totalLines > 500
            const isTruncated = content.length > 100000 // ~100KB limit

            let finalContent = numberedContent
            if (isTruncated) {
                finalContent = numberedContent.substring(0, 100000) + "\n... (file truncated, use startLine/endLine to read specific sections)"
            }

            // Build URL with line number if startLine is provided
            let fileUrl = fileContent.htmlUrl
            if (startLine !== null && startLine !== undefined) {
                if (endLine !== null && endLine !== undefined && endLine !== startLine) {
                    fileUrl = `${fileContent.htmlUrl}#L${startLine}-L${endLine}`
                } else {
                    fileUrl = `${fileContent.htmlUrl}#L${startLine}`
                }
            }

            const response = {
                success: true,
                repository,
                path,
                url: fileUrl,
                totalLines,
                displayedLines: `${displayedLines.start}-${displayedLines.end}`,
                size: fileContent.size,
                content: finalContent,
                warning: isLarge && !startLine ? `This file has ${totalLines} lines. Consider using startLine/endLine to read specific sections.` : undefined
            }

            logger.info("[GitHub KB] readGitHubFile - Response", {
                success: true,
                totalLines,
                displayedLines: `${displayedLines.start}-${displayedLines.end}`,
                size: fileContent.size,
                isTruncated
            })
            logger.debug("[GitHub KB] readGitHubFile - Full response (excluding content)", {
                ...response,
                content: `[${finalContent.length} chars]`
            })

            // Return action as part of the result
            const action = {
                action: "Read GitHub file",
                integration: IntegrationType.GITHUB,
                target: repository,
                details: `Read file "${path}"${startLine && endLine ? ` (lines ${displayedLines.start}-${displayedLines.end})` : ""} (${totalLines} total lines${isTruncated ? ", truncated" : ""})`,
                url: fileUrl,
                type: RunHistoryActionType.read,
                isReadOnly: true
            }

            return {
                ...response,
                actions: [action]
            }
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error("[GitHub KB] readGitHubFile - Failed", {
                repository,
                path,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            })
            const tip = errorMessage.includes("not a file")
                ? "This path is a directory. Use listGitHubDirectory to see its contents."
                : "Check that the file path is correct. Use searchGitHubCode to find files."
            throw new Error(`${errorMessage}. ${tip}`)
        }
    }
})
