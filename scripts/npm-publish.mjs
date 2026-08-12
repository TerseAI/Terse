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
// A registry lookup can fail transiently (429, 5xx, connection reset) without
// telling us anything about the version, so probes retry before giving up.
const PROBE_ATTEMPTS = 4;
// After a failed publish the write may already have landed while read replicas
// still 404, so confirmation polls a 404 as "not yet visible" rather than "absent".
const CONFIRM_ATTEMPTS = 6;
const RETRY_DELAY_MS = 3000;
// npm's own verdict that the version already exists; more reliable than a read.
const ALREADY_PUBLISHED = /EPUBLISHCONFLICT|cannot publish over|previously published version/i;

const root = repoRoot(dirname(fileURLToPath(import.meta.url)));
const version = parseVersion(requireEnv("RELEASE_VERSION").replace(/^v/, ""));

const published = [];
const skipped = [];

for (const pkg of NPM_PACKAGES) {
    await publishPackage(pkg);
}
console.log(`\nPublished ${describe(published)}; already on npm: ${describe(skipped)}.`);

async function publishPackage(pkg) {
    // Only a definitive "it is there" skips the publish: an inconclusive probe
    // must not abort a release, npm itself rejects a duplicate publish anyway.
    if ((await probeRegistry(pkg)) === true) {
        console.log(`${pkg}@${version} is already on npm, skipping.`);
        skipped.push(pkg);
        return;
    }

    const tarball = join(root, TARBALL_DIR, `${pkg}-${version}.tgz`);
    if (!existsSync(tarball)) throw new Error(`Missing tarball ${tarball}. Did the pack step run?`);

    const { ok, stderr } = publishTarball(tarball);
    if (ok) {
        published.push(pkg);
        return;
    }
    await assertLostRaceToAnotherPublish(pkg, stderr);
    skipped.push(pkg);
}

function publishTarball(tarball) {
    try {
        execFileSync("npm", ["publish", tarball, "--access", "public", "--tag", "latest"], { cwd: root, encoding: "utf8", stdio: ["ignore", "inherit", "pipe"] });
        return { ok: true, stderr: "" };
    } catch (error) {
        const stderr = error.stderr ?? "";
        process.stderr.write(stderr);
        return { ok: false, stderr };
    }
}

// A publish can fail because another run got there first (the probe above is a
// snapshot). Anything else is a real failure.
async function assertLostRaceToAnotherPublish(pkg, stderr) {
    if (ALREADY_PUBLISHED.test(stderr)) {
        console.log(`${pkg}@${version} was already on npm, treating as published.`);
        return;
    }
    if ((await probeRegistry(pkg, CONFIRM_ATTEMPTS, true)) !== true) {
        throw new Error(`Failed to publish ${pkg}@${version}. See the npm output above.`);
    }
    console.log(`${pkg}@${version} landed on npm from another run, treating as published.`);
}

// Returns true (published), false (absent), or null when the registry never gave
// a usable answer. With retryMissing the 404s are retried too, for the window
// where a write has landed but read replicas have not caught up yet.
async function probeRegistry(pkg, attempts = PROBE_ATTEMPTS, retryMissing = false) {
    let outcome = null;
    let reason = "";
    for (let attempt = 1; attempt <= attempts; attempt++) {
        if (attempt > 1) await sleep(RETRY_DELAY_MS);
        try {
            const response = await fetch(`${REGISTRY}/${pkg}/${version}`, { headers: { Accept: "application/json" } });
            if (response.status === 200) return true;
            if (response.status === 404) {
                if (!retryMissing) return false;
                outcome = false;
                reason = "404 not found";
            } else {
                reason = `${response.status} ${(await response.text()).slice(0, 200)}`;
            }
        } catch (error) {
            reason = error.message;
        }
        console.warn(`Registry lookup for ${pkg}@${version} inconclusive (attempt ${attempt}/${attempts}): ${reason}`);
    }
    return outcome;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function describe(packages) {
    return packages.length > 0 ? packages.join(", ") : "none";
}

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
}
