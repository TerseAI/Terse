import crypto from "node:crypto"
import { resolve4 } from "node:dns/promises"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import logger from "../common/logger"
import { JudgeAgentOutputType } from "../modules/agents/JudgeAgent/JudgeAgent"
import { buildClaudeCodePrompt } from "../modules/agents/JudgeAgent/buildClaudeCodePrompt"
import { JudgeContext } from "../modules/agents/JudgeAgent/fetchJudgeContext"
import { settings } from "../settings"

import { ClaudeCodeSandboxService } from "./ClaudeCodeSandboxService"
import { LITELLM_MAIN_MODEL, LITELLM_SMALL_MODEL, LiteLLMKeyService } from "./LiteLLMKeyService"

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
// Modal sandbox CIDR allowlist accepts IPv4 only. Anthropic's IPv6 range (2607:6bc0::/48) is dropped;
// requests will fall back to IPv4 (160.79.104.0/23).
const ANTHROPIC_INBOUND_CIDRS = ["160.79.104.0/23"]

// Pin sandbox egress to the proxy's currently-resolved IPs. Render's addresses are dynamic (and are not
// Cloudflare's), so we resolve the proxy host at job time rather than hardcoding a provider range.
async function resolveEgressCidrs(baseUrl: string): Promise<string[]> {
    const host = new URL(baseUrl).hostname
    const ips = await resolve4(host)
    if (ips.length === 0) throw new Error(`Could not resolve LiteLLM host ${host} for egress allowlist`)
    return ips.map(ip => `${ip}/32`)
}

export class SdkImprovementService {
    private sandbox = new ClaudeCodeSandboxService()
    private litellmKeys = new LiteLLMKeyService()

    async evaluate(automationId: string, context: JudgeContext): Promise<JudgeAgentOutputType> {
        const { sourceImageId } = context

        if (!sourceImageId) {
            logger.warn("[SdkImprovementService] No SDK source image for automation", { automationId })
            return { title: "No source code available", summary: "Could not find source code to review.", improvements: [] }
        }

        const litellm = settings.litellm
        const improvementApiKey = settings.anthropic.improvementApiKey
        if (!litellm && !improvementApiKey) {
            throw new Error("LITELLM_BASE_URL or ANTHROPIC_IMPROVEMENT_API_KEY is required to run SDK improvement reviews")
        }

        const prompt = buildClaudeCodePrompt(automationId, context)

        const pluginFiles = loadPluginFiles()
        const hasPlugin = Object.keys(pluginFiles).length > 0
        if (!hasPlugin) {
            logger.warn("[SdkImprovementService] Terse plugin files not found, running without plugin", { automationId })
        }

        const jobId = `${automationId}-${crypto.randomBytes(8).toString("hex")}`

        let virtualKey: string | undefined
        try {
            let env: Record<string, string>
            let egressCidrAllowlist: string[]
            if (litellm) {
                virtualKey = await this.litellmKeys.mintJobKey(jobId)
                env = {
                    ANTHROPIC_BASE_URL: litellm.baseUrl,
                    ANTHROPIC_AUTH_TOKEN: virtualKey,
                    ANTHROPIC_MODEL: LITELLM_MAIN_MODEL,
                    ANTHROPIC_DEFAULT_HAIKU_MODEL: LITELLM_SMALL_MODEL
                }
                egressCidrAllowlist = await resolveEgressCidrs(litellm.baseUrl)
            } else {
                env = { ANTHROPIC_API_KEY: improvementApiKey! }
                egressCidrAllowlist = ANTHROPIC_INBOUND_CIDRS
            }

            const result = await this.sandbox.run({
                label: `sdk-improvement-${automationId}`,
                prompt,
                sourceImageId,
                gitInit: true,
                jsonSchema: IMPROVEMENTS_SCHEMA,
                timeoutMs: SANDBOX_TIMEOUT_MS,
                env,
                egressCidrAllowlist,
                plugin: hasPlugin ? { files: pluginFiles, dir: PLUGIN_SANDBOX_DIR } : undefined
            })

            if (!result.stdout) {
                logger.error("[SdkImprovementService] No stdout from Claude Code", { automationId, exitCode: result.exitCode, jobId })
                return { title: "Review failed", summary: "Claude Code did not produce results.", improvements: [] }
            }

            return parseResults(result.stdout, automationId)
        } catch (error) {
            logger.error("[SdkImprovementService] Evaluation failed", { automationId, jobId, error })
            return { title: "Review failed", summary: "An error occurred during the review.", improvements: [] }
        } finally {
            if (virtualKey) await this.litellmKeys.deleteKey(virtualKey)
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
