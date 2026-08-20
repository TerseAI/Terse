import { BaseBuilder, createBaseBuilderConfig } from "@workflow/builders"
import fs from "node:fs"
import path from "node:path"

// Modeled on @workflow/nest's NestLocalBuilder: scan `scanDir` and emit bundles
// to an out dir OUTSIDE it. The builder globs inputs rooted at `dirs`, so output
// kept outside `dirs` is never re-globbed as an input — which is what lets
// re-tests overwrite the bundles cleanly. (StandaloneBuilder forces dirs: ['.'],
// scanning the whole project, which is why its output collided with itself.)
// `scanDir` (relative to workingDir) holds the macro-transformed sources, so the
// builder discovers the `"use workflow"` functions the job macro injected into
// each createJob's onTrigger.
// Packages that locate a sibling platform binary by resolving relative to their
// own module path. Inlining them into the steps bundle moves that path to the
// build output, where no node_modules exists, and the lookup fails at runtime.
const EXTERNAL_PACKAGES = ["@anthropic-ai/claude-agent-sdk"]

export class TerseWorkflowBuilder extends BaseBuilder {
    private readonly outDir: string

    constructor(workingDir: string, scanDir: string, outDir: string) {
        super({
            ...createBaseBuilderConfig({ workingDir, dirs: [scanDir], watch: false, externalPackages: EXTERNAL_PACKAGES }),
            buildTarget: "standalone",
            stepsBundlePath: path.join(outDir, "steps.cjs"),
            workflowsBundlePath: path.join(outDir, "workflows.cjs"),
            webhookBundlePath: path.join(outDir, "webhook.cjs")
        })
        this.outDir = outDir
    }

    // Raw builder logs would corrupt the CLI's active clack rendering.
    protected get shouldLogBaseBuilderInfo(): boolean {
        return false
    }

    async build(): Promise<void> {
        await withSerdeWarningsSuppressed(async () => {
            const inputFiles = await this.getInputFiles()
            fs.mkdirSync(this.outDir, { recursive: true })

            const { manifest: workflows } = await this.createWorkflowsBundle({ outfile: path.join(this.outDir, "workflows.cjs"), format: "cjs", inputFiles })
            const { manifest: steps } = await this.createStepsBundle({ outfile: path.join(this.outDir, "steps.cjs"), format: "cjs", inputFiles })
            await this.createWebhookBundle({ outfile: path.join(this.outDir, "webhook.cjs"), bundle: false })

            await this.createManifest({
                workflowBundlePath: path.join(this.outDir, "workflows.cjs"),
                manifestDir: this.outDir,
                manifest: {
                    steps: { ...steps.steps, ...workflows.steps },
                    workflows: { ...steps.workflows, ...workflows.workflows },
                    classes: { ...steps.classes, ...workflows.classes }
                }
            })

            // generated build output — keep it out of the user's git
            fs.writeFileSync(path.join(this.outDir, ".gitignore"), "*\n")
        })
    }
}

// False positive: the serde checker scans the pre-tree-shaken bundle and pins
// @workflow/core's own Node-builtin imports on user classes. The builder's esbuild
// plugin still fails the build on genuine violations after "use step" stripping.
async function withSerdeWarningsSuppressed<T>(fn: () => Promise<T>): Promise<T> {
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
        if (typeof args[0] === "string" && args[0].includes("Serde warning for")) return
        originalWarn(...args)
    }
    try {
        return await fn()
    } finally {
        console.warn = originalWarn
    }
}
