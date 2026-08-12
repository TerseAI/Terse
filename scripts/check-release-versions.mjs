#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { RELEASE_MANIFESTS, repoRoot } from "./release-manifests.mjs";

const expected = process.argv[2];
if (!expected) {
    console.error("usage: check-release-versions.mjs <version>");
    process.exit(1);
}

const root = repoRoot(dirname(fileURLToPath(import.meta.url)));
const mismatched = RELEASE_MANIFESTS.map(manifest => {
    const actual = manifest.read(JSON.parse(readFileSync(join(root, manifest.path), "utf8")));
    return { path: manifest.path, actual };
}).filter(result => result.actual !== expected);

if (mismatched.length > 0) {
    console.error(`::error::Expected every manifest to be at ${expected}. Run 'pnpm release:prepare ${expected}' and release the resulting commit.`);
    mismatched.forEach(result => console.error(`  ${result.path}: ${result.actual}`));
    process.exit(1);
}

console.log(`All ${RELEASE_MANIFESTS.length} manifests are at ${expected}.`);
