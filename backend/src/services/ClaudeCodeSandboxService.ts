import { settings } from "../config/settings"
import logger from "../logger"

import { ModalSandboxService } from "./sandboxProvider/ModalSandboxService"

export interface ClaudeCodeSandboxParams {
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
    /** Additional env vars to pass to the Claude Code process */
    env?: Record<string, string>
    /** JSON Schema to enforce structured output from Claude Code */
    jsonSchema?: Record<string, unknown>
    /** Paths of files to read back from the sandbox after execution */
    outputFiles?: string[]
    /** Optional plugin to install in the sandbox. Files are written at absolute paths, dir is passed as --plugin-dir. */
    plugin?: { files: Record<string, string>; dir: string }
}

export interface ClaudeCodeSandboxResult {
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

    async run(params: ClaudeCodeSandboxParams): Promise<ClaudeCodeSandboxResult> {
        const { label, prompt, sourceZip, gitInit = true, maxTurns = 30, timeoutMs = 10 * 60 * 1000, env: extraEnv = {}, jsonSchema, outputFiles: outputFilePaths = [], plugin } = params

        const executionStart = performance.now()

        const sandboxService = new ModalSandboxService()

        let t = performance.now()
        const app = await sandboxService.getOrCreateApp("terse-claude-code-sandbox")
        const image = sandboxService.getOrCreateImageFromRegistry("node:22-slim")
        const sb = await sandboxService.getOrCreateSandbox(app, image, { timeoutMs })
        logger.info(`[ClaudeCodeSandbox:${label}] Created sandbox`, { sandboxId: sb.sandboxId, duration: this.elapsed(t) })

        try {
            // Install system deps (git required for git init/diff, unzip for source code)
            t = performance.now()
            const depsProc = await sb.exec(["sh", "-c", "apt-get update -qq && apt-get install -y -qq git unzip > /dev/null 2>&1"], { stdout: "pipe", stderr: "pipe" })
            await depsProc.wait()
            logger.info(`[ClaudeCodeSandbox:${label}] Installed system deps`, { duration: this.elapsed(t) })

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

            // Create non-root user (Claude Code refuses --dangerously-skip-permissions as root)
            t = performance.now()
            const userProc = await sb.exec(["sh", "-c", "useradd -m -s /bin/bash coder && chown -R coder:coder /tmp/project"], { stdout: "pipe", stderr: "pipe" })
            await userProc.wait()
            logger.info(`[ClaudeCodeSandbox:${label}] Created non-root user`, { duration: this.elapsed(t) })

            // Install Claude Code CLI
            t = performance.now()
            const installProc = await sb.exec(["sh", "-c", "npm install -g @anthropic-ai/claude-code@2.1.81 2>&1"], { stdout: "pipe", stderr: "pipe" })
            const installExit = await installProc.wait()
            if (installExit !== 0) {
                const installStderr = await installProc.stderr.readText()
                logger.error(`[ClaudeCodeSandbox:${label}] Failed to install Claude Code CLI`, { stderr: installStderr.slice(0, 500) })
                await sb.terminate()
                return { stdout: "", stderr: installStderr, exitCode: installExit, outputFiles: {} }
            }
            logger.info(`[ClaudeCodeSandbox:${label}] Installed Claude Code CLI`, { duration: this.elapsed(t) })

            // Write prompt to a file to avoid ARG_MAX limits
            const promptHandle = await sb.open("/tmp/prompt.txt", "w")
            await promptHandle.write(new TextEncoder().encode(prompt))
            await promptHandle.close()

            // Run Claude Code
            t = performance.now()
            // Build Claude Code command args
            const claudeArgs = ["claude", "-p", "--output-format", "json", "--max-turns", String(maxTurns), "--dangerously-skip-permissions"]
            if (plugin) {
                claudeArgs.push("--plugin-dir", plugin.dir)
            }
            if (jsonSchema) {
                claudeArgs.push("--json-schema", JSON.stringify(jsonSchema))
            }

            // Write a run script and execute as non-root user
            const claudeEnv = { ANTHROPIC_API_KEY: settings.anthropic.apiKey, ...extraEnv }
            const envExports = Object.entries(claudeEnv)
                .map(([k, v]) => `export ${k}='${v.replace(/'/g, "'\\''")}'`)
                .join("\n")
            const escapedArgs = claudeArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(" ")
            const runScript = `#!/bin/bash\n${envExports}\ncd /tmp/project && cat /tmp/prompt.txt | ${escapedArgs} > /tmp/claude-output.json\n`
            const scriptHandle = await sb.open("/tmp/run-claude.sh", "w")
            await scriptHandle.write(new TextEncoder().encode(runScript))
            await scriptHandle.close()
            const chmodProc = await sb.exec(["chmod", "+x", "/tmp/run-claude.sh"], { stdout: "pipe", stderr: "pipe" })
            await chmodProc.wait()

            const claudeProc = await sb.exec(["su", "coder", "-c", "/tmp/run-claude.sh"], {
                stdout: "pipe",
                stderr: "pipe"
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
