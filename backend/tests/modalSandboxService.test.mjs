import assert from "node:assert/strict"
import test from "node:test"

import { isUnavailableImageError } from "../dist/services/sandboxProvider/ModalSandboxService.js"

test("permission denied means a cached Modal image is unavailable to the active workspace", () => {
    assert.equal(isUnavailableImageError({ "@@nice-grpc:ClientError": true, code: 7 }), true)
})

test("unrelated Modal failures are not treated as missing images", () => {
    assert.equal(isUnavailableImageError({ "@@nice-grpc:ClientError": true, code: 14 }), false)
    assert.equal(isUnavailableImageError({ code: 7 }), false)
    assert.equal(isUnavailableImageError(new Error("network failure")), false)
})
