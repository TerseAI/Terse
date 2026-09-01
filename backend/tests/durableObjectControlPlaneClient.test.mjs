import assert from "node:assert/strict"
import http from "node:http"
import { after, before, test } from "node:test"

import { DurableObjectControlPlaneClient, DurableObjectControlPlaneError } from "../dist/services/DurableObjectControlPlaneClient.js"

let baseUrl
let server
const requests = []

before(async () => {
    server = http.createServer(async (request, response) => {
        const chunks = []
        for await (const chunk of request) chunks.push(chunk)
        requests.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body: Buffer.concat(chunks).toString("utf8") })

        response.setHeader("Content-Type", "application/json")
        if (request.url?.endsWith("/workflow-tokens")) return response.end(JSON.stringify({ token: "workflow-token", expiresAtMs: 1_800_000_000_000 }))
        if (request.url?.includes("fail")) {
            response.statusCode = 503
            return response.end(JSON.stringify({ error: "not ready" }))
        }
        if (request.url?.includes("invalid")) return response.end(JSON.stringify({ changed: "yes" }))
        return response.end(JSON.stringify({ changed: true }))
    })
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
})

test("uses the admin API contract and encodes namespace IDs", async () => {
    const client = DurableObjectControlPlaneClient.createForTesting({ controlPlaneUrl: baseUrl, adminToken: "admin-secret" })

    assert.deepEqual(
        await client.registerDeployment("project/one", {
            codeRevision: "revision-1",
            imageRef: "im-1",
            workingDirectory: "/opt/terse-sdk-run/project",
            actorEntrypoint: "src/durable-objects.ts"
        }),
        { changed: true }
    )
    assert.deepEqual(await client.issueWorkflowToken("project/one", "run-1", 1_800_000_000_000), {
        token: "workflow-token",
        expiresAtMs: 1_800_000_000_000
    })

    assert.deepEqual(
        requests.slice(0, 2).map(request => ({ method: request.method, url: request.url, authorization: request.authorization })),
        [
            { method: "PUT", url: "/v1/namespaces/project%2Fone/deployment", authorization: "Bearer admin-secret" },
            { method: "POST", url: "/v1/namespaces/project%2Fone/workflow-tokens", authorization: "Bearer admin-secret" }
        ]
    )
    assert.deepEqual(JSON.parse(requests[0].body), {
        codeRevision: "revision-1",
        imageRef: "im-1",
        workingDirectory: "/opt/terse-sdk-run/project",
        actorEntrypoint: "src/durable-objects.ts"
    })
    assert.deepEqual(JSON.parse(requests[1].body), { executionId: "run-1", deadlineUnixMs: 1_800_000_000_000 })
})

test("fails closed on a non-success response", async () => {
    const client = DurableObjectControlPlaneClient.createForTesting({ controlPlaneUrl: baseUrl, adminToken: "admin-secret" })
    await assert.rejects(
        () => client.registerDeployment("fail", deployment),
        error => error instanceof DurableObjectControlPlaneError && /HTTP 503.*not ready/.test(error.message)
    )
})

test("fails closed on a response that violates the API contract", async () => {
    const client = DurableObjectControlPlaneClient.createForTesting({ controlPlaneUrl: baseUrl, adminToken: "admin-secret" })
    await assert.rejects(
        () => client.registerDeployment("invalid", deployment),
        error => error instanceof DurableObjectControlPlaneError && /invalid response/.test(error.message)
    )
})

const deployment = {
    codeRevision: "revision-1",
    imageRef: "im-1",
    workingDirectory: "/opt/terse-sdk-run/project",
    actorEntrypoint: "src/durable-objects.ts"
}

test("rejects a control-plane URL with a path", () => {
    assert.throws(
        () => DurableObjectControlPlaneClient.createForTesting({ controlPlaneUrl: `${baseUrl}/api`, adminToken: "admin-secret" }),
        error => error instanceof DurableObjectControlPlaneError && /HTTP\(S\) origin/.test(error.message)
    )
})
