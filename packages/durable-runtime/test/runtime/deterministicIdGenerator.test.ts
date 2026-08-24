import { describe, expect, test } from "vitest"

import { DeterministicIdGenerator } from "../../src/runtime/deterministicIdGenerator.js"

const timestamp = Date.parse("2026-08-24T15:30:00.000Z")

function createGenerator(seed = "run-123"): DeterministicIdGenerator {
    return new DeterministicIdGenerator({ seed, timestamp })
}

describe("DeterministicIdGenerator", () => {
    test("preserves the ID sequence for existing journals", () => {
        const generator = createGenerator()

        expect([generator.next({ namespace: "step" }), generator.next({ namespace: "hook" }), generator.next({ namespace: "wait" }), generator.next({ namespace: "step" })]).toEqual([
            "step_01M0T693606YR9RF1E6NAZG7K0",
            "hook_01M0T69360DR403A9EWSRAARQ2",
            "wait_01M0T693602RCK6XZ04R7GRBPZ",
            "step_01M0T693606YR9RF1E6NAZG7K1"
        ])
    })

    test("replays the same ID sequence from the same run data", () => {
        const first = createGenerator()
        const replay = createGenerator()

        const firstIds = Array.from({ length: 3 }, () => first.next({ namespace: "step" }))
        const replayIds = Array.from({ length: 3 }, () => replay.next({ namespace: "step" }))

        expect(replayIds).toEqual(firstIds)
    })

    test("generates unique IDs in lexical order", () => {
        const generator = createGenerator()
        const ids = Array.from({ length: 1_000 }, () => generator.next({ namespace: "step" }))

        expect(new Set(ids)).toHaveLength(ids.length)
        expect(ids).toEqual([...ids].sort())
    })

    test("isolates runs with different seeds", () => {
        const firstRunId = createGenerator("run-123").next({ namespace: "step" })
        const secondRunId = createGenerator("run-456").next({ namespace: "step" })

        expect(secondRunId).not.toBe(firstRunId)
    })

    test("isolates namespace sequences", () => {
        const interleaved = createGenerator()
        const firstInterleavedStep = interleaved.next({ namespace: "step" })
        const hook = interleaved.next({ namespace: "hook" })
        const secondInterleavedStep = interleaved.next({ namespace: "step" })

        const stepsOnly = createGenerator()
        const firstStep = stepsOnly.next({ namespace: "step" })
        const secondStep = stepsOnly.next({ namespace: "step" })

        expect([firstInterleavedStep, secondInterleavedStep]).toEqual([firstStep, secondStep])
        expect(hook).toMatch(/^hook_[0-7][0-9A-HJKMNP-TV-Z]{25}$/)
    })

    test.each(["step", "hook", "wait"] as const)("generates a valid %s ULID", namespace => {
        expect(createGenerator().next({ namespace })).toMatch(new RegExp(`^${namespace}_[0-7][0-9A-HJKMNP-TV-Z]{25}$`))
    })

    test("rejects an empty seed", () => {
        expect(() => new DeterministicIdGenerator({ seed: "", timestamp })).toThrow()
    })

    test.each([Number.NaN, -1, 1.5, 2 ** 48])("rejects the invalid timestamp %s", invalidTimestamp => {
        expect(() => new DeterministicIdGenerator({ seed: "run-123", timestamp: invalidTimestamp })).toThrow()
    })
})
