import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, it, mock } from "node:test"

import type { CodegenInput } from "../codegenTypes.js"

import { PythonProvider } from "./PythonProvider.js"

const JOB_REGISTRY_MARKER = "__TERSE_JOB_REGISTRY__="
const CREATED_DIRS: string[] = []

class ExitSignal extends Error {
    constructor(readonly code?: number) {
        super(`process.exit(${code ?? 0})`)
    }
}

class TestPythonProvider extends PythonProvider {
    execStdout = ""
    capturedScripts: string[] = []
    execCalls: Array<{ args: string[]; cwd: string; env?: NodeJS.ProcessEnv }> = []

    protected override async execUvCommand(
        args: string[],
        opts: {
            cwd: string
            env?: NodeJS.ProcessEnv
        }
    ): Promise<{ stdout: string; stderr: string }> {
        this.execCalls.push({ args, cwd: opts.cwd, env: opts.env })
        return { stdout: this.execStdout, stderr: "" }
    }

    protected override async withTempPythonScript<T>(source: string, fn: (scriptPath: string) => Promise<T>): Promise<T> {
        this.capturedScripts.push(source)
        return fn("/tmp/terse-python-provider-test.py")
    }

    protected override async ensureUvAvailable(_cwd: string): Promise<void> {}
}

describe("PythonProvider entry file resolution", () => {
    const originalCwd = process.cwd()

    beforeEach(() => {
        mock.restoreAll()
    })

    afterEach(() => {
        process.chdir(originalCwd)
        mock.restoreAll()

        while (CREATED_DIRS.length > 0) {
            const dir = CREATED_DIRS.pop()
            if (dir) fs.rmSync(dir, { recursive: true, force: true })
        }
    })

    it("loads the canonical default entry file from src/main.py", async () => {
        const dir = createPythonProject({
            "src/main.py": "from terse_sdk import Terse\napp = Terse()\n"
        })
        process.chdir(dir)

        const provider = new TestPythonProvider()
        provider.execStdout = buildRegistryPayload("default-job")

        const registry = await provider.loadJobRegistry()

        assert.deepEqual([...registry.keys()], ["default-job"])
        assert.match(provider.capturedScripts[0], /ENTRY_FILE = "src\/main\.py"/)
        assert.deepEqual(provider.execCalls[0]?.args, ["run", "python", "/tmp/terse-python-provider-test.py"])
        assert.equal(fs.realpathSync(provider.execCalls[0]?.cwd ?? ""), fs.realpathSync(dir))
        assert.match(provider.execCalls[0]?.env?.UV_CACHE_DIR ?? "", /terse-uv-cache$/)
    })

    it("prints guidance when the default entry file is missing", async () => {
        const dir = createPythonProject({
            "src/server.py": "from terse_sdk import Terse\napp = Terse()\n"
        })
        process.chdir(dir)

        const provider = new TestPythonProvider()
        const errors: string[] = []

        mock.method(console, "error", (...args: unknown[]) => {
            errors.push(args.map(String).join(" "))
        })
        mock.method(process, "exit", (code?: number): never => {
            throw new ExitSignal(code)
        })

        await assert.rejects(provider.loadJobRegistry(), (error: unknown) => error instanceof ExitSignal && error.code === 1)

        const output = stripAnsi(errors.join("\n"))
        assert.match(output, /default Python Terse entry file at src\/main\.py/)
        assert.match(output, /register at least one job with @app\.job/)
        assert.match(output, /terse test --entry-file src\/server\.py/)
        assert.match(output, /terse run my-job --entry-file src\/server\.py --event-file \.\/event\.json/)
        assert.match(output, /terse deploy --entry-file src\/server\.py/)
        assert.equal(provider.execCalls.length, 0)
    })

    it("loads a non-canonical entry file when --entry-file is provided", async () => {
        const dir = createPythonProject({
            "src/server.py": "from terse_sdk import Terse\napp = Terse()\n"
        })
        process.chdir(dir)

        const provider = new TestPythonProvider()
        provider.execStdout = buildRegistryPayload("self-hosted-job")

        const registry = await provider.loadJobRegistry("src/server.py")

        assert.deepEqual([...registry.keys()], ["self-hosted-job"])
        assert.match(provider.capturedScripts[0], /ENTRY_FILE = "src\/server\.py"/)
    })
})

describe("PythonProvider GitHub codegen parity", () => {
    it("renders GitHub.skill() with repositoryIds via PythonProvider.renderGeneratedCode()", () => {
        const provider = new PythonProvider()

        const code = provider.renderGeneratedCode(
            buildCodegenInput({
                github: [
                    {
                        integration: {
                            id: "github-integration-id",
                            installation_id: 123,
                            account_name: "TerseAI"
                        } as CodegenInput["github"][number]["integration"],
                        repositories: [
                            {
                                id: 1076128380,
                                name: "Terse",
                                owner: "TerseAI",
                                fullName: "TerseAI/Terse"
                            }
                        ]
                    }
                ]
            })
        )

        assert.match(code, /class GitHub:/)
        assert.match(code, /def skill\(\*, repos: Sequence\[GitHubRepo\]\) -> SkillConfig\[str\]:/)
        assert.match(code, /integration_id='github-integration-id'/)
        assert.match(code, /config_type='github'/)
        assert.match(code, /repositoryIds=\[repo\.repository_id for repo in repos\]/)
    })

    it("does not emit GitHub helpers when no GitHub integration is present", () => {
        const provider = new PythonProvider()

        const code = provider.renderGeneratedCode(buildCodegenInput())

        assert.doesNotMatch(code, /# === GitHub ===/)
        assert.doesNotMatch(code, /def skill\(\*, repos: Sequence\[GitHubRepo\]\)/)
    })
})

function createPythonProject(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terse-python-provider-"))
    CREATED_DIRS.push(dir)
    fs.writeFileSync(path.join(dir, "pyproject.toml"), ["[project]", 'name = "provider-test"', 'version = "0.0.1"', 'requires-python = ">=3.11"', "dependencies = []", ""].join("\n"), "utf-8")

    for (const [relativePath, contents] of Object.entries(files)) {
        const filePath = path.join(dir, relativePath)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, contents, "utf-8")
    }

    return dir
}

function buildRegistryPayload(jobName: string): string {
    return `${JOB_REGISTRY_MARKER}${JSON.stringify({
        [jobName]: {
            name: jobName,
            triggers: [],
            skills: [],
            toolApprovals: [],
            hasFilter: false
        }
    })}`
}

function stripAnsi(value: string): string {
    return value.replace(/\u001B\[[0-9;]*m/g, "")
}

function buildCodegenInput(overrides: Partial<CodegenInput> = {}): CodegenInput {
    return {
        github: [],
        slack: [],
        gmail: [],
        linear: [],
        notion: [],
        posthog: [],
        datadog: [],
        launchdarkly: [],
        workos: [],
        attio: [],
        snowflake: [],
        tools: [],
        ...overrides
    }
}
