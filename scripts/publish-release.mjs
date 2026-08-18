#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { stdin, stdout } from "node:process"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

import { prepare, readReleaseVersion, releaseManifestPaths } from "./release.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const branch = "main"

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(`\nRelease stopped: ${error.message}`)
        process.exitCode = 1
    })
}

async function main() {
    assertInteractiveTerminal()
    assertCleanWorkingTree()
    assertBranch()
    assertGitHubAdmin()
    fetchLatestMain()
    const releaseSha = assertAtLatestMain()
    const currentVersion = readReleaseVersion()
    assertCurrentVersionIsLatestRelease(currentVersion)

    console.log(`\nReady to release from ${branch} at ${releaseSha.slice(0, 12)} (currently v${currentVersion}).`)

    const prompts = createInterface({ input: stdin, output: stdout })
    let nextVersion
    let notes
    try {
        nextVersion = await askReleaseVersion(prompts, currentVersion)
        assertTagDoesNotExist(nextVersion)
        notes = await askReleaseNotes(prompts)
        await confirmRelease(prompts, nextVersion, notes)
    } finally {
        prompts.close()
    }

    await publish(nextVersion, notes)
}

function assertInteractiveTerminal() {
    if (!stdin.isTTY || !stdout.isTTY) throw new Error("Run this command in an interactive terminal.")
}

function assertCleanWorkingTree() {
    const status = capture("git", ["status", "--porcelain"])
    if (status) throw new Error("The working tree must be clean. Commit or stash your changes first.")
    console.log("✓ Working tree is clean")
}

function assertBranch() {
    const currentBranch = capture("git", ["branch", "--show-current"])
    if (currentBranch !== branch) throw new Error(`Switch to ${branch} before releasing (currently on '${currentBranch || "detached HEAD"}').`)
    console.log(`✓ On ${branch}`)
}

function assertGitHubAdmin() {
    run("gh", ["auth", "status", "--hostname", "github.com"])
    const repository = JSON.parse(capture("gh", ["repo", "view", "--json", "nameWithOwner,viewerCanAdminister,viewerPermission"]))
    if (!repository.viewerCanAdminister) {
        throw new Error(`Releasing requires GitHub admin access to ${repository.nameWithOwner} (current permission: ${repository.viewerPermission}).`)
    }
    console.log(`✓ GitHub admin access to ${repository.nameWithOwner}`)
}

function fetchLatestMain() {
    console.log(`↓ Fetching origin/${branch}...`)
    run("git", ["fetch", "--no-tags", "origin", branch])
}

function assertAtLatestMain() {
    const local = capture("git", ["rev-parse", "HEAD"])
    const remote = capture("git", ["rev-parse", "FETCH_HEAD"])
    if (local === remote) {
        console.log(`✓ Local ${branch} exactly matches origin/${branch}`)
        return local
    }

    const [ahead, behind] = capture("git", ["rev-list", "--left-right", "--count", `HEAD...${remote}`]).split(/\s+/)
    throw new Error(`Local ${branch} must exactly match origin/${branch} (ahead ${ahead}, behind ${behind}). Update it and retry.`)
}

function assertCurrentVersionIsLatestRelease(version) {
    const expectedTag = `v${version}`
    const { tagName: latestTag } = JSON.parse(capture("gh", ["release", "view", "--json", "tagName"]))
    if (latestTag !== expectedTag) {
        throw new Error(`Release manifests say ${expectedTag}, but GitHub's latest release is ${latestTag}.`)
    }
    console.log(`✓ Release manifests match GitHub's latest release (${expectedTag})`)
}

async function askReleaseVersion(prompts, currentVersion) {
    const patch = bumpVersion(currentVersion, "patch")
    const minor = bumpVersion(currentVersion, "minor")
    const major = bumpVersion(currentVersion, "major")
    console.log("\nRelease type:")
    console.log(`  1) patch  v${patch}`)
    console.log(`  2) minor  v${minor}`)
    console.log(`  3) major  v${major}`)

    for (;;) {
        const answer = (await prompts.question("Choose 1, 2, or 3 [1]: ")).trim().toLowerCase()
        if (!answer || answer === "1" || answer === "patch") return patch
        if (answer === "2" || answer === "minor") return minor
        if (answer === "3" || answer === "major") return major
        console.log("Enter 1 for patch, 2 for minor, or 3 for major.")
    }
}

export function bumpVersion(version, releaseType) {
    const [major, minor, patch] = version.split(".").map(Number)
    if (releaseType === "major") return `${major + 1}.0.0`
    if (releaseType === "minor") return `${major}.${minor + 1}.0`
    if (releaseType === "patch") return `${major}.${minor}.${patch + 1}`
    throw new Error(`Unsupported release type '${releaseType}'.`)
}

