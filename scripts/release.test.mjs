import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { bumpVersion, parsePorcelainPaths } from "./publish-release.mjs"
import { parseVersion, readReleaseVersion } from "./release.mjs"

test("patch releases increment only the patch version", () => {
    assert.equal(bumpVersion("0.4.3", "patch"), "0.4.4")
    assert.equal(bumpVersion("2.9.8", "patch"), "2.9.9")
})

test("minor releases reset the patch version", () => {
    assert.equal(bumpVersion("0.4.3", "minor"), "0.5.0")
    assert.equal(bumpVersion("2.9.8", "minor"), "2.10.0")
})

test("major releases reset minor and patch versions", () => {
    assert.equal(bumpVersion("0.4.3", "major"), "1.0.0")
    assert.equal(bumpVersion("2.9.8", "major"), "3.0.0")
})

test("release versions must be complete numeric semver versions", () => {
    assert.equal(parseVersion("1.2.3"), "1.2.3")
    assert.throws(() => parseVersion("v1.2.3"), /Version must look like/)
    assert.throws(() => parseVersion("1.2"), /Version must look like/)
})

test("all checked-in release manifests agree", () => {
    assert.match(readReleaseVersion(), /^\d+\.\d+\.\d+$/)
})

test("PR sandbox builds use the checked-in DO version before Terse packages are published", () => {
    const root = fileURLToPath(new URL("../", import.meta.url))
    const workflow = readFileSync(new URL("../.github/workflows/docker-build.yml", import.meta.url), "utf8")
    const script = workflow.split("id: published\n")[1].split("run: |\n")[1].split("\n\n")[0]
    const manifest = JSON.parse(readFileSync(new URL("../packages/terse-sdk/package.json", import.meta.url), "utf8"))
    const output = execFileSync(
        "bash",
        [
            "-eu",
            "-c",
            `
        npm() {
            case "$*" in
                "view terse-cli version") echo "0.4.7" ;;
                "view terse-sdk@0.4.7 dependencies --json") echo '{"ms":"2.1.3"}' ;;
                *) return 1 ;;
            esac
        }
        ${script}
    `
        ],
        { cwd: root, env: { ...process.env, GITHUB_OUTPUT: "/dev/stdout" }, encoding: "utf8" }
    )
    assert.ok(output.includes(`durable_objects=${manifest.dependencies["little-durable-objects"]}\n`), output)
})

test("porcelain parsing preserves a leading dot on the first path", () => {
    const output = " M .claude-plugin/marketplace.json\0 M packages/terse-cli/package.json\0"
    assert.deepEqual(parsePorcelainPaths(output), [".claude-plugin/marketplace.json", "packages/terse-cli/package.json"])
})
