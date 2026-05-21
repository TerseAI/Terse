import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { JudgeAgentOutputType } from "../agent/JudgeAgent/JudgeAgent"
import { buildClaudeCodePrompt } from "../agent/JudgeAgent/buildClaudeCodePrompt"
import { JudgeContext } from "../agent/JudgeAgent/fetchJudgeContext"
import { settings } from "../config/settings"
import logger from "../logger"

import { AnthropicAdminService } from "./AnthropicAdminService"
import { ClaudeCodeSandboxService } from "./ClaudeCodeSandboxService"
import { downloadSdkDeployZip } from "./FileStorageService"
import { AnthropicProxyTokenService } from "./anthropicProxy/AnthropicProxyTokenService"

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFilePath)

const PLUGIN_SANDBOX_DIR = "/tmp/terse-plugin"

function resolvePluginRoot(): string | null {
    // Production: plugin copied into dist/ by postbuild
    const fromDist = path.resolve(currentDir, "..", "terse-claude-plugin")
    if (fs.existsSync(fromDist)) return fromDist

    // Development: plugin lives in packages/ relative to repo root
    const fromSrc = path.resolve(currentDir, "..", "..", "packages", "terse-claude-plugin")
    if (fs.existsSync(fromSrc)) return fromSrc

    return null
}

function loadPluginFiles(): Record<string, string> {
    const pluginRoot = resolvePluginRoot()
    if (!pluginRoot) return {}

    const files: Record<string, string> = {}

    function walk(dir: string, prefix: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name)
            const sandboxPath = `${PLUGIN_SANDBOX_DIR}/${prefix}${entry.name}`
            if (entry.isDirectory()) {
                walk(fullPath, `${prefix}${entry.name}/`)
            } else if (entry.isFile()) {
                files[sandboxPath] = fs.readFileSync(fullPath, "utf-8")
            }
        }
    }

    walk(pluginRoot, "")
    return files
}

const IMPROVEMENTS_SCHEMA = {
    type: "object",
    properties: {
        title: { type: "string", description: "Short headline for the review, under 8 words" },
        summary: { type: "string", description: "1-2 casual sentences summarizing the review" },
        improvements: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Short punchy title for the improvement" },
                    description: { type: "string", description: "1-2 plain sentences explaining what's wrong and what to do" },
                    targetArea: { type: "string", enum: ["code", "trigger_config", "output_config", "general"] },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    suggestedPatch: { type: "string", description: "The exact output of git diff for this improvement" }
                },
                required: ["title", "description", "targetArea", "confidence"]
            }
        }
    },
    required: ["title", "summary", "improvements"]
}

const SANDBOX_TIMEOUT_MS = 10 * 60 * 1000
// Token TTL is capped at 30 minutes regardless of sandbox timeout — the
// ephemeral key gets revoked in the finally{} block, and the proxy denylist
// catches anything that escaped before then. 30 min is the upper bound for
// a leaked token to be useful.
const PROXY_TOKEN_TTL_SECONDS = Math.min((SANDBOX_TIMEOUT_MS * 2) / 1000, 30 * 60)

export class SdkImprovementService {
    private sandbox = new ClaudeCodeSandboxService()
    private adminService = new AnthropicAdminService()
    private tokenService = new AnthropicProxyTokenService()

