import crypto from "node:crypto"

import { Image as ModalImage } from "modal"

import logger from "../logger"
import { assertValidEnvVarName } from "../utility/shellEscape"

import { ModalSandboxService } from "./sandboxProvider/ModalSandboxService"

const CLAUDE_CODE_VERSION = "2.1.81"

/**
 * Deny rules for the Claude Code tool layer. Defense-in-depth on top of the
 * network egress lockdown — these block tools the improvement agent has no
 * legitimate reason to use (curl/wget/WebFetch for exfil, node -e/python -c
 * for arbitrary code execution).
 */
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
    /** Optional zip buffer of source code to extract into /tmp/project */
    sourceZip?: Buffer
    /** Whether to git init the project before running Claude Code (default: true) */
    gitInit?: boolean
    /** Max turns for Claude Code (default: 30) */
    maxTurns?: number
    /** Sandbox timeout in ms (default: 10 minutes) */
    timeoutMs?: number
    /** Additional env vars to pass to the Claude Code process. ANTHROPIC_API_KEY must be supplied via this map. */
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

    private async writeClaudeSettings(sb: SandboxLike, label: string, extraDenyRules: string[]): Promise<void> {
        const mkdir = await sb.exec(["mkdir", "-p", "/tmp/project/.claude"], { stdout: "pipe", stderr: "pipe" })
        await mkdir.wait()

        const denyRules = [...DEFAULT_TOOL_DENY_RULES, ...extraDenyRules]
        const settingsBody = JSON.stringify({ permissions: { deny: denyRules } }, null, 2)
        const handle = await sb.open("/tmp/project/.claude/settings.json", "w")
        await handle.write(new TextEncoder().encode(settingsBody))
        await handle.close()
        logger.info(`[ClaudeCodeSandbox:${label}] Wrote Claude Code denylist`, { ruleCount: denyRules.length })
    }

    async run(params: ClaudeCodeSandboxParams): Promise<ClaudeCodeSandboxResult> {
        const {
            label,
            prompt,
            sourceZip,
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

        // Modal forwards env structurally to the spawned process, so shell
        // metacharacters in keys cannot break the boundary. We still validate
        // here to keep callers honest and to fail closed on bad input.
        for (const k of Object.keys(extraEnv)) {
            assertValidEnvVarName(k)
        }

        const executionStart = performance.now()

        const sandboxService = new ModalSandboxService()

        let t = performance.now()
        const app = await sandboxService.getOrCreateApp("terse-claude-code-sandbox")
        // Bake git + unzip + Claude Code CLI into the image so the sandbox does
        // not need apt/npm network access at runtime. With cidrAllowlist locking
        // egress to the Terse proxy, runtime apt/npm would fail anyway.
        const baseImage = sandboxService.getImageFromRegistry("node:22-slim") as ModalImage
        const image = baseImage.dockerfileCommands([
            "RUN apt-get update -qq && apt-get install -y -qq git unzip ca-certificates && rm -rf /var/lib/apt/lists/*",
            `RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} && npm cache clean --force`,
            "RUN useradd -m -s /bin/bash coder"
        ])

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
            // Upload & extract source code if provided
            if (sourceZip) {
                t = performance.now()
                const writeHandle = await sb.open("/tmp/code.zip", "w")
                await writeHandle.write(new Uint8Array(sourceZip))
                await writeHandle.close()

                const unzipProc = await sb.exec(["sh", "-c", "cd /tmp && unzip -o code.zip -d project > /dev/null"], { stdout: "pipe", stderr: "pipe" })
                await unzipProc.wait()
                logger.info(`[ClaudeCodeSandbox:${label}] Extracted source code`, { duration: this.elapsed(t) })
            } else {
                // Create empty project dir
                const mkdirProc = await sb.exec(["mkdir", "-p", "/tmp/project"], { stdout: "pipe", stderr: "pipe" })
                await mkdirProc.wait()
            }

            // Write the tool denylist AFTER unzip so we overwrite any
            // attacker-supplied .claude/settings.json planted in the source zip.
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

            // Git init + baseline commit
            if (gitInit) {
                t = performance.now()
                const gitProc = await sb.exec(["sh", "-c", "cd /tmp/project && git init && git add -A && git -c user.name=terse -c user.email=terse@terse.ai commit --allow-empty -m baseline"], {
                    stdout: "pipe",
                    stderr: "pipe"
                })
                await gitProc.wait()
                logger.info(`[ClaudeCodeSandbox:${label}] Git baseline created`, { duration: this.elapsed(t) })
            }

            // Hand ownership of the project dir to the non-root coder user (the
            // user itself is baked into the image).
            const chownProc = await sb.exec(["chown", "-R", "coder:coder", "/tmp/project"], { stdout: "pipe", stderr: "pipe" })
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

            // Modal forwards `env` to the spawned process structurally — the key
            // never lands on disk in a chmod-readable script. `su -p` preserves
            // the env across the user switch so the coder user sees ANTHROPIC_*.
            const claudeProc = await sb.exec(["su", "-p", "coder", "-c", `cd /tmp/project && exec ${shellJoin(claudeArgs)} < /tmp/prompt.txt > /tmp/claude-output.json`], {
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
        }
    }
}

/**
 * Structural type for the Modal Sandbox we exec against — kept narrow so the
 * tool denylist helper above doesn't pull in the full Modal class.
 */
interface SandboxLike {
    exec(command: string[], params?: { stdout?: "pipe" | "ignore"; stderr?: "pipe" | "ignore" }): Promise<{ wait(): Promise<number> }>
    open(path: string, mode: "r" | "w"): Promise<{ write(data: Uint8Array): Promise<void>; close(): Promise<void> }>
}

/**
 * Quote an argv vector for `bash -c "..."`. Each arg is wrapped in single
 * quotes with embedded single quotes escaped via the standard `'\''` trick,
 * so newlines and shell metacharacters cannot break the wrapper.
 */
function shellJoin(args: readonly string[]): string {
    return args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(" ")
}
