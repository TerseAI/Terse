import assert from "node:assert/strict"
import { test } from "node:test"

import { withDurableObjectEnvironment } from "../src/durableObjectEnvironment.js"

const variableNames = ["DURABLE_OBJECT_TOKEN", "DURABLE_OBJECT_NAMESPACE_ID", "DURABLE_OBJECT_CONTROL_PLANE_URL", "DURABLE_OBJECT_SOCKET_GATEWAY_URL"]

test("scopes local actor credentials and restores the developer environment", async () => {
    const original = new Map(variableNames.map(name => [name, process.env[name]]))
    process.env.DURABLE_OBJECT_TOKEN = "production-token"
    process.env.DURABLE_OBJECT_NAMESPACE_ID = "production-project"
    process.env.DURABLE_OBJECT_CONTROL_PLANE_URL = "https://objects.example.com"
    process.env.DURABLE_OBJECT_SOCKET_GATEWAY_URL = "https://sockets.example.com"

    try {
        await withDurableObjectEnvironment(
            {
                token: "test-token",
                namespaceId: "test.project-1",
                controlPlaneUrl: "https://test-objects.example.com",
                socketGatewayUrl: "https://test-sockets.example.com",
                expiresAtMs: 1_800_000_000_000
            },
            async () => {
                assert.equal(process.env.DURABLE_OBJECT_TOKEN, "test-token")
                assert.equal(process.env.DURABLE_OBJECT_NAMESPACE_ID, "test.project-1")
                assert.equal(process.env.DURABLE_OBJECT_CONTROL_PLANE_URL, "https://test-objects.example.com")
                assert.equal(process.env.DURABLE_OBJECT_SOCKET_GATEWAY_URL, "https://test-sockets.example.com")
            }
        )

        assert.equal(process.env.DURABLE_OBJECT_TOKEN, "production-token")
        assert.equal(process.env.DURABLE_OBJECT_NAMESPACE_ID, "production-project")
        assert.equal(process.env.DURABLE_OBJECT_CONTROL_PLANE_URL, "https://objects.example.com")
        assert.equal(process.env.DURABLE_OBJECT_SOCKET_GATEWAY_URL, "https://sockets.example.com")

        await assert.rejects(
            withDurableObjectEnvironment(null, async () => {
                for (const name of variableNames) assert.equal(process.env[name], undefined)
                throw new Error("test failure")
            }),
            /test failure/
        )

        await withDurableObjectEnvironment(null, async () => {
            for (const name of variableNames) assert.equal(process.env[name], undefined)
        })

        assert.equal(process.env.DURABLE_OBJECT_TOKEN, "production-token")
        assert.equal(process.env.DURABLE_OBJECT_NAMESPACE_ID, "production-project")
        assert.equal(process.env.DURABLE_OBJECT_CONTROL_PLANE_URL, "https://objects.example.com")
        assert.equal(process.env.DURABLE_OBJECT_SOCKET_GATEWAY_URL, "https://sockets.example.com")
    } finally {
        for (const [name, value] of original) {
            if (value === undefined) delete process.env[name]
            else process.env[name] = value
        }
    }
})
