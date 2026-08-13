#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const manifests = [
    { path: "terse-types/package.json", read: json => json.version, write: (json, version) => (json.version = version) },
    { path: "packages/terse-sdk/package.json", read: json => json.version, write: (json, version) => (json.version = version) },
    { path: "packages/terse-cli/package.json", read: json => json.version, write: (json, version) => (json.version = version) },
    { path: "packages/create-terse/package.json", read: json => json.version, write: (json, version) => (json.version = version) },
    { path: "packages/terse-claude-plugin/.claude-plugin/plugin.json", read: json => json.version, write: (json, version) => (json.version = version) },
    {
        path: ".claude-plugin/marketplace.json",
        read: json => json.plugins.find(plugin => plugin.name === "terse")?.version,
        write: (json, version) => {
            json.plugins.find(plugin => plugin.name === "terse").version = version
        }
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
        const json = JSON.parse(readFileSync(path, "utf8"))
        const previous = manifest.read(json)
        manifest.write(json, nextVersion)
        writeFileSync(path, `${JSON.stringify(json, null, 4)}\n`)
        console.log(`${manifest.path}: ${previous} → ${nextVersion}`)
    })
    console.log(`\nOpen a PR with these changes, then publish GitHub Release v${nextVersion} from its merge commit.`)
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

function parseVersion(value) {
    if (!/^\d+\.\d+\.\d+$/.test(value ?? "")) throw new Error(`Version must look like 1.2.3 (got '${value}')`)
    return value
}
