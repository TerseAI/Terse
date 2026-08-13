#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { RELEASE_MANIFESTS, parseVersion, repoRoot } from "./release-manifests.mjs"

const root = repoRoot(dirname(fileURLToPath(import.meta.url)))
const version = parseVersion(process.argv[2]?.replace(/^v/, ""))

RELEASE_MANIFESTS.forEach(manifest => {
    const path = join(root, manifest.path)
    const json = JSON.parse(readFileSync(path, "utf8"))
    const previous = manifest.read(json)
    manifest.write(json, version)
    writeFileSync(path, `${JSON.stringify(json, null, 4)}\n`)
    console.log(`  ${manifest.path}: ${previous} → ${version}`)
})

console.log(`\nOpen a PR with these version changes. After it merges, publish GitHub Release v${version} from the merge commit.`)
