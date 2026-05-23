import crypto from "node:crypto"

import logger from "../common/logger"
import { assertValidEnvVarName, shellQuoteArgs } from "../common/shellEscape"

import { ModalSandboxService, Sandbox } from "./sandboxProvider/ModalSandboxService"
import { SDK_SOURCE_IMAGE_PROJECT_DIR } from "./sdkRuntimeExecutors/types"

const CLAUDE_CODE_VERSION = "2.1.81"

const DEFAULT_TOOL_DENY_RULES = [
    "Bash(curl:*)",
    "Bash(wget:*)",
    "Bash(nc:*)",
    "Bash(ncat:*)",
    "Bash(socat:*)",
    "Bash(ssh:*)",
    "Bash(scp:*)",
    "Bash(rsync:*)",
    "Bash(node -e:*)",
    "Bash(node --eval:*)",
    "Bash(python -c:*)",
    "Bash(python3 -c:*)",
    "Bash(perl -e:*)",
    "Bash(ruby -e:*)",
    "WebFetch",
    "WebSearch"
]

interface ClaudeCodeSandboxParams {
    /** Identifier for logging */
    label: string
    /** Prompt to pass to Claude Code CLI via -p flag */
    prompt: string
    /** Modal source image ID. The sandbox boots from this image; user code is already at /opt/project. */
    sourceImageId: string
    /** Whether to git init the project before running Claude Code (default: true) */
    gitInit?: boolean
    /** Max turns for Claude Code (default: 30) */
    maxTurns?: number
    /** Sandbox timeout in ms (default: 10 minutes) */
    timeoutMs?: number
    /** Additional env vars to pass to the Claude Code process. */
    env?: Record<string, string>
    /** JSON Schema to enforce structured output from Claude Code */
    jsonSchema?: Record<string, unknown>
    /** Paths of files to read back from the sandbox after execution */
    outputFiles?: string[]
    /** Optional plugin to install in the sandbox. Files are written at absolute paths, dir is passed as --plugin-dir. */
    plugin?: { files: Record<string, string>; dir: string }
    /** Single proxy /32 CIDR forced as the only outbound destination. When unset, sandbox keeps default open egress. */
    egressCidrAllowlist?: string[]
    /** Additional deny-rules to merge into .claude/settings.json. Defaults applied automatically. */
    extraToolDenyRules?: string[]
}

interface ClaudeCodeSandboxResult {
    /** Claude Code stdout */
    stdout: string
    /** Claude Code stderr */
    stderr: string
    /** Process exit code */
    exitCode: number
    /** Contents of requested output files, keyed by path */
    outputFiles: Record<string, string>
}

export class ClaudeCodeSandboxService {
    private elapsed(startMs: number): string {
        return `${((performance.now() - startMs) / 1000).toFixed(2)}s`
    }

    private async buildClaudeCodeImage(sandboxService: ModalSandboxService, sourceImageId: string, label: string): Promise<string> {
        const t = performance.now()
        const app = await sandboxService.getOrCreateApp("terse-claude-code-builder")
        const baseImage = await sandboxService.getImageFromId(sourceImageId)
        const sb = await sandboxService.getOrCreateSandbox(app, baseImage, `cc-build-${crypto.randomBytes(14).toString("hex")}`, { timeoutMs: 10 * 60 * 1000 })
        try {
            // SDK source images don't ship git; the Judge needs it for the baseline commit + diffs
            // that back Claude's `suggestedPatch` output.
            const installCmd = [
                "export DEBIAN_FRONTEND=noninteractive",
                "apt-get update -qq",
                "apt-get install -y -qq git ca-certificates",
                "rm -rf /var/lib/apt/lists/*",
                `npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}`,
                "npm cache clean --force",
                "(id -u coder >/dev/null 2>&1 || useradd -m -s /bin/bash coder)"
            ].join(" && ")
            const proc = await sb.exec(["sh", "-c", installCmd], { stdout: "pipe", stderr: "pipe" })
            const [stdout, stderr] = await Promise.all([proc.stdout.readText(), proc.stderr.readText()])
            const exitCode = await proc.wait()
            if (exitCode !== 0) {
                const detail = stderr.trim().slice(0, 1000) || stdout.trim().slice(0, 1000) || `exit ${exitCode}`
                logger.error(`[ClaudeCodeSandbox:${label}] Claude Code install failed`, { exitCode, detail })
                throw new Error(`Claude Code install failed: ${detail}`)
            }
            const snapshot = await sb.snapshotFilesystem()
            logger.info(`[ClaudeCodeSandbox:${label}] Built Claude Code image`, { imageId: snapshot.imageId, duration: this.elapsed(t) })
            return snapshot.imageId
        } finally {
            await sb.terminate().catch(err => logger.warn(`[ClaudeCodeSandbox:${label}] Builder sandbox terminate failed`, { error: err }))
        }
    }

