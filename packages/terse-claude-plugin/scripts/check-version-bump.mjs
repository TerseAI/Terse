import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = join(packageRoot, "..", "..")
const pluginDir = relative(repoRoot, packageRoot)
const pluginManifestPath = join(packageRoot, ".claude-plugin", "plugin.json")
const marketplaceManifestPath = join(repoRoot, ".claude-plugin", "marketplace.json")

const headVersion = readPluginVersion()
checkMarketplaceInSync(headVersion)
checkVersionBumped(headVersion)

function readPluginVersion() {
    const manifest = JSON.parse(readFileSync(pluginManifestPath, "utf8"))
    if (typeof manifest.version !== "string" || manifest.version.length === 0) {
        fail(`${pluginManifestPath} has no version field`)
    }
    return manifest.version
}

function checkMarketplaceInSync(pluginVersion) {
    const marketplace = JSON.parse(readFileSync(marketplaceManifestPath, "utf8"))
    const entry = marketplace.plugins.find(plugin => plugin.name === "terse")
    if (!entry) fail(`${marketplaceManifestPath} has no plugin entry named "terse"`)
    if (entry.version !== pluginVersion) {
        fail(`Version mismatch: ${pluginManifestPath} is ${pluginVersion} but the "terse" entry in ${marketplaceManifestPath} is ${entry.version}. Keep them in sync.`)
    }
}

function checkVersionBumped(pluginVersion) {
    const baseSha = resolveBaseSha()
    if (!baseSha) {
        console.warn("check-version-bump: could not resolve a base commit; skipping the bump check")
        return
    }
    if (!pluginChangedSince(baseSha)) return
    const baseVersion = readPluginVersionAt(baseSha)
    if (baseVersion === null) return
    if (baseVersion === pluginVersion) {
        fail(`${pluginDir} changed but the version in ${pluginManifestPath} is still ${pluginVersion}. Bump it (and the matching entry in ${marketplaceManifestPath}).`)
    }
    console.log(`check-version-bump: plugin version bumped ${baseVersion} -> ${pluginVersion}`)
}

function resolveBaseSha() {
    const fromEnv = process.env.PLUGIN_CHECK_BASE_SHA?.trim()
    if (fromEnv) return fromEnv
    for (const ref of ["origin/main", "main"]) {
        const sha = tryGit(["merge-base", "HEAD", ref])
        if (sha) return sha
    }
    return null
}

function pluginChangedSince(baseSha) {
    try {
        execFileSync("git", ["diff", "--quiet", baseSha, "--", pluginDir], { cwd: repoRoot })
        return false
    } catch {
        return true
    }
}

function readPluginVersionAt(baseSha) {
    const manifestAtBase = tryGit(["show", `${baseSha}:${pluginDir}/.claude-plugin/plugin.json`])
    if (manifestAtBase === null) return null
    return JSON.parse(manifestAtBase).version
}

function tryGit(args) {
    try {
        return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim()
    } catch {
        return null
    }
}

function fail(message) {
    console.error(`check-version-bump: ${message}`)
    process.exit(1)
}
