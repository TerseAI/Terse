#!/usr/bin/env node
// Publishes the packed release tarballs, dependencies first so a consumer never
// resolves against a missing version. Re-runnable: a version already on the
// registry is skipped instead of failing, so a release that died halfway through
// is finished by re-running the job.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NPM_PACKAGES, parseVersion, repoRoot } from "./release-manifests.mjs";

const REGISTRY = "https://registry.npmjs.org";
const TARBALL_DIR = "dist-tarballs";

const root = repoRoot(dirname(fileURLToPath(import.meta.url)));
const version = parseVersion(requireEnv("RELEASE_VERSION").replace(/^v/, ""));

const published = [];
const skipped = [];

for (const pkg of NPM_PACKAGES) {
    await publishPackage(pkg);
}
console.log(`\nPublished ${describe(published)}; already on npm: ${describe(skipped)}.`);

async function publishPackage(pkg) {
    if (await isOnRegistry(pkg)) {
        console.log(`${pkg}@${version} is already on npm, skipping.`);
        skipped.push(pkg);
        return;
    }

    const tarball = join(root, TARBALL_DIR, `${pkg}-${version}.tgz`);
    if (!existsSync(tarball)) throw new Error(`Missing tarball ${tarball}. Did the pack step run?`);

    if (publishTarball(tarball)) {
        published.push(pkg);
        return;
    }
    await assertLostRaceToAnotherPublish(pkg);
    skipped.push(pkg);
}

function publishTarball(tarball) {
    try {
        execFileSync("npm", ["publish", tarball, "--access", "public", "--tag", "latest"], { cwd: root, stdio: "inherit" });
        return true;
    } catch {
        return false;
    }
}

// A publish can fail because another run got there first (the registry lookup
// above is a snapshot). Anything else is a real failure.
async function assertLostRaceToAnotherPublish(pkg) {
    if (!(await isOnRegistry(pkg))) throw new Error(`Failed to publish ${pkg}@${version}. See the npm output above.`);
    console.log(`${pkg}@${version} landed on npm from another run, treating as published.`);
}

async function isOnRegistry(pkg) {
    const response = await fetch(`${REGISTRY}/${pkg}/${version}`, { headers: { Accept: "application/json" } });
    if (response.status === 200) return true;
    if (response.status === 404) return false;
    throw new Error(`Registry lookup for ${pkg}@${version} failed: ${response.status} ${await response.text()}`);
}

function describe(packages) {
    return packages.length > 0 ? packages.join(", ") : "none";
}

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
}
