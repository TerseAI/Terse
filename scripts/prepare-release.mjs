#!/usr/bin/env node
// Stamps the repo-wide release version into every manifest, regenerates the
// plugin skills, and opens the release PR. Publishing the GitHub Release for
// the resulting merge commit is what actually ships (see .github/workflows/release.yml).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NPM_PACKAGES, RELEASE_MANIFESTS, parseVersion, repoRoot } from "./release-manifests.mjs";

const root = repoRoot(dirname(fileURLToPath(import.meta.url)));
const version = readVersionArg(process.argv[2]);
const branch = `release/v${version}`;
const noPr = process.argv.includes("--no-pr");

assertCleanMainCheckout();
assertVersionMovesForward();

RELEASE_MANIFESTS.forEach(manifest => stampManifest(manifest));
run("node", ["packages/terse-claude-plugin/scripts/build-skills.mjs"]);
run("pnpm", ["exec", "prettier", "--write", ...RELEASE_MANIFESTS.map(manifest => manifest.path)]);

run("git", ["checkout", "-b", branch]);
run("git", ["add", ...RELEASE_MANIFESTS.map(manifest => manifest.path), "packages/terse-claude-plugin/skills"]);
run("git", ["commit", "-m", `chore: release v${version}`]);

if (noPr) {
    console.log(`\nCommitted on ${branch}. Push it and open the PR yourself, then publish the GitHub Release for the merge commit.`);
    process.exit(0);
}

run("git", ["push", "-u", "origin", branch]);
run("gh", ["pr", "create", "--base", "main", "--title", `chore: release v${version}`, "--body", prBody()]);
console.log(`\nRelease PR opened. Merge it, then:\n  gh release create v${version} --target <merge sha> --title v${version} --notes-file <your notes>`);

function readVersionArg(value) {
    try {
        return parseVersion(value?.replace(/^v/, ""));
    } catch (error) {
        fail(`${error.message}\n  usage: pnpm release:prepare <version> [--no-pr]`);
    }
}

function stampManifest(manifest) {
    const path = join(root, manifest.path);
    const json = JSON.parse(readFileSync(path, "utf8"));
    const previous = manifest.read(json);
    manifest.write(json, version);
    writeFileSync(path, `${JSON.stringify(json, null, 4)}\n`);
    console.log(`  ${manifest.path}: ${previous} → ${version}`);
}

function assertCleanMainCheckout() {
    const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { capture: true }).trim();
    if (branch !== "main") fail(`Run this from main (currently on '${branch}')`);
    if (run("git", ["status", "--porcelain"], { capture: true }).trim() !== "") fail("Working tree is dirty. Commit or stash first.");
    run("git", ["fetch", "origin", "main"]);
    const behind = run("git", ["rev-list", "--count", "HEAD..origin/main"], { capture: true }).trim();
    if (behind !== "0") fail(`main is ${behind} commit(s) behind origin/main. Pull first.`);
}

function assertVersionMovesForward() {
    const current = RELEASE_MANIFESTS.map(manifest => manifest.read(JSON.parse(readFileSync(join(root, manifest.path), "utf8"))));
    const highest = current.reduce((highest, candidate) => (compareVersions(candidate, highest) > 0 ? candidate : highest), "0.0.0");
    if (compareVersions(version, highest) <= 0) fail(`${version} is not ahead of every current version (highest is ${highest})`);
    console.log(`Releasing v${version} (previous high-water mark ${highest}) across ${RELEASE_MANIFESTS.length} manifests and ${NPM_PACKAGES.length} npm packages.\n`);
}

function compareVersions(left, right) {
    const [leftParts, rightParts] = [left.split("."), right.split(".")].map(parts => parts.map(Number));
    return leftParts.reduce((result, part, index) => (result !== 0 ? result : part - rightParts[index]), 0);
}

function run(command, args, options = {}) {
    const stdio = options.capture ? ["ignore", "pipe", "inherit"] : "inherit";
    try {
        return execFileSync(command, args, { cwd: root, stdio, encoding: "utf8" }) ?? "";
    } catch {
        return fail(`\`${command} ${args.join(" ")}\` failed. Nothing was pushed; check the output above.`);
    }
}

function fail(message) {
    console.error(`✗ ${message}`);
    process.exit(1);
}

function prBody() {
    return [
        `Sets the repo-wide release version to **v${version}**.`,
        "",
        "### Problem",
        "",
        `Releases ship one version across the image, the npm packages, and the Claude plugin. That version has to exist in the repo before it can be tagged.`,
        "",
        "### Changes",
        "",
        ...RELEASE_MANIFESTS.map(manifest => `- \`${manifest.path}\` → ${version}`),
        "",
        "### Testing",
        "",
        `Merge this, then publish the GitHub Release \`v${version}\` targeting the merge commit. The release workflow re-checks every manifest against the tag before it publishes anything.`
    ].join("\n");
}