    async evaluate(automationId: string, context: JudgeContext): Promise<JudgeAgentOutputType> {
        const gcsKey = context.agentConfig.gcsKey

        if (!gcsKey) {
            logger.warn("[SdkImprovementService] No GCS key for source code", { automationId })
            return { title: "No source code available", summary: "Could not find source code to review.", improvements: [] }
        }

        const zipBuffer = await downloadSdkDeployZip(gcsKey)
        if (!zipBuffer) {
            logger.warn("[SdkImprovementService] Failed to download zip", { automationId })
            return { title: "Source code unavailable", summary: "Could not download source code.", improvements: [] }
        }

        const prompt = buildClaudeCodePrompt(automationId, context)

        const pluginFiles = loadPluginFiles()
        const hasPlugin = Object.keys(pluginFiles).length > 0
        if (!hasPlugin) {
            logger.warn("[SdkImprovementService] Terse plugin files not found, running without plugin", { automationId })
        }

        // Per-job ephemeral Anthropic key + opaque bearer token. The sandbox
        // sees the bearer token via ANTHROPIC_API_KEY and routes all Anthropic
        // traffic through the Terse proxy, which maps the token back to the
        // ephemeral key and forwards to api.anthropic.com.
        const jobId = `${automationId}-${crypto.randomBytes(8).toString("hex")}`
        let mintedKeyId: string | null = null
        let proxyToken: string | null = null

        try {
            const minted = await this.adminService.mintEphemeralKey({ label: jobId })
            mintedKeyId = minted.keyId
            await this.adminService.probeKey(minted.apiKey)
            proxyToken = await this.tokenService.mintToken({
                jobId,
                ttlSeconds: PROXY_TOKEN_TTL_SECONDS,
                ephemeralApiKey: minted.apiKey
            })

            const result = await this.sandbox.run({
                label: `sdk-improvement-${automationId}`,
                prompt,
                sourceZip: zipBuffer,
                gitInit: true,
                jsonSchema: IMPROVEMENTS_SCHEMA,
                timeoutMs: SANDBOX_TIMEOUT_MS,
                env: {
                    ANTHROPIC_API_KEY: proxyToken,
                    ANTHROPIC_BASE_URL: settings.terseAnthropicProxy.baseUrl
                },
                egressCidrAllowlist: [settings.terseAnthropicProxy.cidr],
                plugin: hasPlugin ? { files: pluginFiles, dir: PLUGIN_SANDBOX_DIR } : undefined
            })

            if (!result.stdout) {
                logger.error("[SdkImprovementService] No stdout from Claude Code", { automationId, exitCode: result.exitCode })
                return { title: "Review failed", summary: "Claude Code did not produce results.", improvements: [] }
            }

            return parseResults(result.stdout, automationId)
        } catch (error) {
            logger.error("[SdkImprovementService] Evaluation failed", { automationId, jobId, error })
            return { title: "Review failed", summary: "An error occurred during the review.", improvements: [] }
        } finally {
            // Revoke the Anthropic key first (kills the actual credential) and
            // the proxy token second (kills the lookup handle). Both can fail
            // independently — the reaper cron will sweep up any orphans.
            await Promise.allSettled([
                mintedKeyId ? this.adminService.revokeKey(mintedKeyId) : Promise.resolve(),
                proxyToken ? this.tokenService.revokeJobToken(jobId) : Promise.resolve()
            ])
        }
    }
}

function parseResults(fileContent: string, automationId: string): JudgeAgentOutputType {
    try {
        // Claude Code --output-format json writes: { type, result, structured_output, ... }
        // With --json-schema, the validated object is in structured_output
        const claudeOutput = JSON.parse(fileContent)
        const parsed = claudeOutput.structured_output ?? (typeof claudeOutput.result === "string" && claudeOutput.result ? JSON.parse(claudeOutput.result) : claudeOutput.result)

        if (!parsed || !parsed.title) {
            logger.error("[SdkImprovementService] No parseable result in Claude Code output", { automationId, keys: Object.keys(claudeOutput) })
            return { title: "Review failed", summary: "Claude Code did not return structured output.", improvements: [] }
        }

        return {
            title: parsed.title,
            summary: parsed.summary,
            improvements: (parsed.improvements ?? []).map((imp: Record<string, unknown>) => ({
                title: imp.title as string,
                description: imp.description as string,
                targetArea: imp.targetArea as string,
                confidence: imp.confidence as number,
                suggestedPatch: imp.suggestedPatch as string | undefined
            }))
        }
    } catch (error) {
        logger.error("[SdkImprovementService] Failed to parse Claude Code output", { automationId, error, contentLength: fileContent.length, contentTail: fileContent.slice(-300) })
        return { title: "Review failed", summary: "Could not parse improvement results.", improvements: [] }
    }
}
