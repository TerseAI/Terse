import { describe, expect, it } from "vitest"

import { CliError } from "../src/cliError.js"
import { parseEventFixtureJson } from "../src/eventFixture.js"
import { parseSerializedEventJson } from "../src/serializedEvent.js"

function captureDetail(fn: () => unknown): string {
    try {
        fn()
    } catch (error) {
        if (error instanceof CliError) return error.opts.detail ?? ""
        throw error
    }
    throw new Error("expected a CliError")
}

describe("trigger validation errors", () => {
    it("reports field-level issues for a flat fixture missing fields", () => {
        const detail = captureDetail(() => parseEventFixtureJson(JSON.stringify({ integrationType: "slack", eventType: "message", text: "hi" }), "--event"))

        expect(detail).toContain("channelId")
        expect(detail).not.toMatch(/^✖ Invalid input\n/)
    })

    it("reports unknown integration types with the valid values", () => {
        const detail = captureDetail(() => parseEventFixtureJson(JSON.stringify({ integrationType: "notreal", eventType: "message" }), "--event"))

        expect(detail).toContain('Unknown integrationType "notreal"')
        expect(detail).toContain("slack")
    })

    it("explains integrations that have no trigger events", () => {
        const detail = captureDetail(() => parseEventFixtureJson(JSON.stringify({ integrationType: "notion", eventType: "message" }), "--event"))

        expect(detail).toContain('integrationType "notion" has no trigger events')
    })

    it("reports field-level issues inside a full envelope's data", () => {
        const envelope = {
            integrationType: "slack",
            eventType: "message",
            formattedContent: "hello",
            debugLog: "debug",
            data: { integrationType: "slack", eventType: "message", text: "hi" }
        }
        const detail = captureDetail(() => parseSerializedEventJson(JSON.stringify(envelope), "--event"))

        expect(detail).toContain("channelId")
    })

    it("accepts manual sample triggers for any integration", () => {
        const event = parseEventFixtureJson(JSON.stringify({ integrationType: "notion", eventType: "manual_sample" }), "--event")

        expect(event.data.eventType).toBe("manual_sample")
    })
})
