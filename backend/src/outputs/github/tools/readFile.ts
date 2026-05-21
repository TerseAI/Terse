import { RunHistoryActionType } from "@prisma/client"
import { GitHubConfig, IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"
import { createGitHubClient, getFileContents, getGitHubAccessToken, parseRepoFullName } from "../githubApiClient"

import { validateGitHubRepository } from "./searchCode"

/**
 * Tool for reading file contents from GitHub repositories.
 * Uses GitHub's Contents API to fetch file contents from the default branch.
 */
export const readGitHubFileTool = defineSessionTool({
    name: "readGitHubFile",
    description: `Read the full contents of a file from a GitHub repository. Use this after finding relevant files via search to:
- Understand the complete implementation of a function or class
- See imports and dependencies
- Review the full context around a code snippet
- Understand file structure and organization

Note: This reads from the default branch (main/master). Large files may be truncated.`,
    strict: true,
    execute: async ({ repository, path, startLine, endLine }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const accessToken = await getGitHubAccessToken(runContext.context.user.id, runContext.context.user.organizationId)
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
            const errorMessage = extractErrorMessage(error)
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

export const validateReadGitHubFile: ToolACLValidator<"readGitHubFile", GitHubConfig> = ({ args, configs, runContext }) => validateGitHubRepository(args.repository, configs, runContext)
