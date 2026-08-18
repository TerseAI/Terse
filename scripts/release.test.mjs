import assert from "node:assert/strict"
import { test } from "node:test"

import { bumpVersion } from "./publish-release.mjs"
import { parseVersion, readReleaseVersion } from "./release.mjs"

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
