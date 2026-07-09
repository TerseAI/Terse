import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

import type { CodegenInput } from "../src/providers/codegenTypes.js"
import { prepareTemplateContext } from "../src/providers/typescript/prepareCodegenData.js"
import { renderGeneratedCode } from "../src/providers/typescript/templateEngine.js"

import { fullWorkspaceCodegenInput, terseOnlyCodegenInput } from "./codegenFixtures.js"

const testDir = path.dirname(fileURLToPath(import.meta.url))

async function render(input: CodegenInput): Promise<string> {
    return renderGeneratedCode(await prepareTemplateContext(input))
}

describe("terse.generated.ts rendering", () => {
    it("renders a fully connected workspace", async () => {
        const code = await render(fullWorkspaceCodegenInput())
        await expect(code).toMatchFileSnapshot("__snapshots__/full-workspace.generated.ts.snap")
    })

    it("renders a terse-only project (no external integrations)", async () => {
        const code = await render(terseOnlyCodegenInput())
        await expect(code).toMatchFileSnapshot("__snapshots__/terse-only.generated.ts.snap")
    })

    it("projects tool params and results as readable declarations", async () => {
        const code = await render(fullWorkspaceCodegenInput())

        expect(code).toContain("export interface SlackSendMessageParams")
        expect(code).toContain("export interface SlackSendMessageResult")
        expect(code).not.toContain("ToolInputByName")
        expect(code).toContain("export interface RunHistoryAction")
        expect(code).toContain("RunHistoryAction[]")
    })

    it("projects trigger payloads wrapped in SDKTrigger", async () => {
        const code = await render(fullWorkspaceCodegenInput())

        expect(code).toContain("export interface SlackMessageTriggerPayload")
        expect(code).toContain("export type SlackMessageTrigger = SDKTrigger<SlackMessageTriggerPayload>")
        expect(code).toContain("export type SlackTrigger = SlackMessageTrigger | SlackAppMentionTrigger | SlackReactionAddedTrigger")
        expect(code).toContain("export type WebhookTrigger<TBody = unknown> = SDKTrigger<WebhookTriggerPayload<TBody>>")
        expect(code).toContain("export type AttioRecordUpdatedTrigger<TValues = Record<string, unknown>> = SDKTrigger<AttioRecordUpdatedTriggerPayload<TValues>>")
    })

    it.each([
        ["full workspace", fullWorkspaceCodegenInput],
        ["terse-only", terseOnlyCodegenInput]
    ])("typechecks the rendered output against the SDK sources (%s)", async (_label, input) => {
        const code = await render(input())
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "terse-codegen-"))
        const generatedFile = path.join(dir, "terse.generated.ts")
        fs.writeFileSync(generatedFile, code)

        const repoRoot = path.resolve(testDir, "../../..")
        // jobContextStore.ts holds the SDK's `declare global` block; the package tsconfig
        // compiles all of src so the augmentation is always visible there, but this program
        // only sees files reachable from the generated file's imports.
        const sdkGlobals = path.join(repoRoot, "packages/terse-sdk/src/runIdentity/jobContextStore.ts")
        const program = ts.createProgram([generatedFile, sdkGlobals], {
            strict: true,
            noEmit: true,
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            skipLibCheck: true,
            baseUrl: repoRoot,
            paths: {
                "terse-sdk": ["packages/terse-sdk/src/index.ts"],
                "terse-types": ["terse-types/index.ts"]
            }
        })

        const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
            if (!diagnostic.file || diagnostic.start === undefined) return message
            const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
            return `${diagnostic.file.fileName}:${line + 1} ${message}`
        })
        expect(diagnostics).toEqual([])
    })
})
