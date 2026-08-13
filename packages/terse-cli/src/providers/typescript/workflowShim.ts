import fs from "node:fs"
import path from "node:path"

import { readTemplateFile } from "../templateUtils.js"

const SHIM_DIR = path.join("node_modules", "workflow")
const SHIM_TEMPLATE_DIR = path.join("typescript", "workflow-shim")
const SHIM_MARKER = "terseWorkflowShim"

// @workflow/builders hardcodes two specifiers that it resolves from the project root: `workflow/runtime`
// (injected into the generated bundle wrapper) and `workflow/internal/builtins`. This shim satisfies both
// out of `@workflow/core`, which keeps the `workflow` umbrella (CLI, framework adapters, SWC, esbuild,
// ~150MB) out of every user project and every sandbox image.
export function writeWorkflowShim(cwd: string, workflowCoreVersion: string): void {
    const shimRoot = path.join(cwd, SHIM_DIR)
    if (hasRealWorkflowPackage(shimRoot)) return

    fs.mkdirSync(path.join(shimRoot, "internal"), { recursive: true })
    fs.writeFileSync(path.join(shimRoot, "package.json"), shimPackageJson(workflowCoreVersion))
    SHIM_FILES.forEach(file => fs.writeFileSync(path.join(shimRoot, file), readTemplateFile(path.join(SHIM_TEMPLATE_DIR, file))))
}

// helpers

const SHIM_FILES = ["index.js", "workflow.js", "runtime.js", "api.js", "stdlib.js", path.join("internal", "builtins.js"), path.join("internal", "class-serialization.js")]

// A project that depends on `workflow` itself already satisfies the builder, and its copy is the real one.
function hasRealWorkflowPackage(shimRoot: string): boolean {
    const manifest = path.join(shimRoot, "package.json")
    if (!fs.existsSync(manifest)) return false
    return readShimMarker(manifest) !== true
}

function readShimMarker(manifest: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(manifest, "utf8"))[SHIM_MARKER]
    } catch {
        return undefined
    }
}

function shimPackageJson(workflowCoreVersion: string): string {
    return `${JSON.stringify(
        {
            name: "workflow",
            version: workflowCoreVersion,
            type: "module",
            [SHIM_MARKER]: true,
            exports: {
                ".": { workflow: "./workflow.js", default: "./index.js" },
                "./runtime": "./runtime.js",
                "./api": "./api.js",
                "./internal/builtins": "./internal/builtins.js",
                "./internal/class-serialization": "./internal/class-serialization.js"
            }
        },
        null,
        2
    )}\n`
}
