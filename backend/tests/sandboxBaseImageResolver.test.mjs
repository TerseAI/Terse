import assert from "node:assert/strict"
import test from "node:test"

import { SandboxBaseImageResolver } from "../dist/services/sandboxBaseImage/SandboxBaseImageResolver.js"

test("local package hoisting reuses the published sandbox base", async () => {
    const digest = `sha256:${"a".repeat(64)}`
    const resolver = SandboxBaseImageResolver.createForTesting(
        { resolveDigest: async () => digest },
        {
            enabled: true,
            registry: "us-central1-docker.pkg.dev",
            repositoryPrefix: "test-project/public",
            tag: "local-test",
            probeTtlMs: 60_000
        }
    )

    const result = await resolver.resolve({
        releaseImageName: "terse-sandbox-node-pnpm",
        genericImage: "node:22-slim",
        usesLocalPackages: true,
        registryImagesSupported: true
    })

    assert.deepEqual(result, {
        kind: "sandbox",
        reference: `us-central1-docker.pkg.dev/test-project/public/terse-sandbox-node-pnpm@${digest}`
    })
})

test("moving sandbox image tags are resolved for every deployment", async () => {
    const digests = [`sha256:${"a".repeat(64)}`, `sha256:${"b".repeat(64)}`]
    let calls = 0
    const resolver = SandboxBaseImageResolver.createForTesting(
        { resolveDigest: async () => digests[calls++] },
        {
            enabled: true,
            registry: "us-central1-docker.pkg.dev",
            repositoryPrefix: "test-project/public",
            tag: "latest",
            probeTtlMs: 60_000
        }
    )
    const request = {
        releaseImageName: "terse-sandbox-node-pnpm",
        genericImage: "node:22-slim",
        usesLocalPackages: false,
        registryImagesSupported: true
    }

    const first = await resolver.resolve(request)
    const second = await resolver.resolve(request)

    assert.equal(calls, 2)
    assert.notDeepEqual(first, second)
})
