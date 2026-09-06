import assert from "node:assert/strict"
import test from "node:test"

import { DurableObjectControlPlaneClient } from "../src/services/DurableObjectControlPlaneClient"
import { readSandboxRegion } from "../src/services/sandboxProvider/sandboxRegion"

const config = { controlPlaneUrl: "https://objects.example.com/", adminToken: "test-admin-token" }

test("passes the sandbox region unchanged when issuing a workflow token", async () => {
    const client = new DurableObjectControlPlaneClient(config, async (url, init) => {
        assert.equal(url, "https://objects.example.com/v1/namespaces/project%2Fone/workflow-tokens")
        assert.equal(init?.method, "POST")
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-admin-token")
        assert.deepEqual(JSON.parse(String(init?.body)), { executionId: "run-1", storageRegion: "us-central1-a", deadlineUnixMs: 1234 })
        assert.ok(init?.signal instanceof AbortSignal)
        return Response.json({ token: "workflow-token", expiresAtMs: 1234 })
    })
    assert.deepEqual(await client.issueWorkflowToken("project/one", "run-1", "us-central1-a", 1234), { token: "workflow-token", expiresAtMs: 1234 })
})

test("registers deployment metadata without placement settings", async () => {
    const deployment = { codeRevision: "revision", imageRef: "image", workingDirectory: "/project", actorEntrypoint: "src/durable-objects.ts" }
    const client = new DurableObjectControlPlaneClient(config, async (url, init) => {
        assert.equal(url, "https://objects.example.com/v1/namespaces/project/deployment")
        assert.equal(init?.method, "PUT")
        assert.deepEqual(JSON.parse(String(init?.body)), deployment)
        return Response.json({ changed: true })
    })
    assert.deepEqual(await client.registerDeployment("project", deployment), { changed: true })
})

test("rejects HTTP failures, invalid responses, and invalid control-plane origins", async () => {
    const rejected = new DurableObjectControlPlaneClient(config, async () => new Response("denied", { status: 403 }))
    await assert.rejects(rejected.issueWorkflowToken("project", "run", "us-east-1", 1234), /HTTP 403.*denied/)
    const invalid = new DurableObjectControlPlaneClient(config, async () => Response.json({ token: "", expiresAtMs: 0 }))
    await assert.rejects(invalid.issueWorkflowToken("project", "run", "us-east-1", 1234))
    for (const controlPlaneUrl of ["invalid", "file:///tmp", "https://user:secret@example.com", "https://example.com/path"]) {
        assert.throws(() => new DurableObjectControlPlaneClient({ ...config, controlPlaneUrl }))
    }
})

test("reads MODAL_REGION exactly and rejects missing or invalid values", async () => {
    for (const [output, exitCode, expected] of [
        ["us-east-1\n", 0, "us-east-1"],
        ["us-central1-a\n", 0, "us-central1-a"],
        ["", 1, null],
        [" us-east-1\n", 0, null]
    ] as const) {
        const sandbox = {
            exec: async (command: string[]) => {
                assert.deepEqual(command, ["printenv", "MODAL_REGION"])
                return { wait: async () => exitCode, stdout: { readText: async () => output } }
            }
        } as Parameters<typeof readSandboxRegion>[0]
        if (expected) assert.equal(await readSandboxRegion(sandbox), expected)
        else await assert.rejects(readSandboxRegion(sandbox), /valid MODAL_REGION/)
    }
})
