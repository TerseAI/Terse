#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const manifests = [
    packageManifest("terse-types/package.json"),
    packageManifest("packages/terse-sdk/package.json"),
    packageManifest("packages/terse-cli/package.json"),
    packageManifest("packages/create-terse/package.json"),
    packageManifest("packages/terse-claude-plugin/.claude-plugin/plugin.json"),
    {
        path: ".claude-plugin/marketplace.json",
        read: json => json.plugins.find(plugin => plugin.name === "terse")?.version,
        // Indent 12 is the `terse` plugin entry. The sibling `metadata.version`
        // at indent 8 is the marketplace schema version and must not move.
        versionLine: /^( {12}"version": ")[^"]+(")/m
    }
]

const [command, rawVersion] = process.argv.slice(2)
const version = parseVersion(rawVersion?.replace(/^v/, ""))

if (command === "prepare") prepare(version)
else if (command === "verify") verify(version)
else throw new Error("Usage: release.mjs <prepare|verify> <version>")

function prepare(nextVersion) {
    manifests.forEach(manifest => {
        const path = join(root, manifest.path)
        const source = readFileSync(path, "utf8")
        const previous = manifest.read(JSON.parse(source))
        writeFileSync(path, stampVersion(source, manifest, nextVersion))
        console.log(`${manifest.path}: ${previous} → ${nextVersion}`)
    })
    console.log(`\nOpen a PR with these changes, then publish GitHub Release v${nextVersion} from its merge commit.`)
}

// Rewrites the single version line rather than reserializing: JSON.stringify
// explodes the compact arrays Prettier keeps inline in the plugin manifests.
function stampVersion(source, manifest, nextVersion) {
    const matches = source.match(new RegExp(manifest.versionLine, "gm"))
    if (matches?.length !== 1) throw new Error(`Expected one version line in ${manifest.path}, found ${matches?.length ?? 0}`)
    return source.replace(manifest.versionLine, `$1${nextVersion}$2`)
}

function verify(expected) {
    const mismatched = manifests
        .map(manifest => {
            const json = JSON.parse(readFileSync(join(root, manifest.path), "utf8"))
            return { path: manifest.path, actual: manifest.read(json) }
        })
        .filter(result => result.actual !== expected)

    if (mismatched.length === 0) return
    console.error(`::error::Release manifests do not match ${expected}:`)
    mismatched.forEach(result => console.error(`${result.path}: ${result.actual}`))
    process.exit(1)
}

function packageManifest(path) {
    return { path, read: json => json.version, versionLine: /^( {4}"version": ")[^"]+(")/m }
}

function parseVersion(value) {
    if (!/^\d+\.\d+\.\d+$/.test(value ?? "")) throw new Error(`Version must look like 1.2.3 (got '${value}')`)
    return value
}