function assertTagDoesNotExist(version) {
    const tag = `v${version}`
    const existing = capture("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`])
    if (existing) throw new Error(`Tag ${tag} already exists.`)
}

async function askReleaseNotes(prompts) {
    console.log("\nEnter release notes in Markdown. Put a single . on its own line when finished:")
    const lines = []
    for (;;) {
        const line = await prompts.question("> ")
        if (line === ".") break
        lines.push(line)
    }

    while (lines[0]?.trim() === "") lines.shift()
    while (lines.at(-1)?.trim() === "") lines.pop()
    if (!lines.some(line => line.trim())) throw new Error("Release notes cannot be empty.")
    return `${lines.join("\n")}\n`
}

async function confirmRelease(prompts, version, notes) {
    console.log(`\nRelease v${version} with these notes:\n`)
    console.log(notes)
    const answer = (await prompts.question("Commit to main, push, and publish this release? [y/N] ")).trim().toLowerCase()
    if (answer !== "y" && answer !== "yes") throw new Error("Cancelled; no files were changed.")
}

async function publish(version, notes) {
    const tag = `v${version}`
    const notesDirectory = mkdtempSync(join(tmpdir(), "terse-release-"))
    const notesPath = join(notesDirectory, `${tag}.md`)
    writeFileSync(notesPath, notes)

    let releaseCommit
    let pushed = false
    try {
        console.log(`\nPreparing ${tag}...`)
        prepare(version, { printNextSteps: false })
        assertOnlyReleaseFilesChanged()
        run("git", ["diff", "--check", "--", ...releaseManifestPaths])
        run("git", ["add", "--", ...releaseManifestPaths])
        run("git", ["commit", "-m", `Release ${tag}`])
        releaseCommit = capture("git", ["rev-parse", "HEAD"])
        assertReleaseCommit()

        console.log(`\nPushing ${tag} commit to origin/${branch}...`)
        run("git", ["push", "origin", `HEAD:${branch}`])
        pushed = true

        console.log(`\nPublishing GitHub Release ${tag}...`)
        run("gh", ["release", "create", tag, "--title", tag, "--notes-file", notesPath, "--target", releaseCommit, "--fail-on-no-commits"])

        cleanup(notesDirectory)
        console.log(`\n✓ Published ${tag} from ${releaseCommit.slice(0, 12)}. The Release workflow is now running.`)
    } catch (error) {
        if (pushed) {
            console.error(`\nThe version commit is already on origin/${branch}, but the GitHub Release was not confirmed.`)
            console.error(`Release notes were kept at ${notesPath}`)
            console.error(`Retry: gh release create ${tag} --title ${tag} --notes-file ${notesPath} --target ${releaseCommit} --fail-on-no-commits`)
        } else {
            cleanup(notesDirectory)
            if (releaseCommit) {
                console.error(`\nThe release commit ${releaseCommit.slice(0, 12)} exists locally but was not pushed.`)
            } else {
                restorePreparedFiles()
            }
        }
        throw error
    }
}

function assertReleaseCommit() {
    const committed = capture("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]).split("\n").filter(Boolean)
    const unexpected = committed.filter(path => !releaseManifestPaths.includes(path))
    const missing = releaseManifestPaths.filter(path => !committed.includes(path))
    if (unexpected.length || missing.length) {
        throw new Error(formatChangedFilesError(unexpected, missing))
    }

    const status = capture("git", ["status", "--porcelain"])
    if (status) throw new Error("A commit hook left additional working-tree changes. Nothing was pushed.")
}

function assertOnlyReleaseFilesChanged() {
    const changed = parsePorcelainPaths(captureRaw("git", ["status", "--porcelain=v1", "-z", "--untracked-files=no", "--no-renames"]))
    const unexpected = changed.filter(path => !releaseManifestPaths.includes(path))
    const missing = releaseManifestPaths.filter(path => !changed.includes(path))
    if (unexpected.length || missing.length) {
        throw new Error(formatChangedFilesError(unexpected, missing))
    }
}

export function parsePorcelainPaths(output) {
    return output
        .split("\0")
        .filter(Boolean)
        .map(entry => entry.slice(3))
}

function formatChangedFilesError(unexpected, missing) {
    return [unexpected.length ? `Unexpected files changed: ${unexpected.join(", ")}` : "", missing.length ? `Expected version files did not change: ${missing.join(", ")}` : ""]
        .filter(Boolean)
        .join("\n")
}

function restorePreparedFiles() {
    const result = spawnSync("git", ["restore", "--source=HEAD", "--staged", "--worktree", "--", ...releaseManifestPaths], {
        cwd: root,
        encoding: "utf8",
        stdio: "inherit"
    })
    if (result.status === 0) console.error("Version files were restored to their pre-release state.")
    else console.error("Could not restore the prepared version files; inspect git status before retrying.")
}

function cleanup(path) {
    try {
        rmSync(path, { recursive: true, force: true })
    } catch (error) {
        console.error(`Warning: could not remove temporary directory ${path}: ${error.message}`)
    }
}

function capture(command, args) {
    return captureRaw(command, args).trim()
}

function captureRaw(command, args) {
    return execute(command, args, { capture: true })
}

function run(command, args) {
    execute(command, args)
}

function execute(command, args, { capture = false } = {}) {
    const result = spawnSync(command, args, {
        cwd: root,
        encoding: "utf8",
        stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit"
    })
    if (result.error?.code === "ENOENT") throw new Error(`Required command '${command}' is not installed.`)
    if (result.error) throw result.error
    if (result.status === 0) return result.stdout ?? ""

    if (capture && result.stderr) process.stderr.write(result.stderr)
    throw new Error(`Command failed: ${command} ${args.join(" ")}`)
}