    private async writeClaudeSettings(sb: Sandbox, label: string, extraDenyRules: string[]): Promise<void> {
        const settingsDir = `${SDK_SOURCE_IMAGE_PROJECT_DIR}/.claude`
        const mkdir = await sb.exec(["mkdir", "-p", settingsDir], { stdout: "pipe", stderr: "pipe" })
        await mkdir.wait()

        const denyRules = [...DEFAULT_TOOL_DENY_RULES, ...extraDenyRules]
        const settingsBody = JSON.stringify({ permissions: { deny: denyRules } }, null, 2)
        const handle = await sb.open(`${settingsDir}/settings.json`, "w")
        await handle.write(new TextEncoder().encode(settingsBody))
        await handle.close()
        logger.info(`[ClaudeCodeSandbox:${label}] Wrote Claude Code denylist`, { ruleCount: denyRules.length })
    }

    async run(params: ClaudeCodeSandboxParams): Promise<ClaudeCodeSandboxResult> {
        const {
            label,
            prompt,
            sourceImageId,
            gitInit = true,
            maxTurns = 30,
            timeoutMs = 10 * 60 * 1000,
            env: extraEnv = {},
            jsonSchema,
            outputFiles: outputFilePaths = [],
            plugin,
            egressCidrAllowlist,
            extraToolDenyRules = []
        } = params

        for (const k of Object.keys(extraEnv)) {
            assertValidEnvVarName(k)
        }

        const executionStart = performance.now()

        const sandboxService = new ModalSandboxService()

        const judgeImageId = await this.buildClaudeCodeImage(sandboxService, sourceImageId, label)

        let t = performance.now()
        const app = await sandboxService.getOrCreateApp("terse-claude-code-sandbox")
        const image = await sandboxService.getImageFromId(judgeImageId)

        const uniqueName = `cc-${crypto.randomBytes(14).toString("hex")}`
        const sb = await sandboxService.getOrCreateSandbox(app, image, uniqueName, {
            timeoutMs,
            cidrAllowlist: egressCidrAllowlist
        })
        logger.info(`[ClaudeCodeSandbox:${label}] Created sandbox`, {
            sandboxId: sb.sandboxId,
            duration: this.elapsed(t),
            egressLocked: Boolean(egressCidrAllowlist?.length)
        })

        try {
            // Write the tool denylist into the source image's project dir. This overwrites any
            // attacker-supplied .claude/settings.json that may have been baked into the user's code.
            await this.writeClaudeSettings(sb, label, extraToolDenyRules)

            // Write plugin files into the sandbox
            if (plugin) {
                for (const [filePath, content] of Object.entries(plugin.files)) {
                    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"))
                    if (dirPath) {
                        const mkdirProc = await sb.exec(["mkdir", "-p", dirPath], { stdout: "pipe", stderr: "pipe" })
                        await mkdirProc.wait()
                    }
                    const fileHandle = await sb.open(filePath, "w")
                    await fileHandle.write(new TextEncoder().encode(content))
                    await fileHandle.close()
                }
                logger.info(`[ClaudeCodeSandbox:${label}] Wrote ${Object.keys(plugin.files).length} plugin file(s)`)
            }

            // Git init + baseline commit so Claude can produce diffs against a clean baseline.
            if (gitInit) {
                t = performance.now()
                const gitProc = await sb.exec(
                    ["sh", "-c", `cd ${SDK_SOURCE_IMAGE_PROJECT_DIR} && git init -q && git add -A && git -c user.name=terse -c user.email=terse@terse.ai commit --allow-empty -q -m baseline`],
                    { stdout: "pipe", stderr: "pipe" }
                )
                const [gitStdout, gitStderr] = await Promise.all([gitProc.stdout.readText(), gitProc.stderr.readText()])
                const gitExit = await gitProc.wait()
                if (gitExit !== 0) {
                    const detail = gitStderr.trim().slice(0, 500) || gitStdout.trim().slice(0, 500) || `exit ${gitExit}`
                    throw new Error(`Git baseline failed: ${detail}`)
                }
                logger.info(`[ClaudeCodeSandbox:${label}] Git baseline created`, { duration: this.elapsed(t) })
            }

            const chownProc = await sb.exec(["chown", "-R", "coder:coder", SDK_SOURCE_IMAGE_PROJECT_DIR], { stdout: "pipe", stderr: "pipe" })
            await chownProc.wait()

            // Write prompt to a file to avoid ARG_MAX limits
            const promptHandle = await sb.open("/tmp/prompt.txt", "w")
            await promptHandle.write(new TextEncoder().encode(prompt))
            await promptHandle.close()

            // Run Claude Code
            t = performance.now()
            const claudeArgs = ["claude", "-p", "--output-format", "json", "--max-turns", String(maxTurns), "--dangerously-skip-permissions"]
            if (plugin) {
                claudeArgs.push("--plugin-dir", plugin.dir)
            }
            if (jsonSchema) {
                claudeArgs.push("--json-schema", JSON.stringify(jsonSchema))
            }

            const claudeProc = await sb.exec(["su", "-p", "coder", "-c", `cd ${SDK_SOURCE_IMAGE_PROJECT_DIR} && exec ${shellQuoteArgs(claudeArgs)} < /tmp/prompt.txt > /tmp/claude-output.json`], {
                stdout: "pipe",
                stderr: "pipe",
                env: extraEnv
            })

            const stderr = await claudeProc.stderr.readText()
            const exitCode = await claudeProc.wait()

            // Read Claude Code output from file (more reliable than stdout pipe)
            let stdout = ""
            const catProc = await sb.exec(["cat", "/tmp/claude-output.json"], { stdout: "pipe", stderr: "pipe" })
            const catStdout = await catProc.stdout.readText()
            const catExit = await catProc.wait()
            if (catExit === 0) {
                stdout = catStdout
            }

            logger.info(`[ClaudeCodeSandbox:${label}] Claude Code finished`, {
                duration: this.elapsed(t),
                exitCode,
                stdoutLength: stdout.length,
                stderrLength: stderr.length,
                stderrPreview: stderr.slice(0, 500)
            })

            if (stderr) {
                logger.warn(`[ClaudeCodeSandbox:${label}] Claude Code stderr`, { stderr: stderr.slice(0, 2000) })
            }

            // Read requested output files via cat (Modal file handles don't support reading)
            const outputFiles: Record<string, string> = {}
            for (const filePath of outputFilePaths) {
                try {
                    const catProc = await sb.exec(["cat", filePath], { stdout: "pipe", stderr: "pipe" })
                    const catExit = await catProc.wait()
                    if (catExit === 0) {
                        outputFiles[filePath] = await catProc.stdout.readText()
                    } else {
                        logger.warn(`[ClaudeCodeSandbox:${label}] Output file not found`, { filePath })
                    }
                } catch (error) {
                    logger.warn(`[ClaudeCodeSandbox:${label}] Could not read output file`, { filePath, error })
                }
            }

            await sb.terminate()
            logger.info(`[ClaudeCodeSandbox:${label}] Total execution`, { totalDuration: this.elapsed(executionStart) })

            return { stdout, stderr, exitCode, outputFiles }
        } catch (error) {
            await sb.terminate().catch(() => {})
            throw error
        } finally {
            await sandboxService.deleteImage(judgeImageId).catch(err => logger.warn(`[ClaudeCodeSandbox:${label}] Failed to delete Judge image`, { imageId: judgeImageId, error: err }))
        }
    }
}
