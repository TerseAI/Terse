import assert from "node:assert/strict"
import test from "node:test"
import ts from "typescript"

import { transformJobSource } from "../../../src/providers/typescript/jobMacro.js"

test("durable step calls become inline journaled closures without workflow bundles", () => {
    const source = `
import { createJob, step } from "terse-sdk"

const client = {
    async send(message: string) {
        return { id: "message-123", message }
    }
}

createJob({
    name: "send-message",
    durable: true,
    onTrigger: async event => {
        return step(client.send(event.payload.message))
    }
})
`

    const result = transformJobSource(ts, source, "src/terse.jobs.ts")

    assert.equal(result.stepsCode, null)
    assert.doesNotMatch(result.code, /use workflow/)
    assert.doesNotMatch(result.code, /use step/)
    assert.doesNotMatch(result.code, /__terse\.steps/)
    assert.match(result.code, /const __terseJob0 = createJob\(/)
    assert.match(result.code, /const __terseWorkflow0 = __defineTerseWorkflow\(__terseJob0\)/)
    assert.match(result.code, /__registerDurableWorkflow\(__terseWorkflow0\)/)
    assert.match(result.code, /__runDurableStep/)
    assert.match(result.code, /name: "client\.send:0"/)
    assert.match(result.code, /input: \[event\.payload\.message\] as const/)
    assert.match(result.code, /run: async \(__terseArgs\) => await client\.send\(\.\.\.__terseArgs\)/)
})

test("keeps runtime-only values constructed inside a zero-argument step helper", () => {
    const source = `
import { createJob, generateText, step } from "terse-sdk"
import { z } from "zod"

createJob({
    name: "generate-joke",
    durable: true,
    onTrigger: async () => step(generateJoke())
})

async function generateJoke() {
    return generateText({
        prompt: "Tell me a joke",
        outputSchema: z.object({ joke: z.string() })
    })
}
`

    const result = transformJobSource(ts, source, "src/terse.jobs.ts")

    assert.match(result.code, /input: \[\] as const/)
    assert.match(result.code, /run: async \(__terseArgs\) => await generateJoke\(\.\.\.__terseArgs\)/)
    assert.match(result.code, /outputSchema: z\.object/)
})
