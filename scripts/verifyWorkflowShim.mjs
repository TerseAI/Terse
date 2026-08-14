#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const SHIM_DIR = "packages/terse-cli/templates/typescript/workflow-shim"

// `terse build` writes these two files into the user's project so @workflow/builders can resolve
// its hardcoded `workflow/*` specifiers without the umbrella package. They are compiled step
// sources rather than re-exports, so they are copied, and a Workflow bump silently invalidates
// them. Release fails here instead of at a customer's deploy.
const VENDORED = [
    { shim: "stdlib.js", upstream: "package/dist/stdlib.js" },
    { shim: "internal/builtins.js", upstream: "package/dist/internal/builtins.js" }
]

export function verifyWorkflowShim() {
    const version = pinnedWorkflowVersion()
    const tarball = packWorkflow(version)
    const drifted = VENDORED.filter(file => readShimFile(file.shim) !== readUpstreamFile(tarball, file.upstream))

    if (drifted.length === 0) {
        console.log(`workflow shim: ${VENDORED.length} vendored files match workflow@${version}`)
        return
    }

    console.error(`::error::The vendored workflow shim no longer matches workflow@${version}:`)
    drifted.forEach(file => console.error(`${SHIM_DIR}/${file.shim}: re-copy from ${file.upstream}, keeping the version header`))
    process.exit(1)
}

// helpers

function pinnedWorkflowVersion() {
    const manifest = JSON.parse(readFileSync(join(root, "packages/terse-cli/package.json"), "utf8"))
    const version = manifest.dependencies["@workflow/core"]
    if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error(`terse-cli must pin @workflow/core to an exact version (got '${version}')`)
    return version
}

function packWorkflow(version) {
    const destination = mkdtempSync(join(tmpdir(), "terse-workflow-shim-"))
    execFileSync("npm", ["pack", `workflow@${version}`, "--pack-destination", destination, "--silent"], { stdio: ["ignore", "ignore", "inherit"] })
    return join(destination, readdirSync(destination)[0])
}

function readUpstreamFile(tarball, path) {
    return normalize(execFileSync("tar", ["-xzOf", tarball, path], { encoding: "utf8" }))
}

function readShimFile(path) {
    return normalize(readFileSync(join(root, SHIM_DIR, path), "utf8"))
}

// Our copies carry a leading provenance header, and neither side's source map matters.
function normalize(source) {
    const lines = source.split("\n").filter(line => !line.startsWith("//# sourceMappingURL="))
    return lines.slice(headerLineCount(lines)).join("\n").trim()
}

function headerLineCount(lines) {
    const firstCodeLine = lines.findIndex(line => !line.startsWith("//"))
    return firstCodeLine === -1 ? lines.length : firstCodeLine
}
