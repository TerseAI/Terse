import fs from "node:fs/promises"
import path from "node:path"
import { createJob, log, step } from "terse-sdk"

import { Triggers } from "../terse.generated"

export const durableFailureSnapshotRetryJob = createJob({
    name: "Durable Failure Snapshot - Retry resumes failed step",
    triggers: [Triggers.schedule.cron({ expression: "0 9 * * 1" })],
    durable: true,
    onTrigger: async () => {
        const preparedMarker = await step(prepareFixture())
        await log("Failure snapshot retry fixture is ready. The next step should fail exactly once.")

        const recoveryMarker = await step(failOnceThenRecover())
        const verification = await step(verifyFixture(preparedMarker, recoveryMarker))

        await log("PASS: Retry restored the failed sandbox image and replayed completed durable steps", verification)
    }
})

async function prepareFixture(): Promise<string> {
    const directory = fixtureDirectory()
    const marker = "prepared exactly once"
    await fs.mkdir(directory, { recursive: true })

    try {
        await fs.writeFile(preparedMarkerPath(), marker, { flag: "wx" })
    } catch (error) {
        if (isFileAlreadyPresentError(error)) throw new CompletedStepReexecutedError()
        throw error
    }

    return marker
}

async function failOnceThenRecover(): Promise<string> {
    const existingMarker = await readOptionalFile(recoveryMarkerPath())
    if (existingMarker !== null) return existingMarker

    const marker = "written immediately before the intentional failure"
    await fs.writeFile(recoveryMarkerPath(), marker, { flag: "wx" })
    throw new IntentionalFailureSnapshotError()
}

async function verifyFixture(expectedPreparedMarker: string, expectedRecoveryMarker: string): Promise<FailureRetryVerification> {
    const actualPreparedMarker = await fs.readFile(preparedMarkerPath(), "utf8")
    const actualRecoveryMarker = await fs.readFile(recoveryMarkerPath(), "utf8")

    assertMarker(actualPreparedMarker, expectedPreparedMarker, "completed preparation step")
    assertMarker(actualRecoveryMarker, expectedRecoveryMarker, "failure snapshot marker")

    return {
        completedStepReplayed: true,
        failureImageRestored: true,
        preparedMarker: actualPreparedMarker,
        recoveryMarker: actualRecoveryMarker
    }
}

async function readOptionalFile(file: string): Promise<string | null> {
    try {
        return await fs.readFile(file, "utf8")
    } catch (error) {
        if (isFileMissingError(error)) return null
        throw error
    }
}

function fixtureDirectory(): string {
    return path.join(process.cwd(), "fs-snapshot-tests", "failure-retry")
}

function preparedMarkerPath(): string {
    return path.join(fixtureDirectory(), "prepared-once.txt")
}

function recoveryMarkerPath(): string {
    return path.join(fixtureDirectory(), "failure-marker.txt")
}

function assertMarker(actual: string, expected: string, label: string): void {
    if (actual !== expected) throw new FailureRetryVerificationError(label, expected, actual)
}

function isFileMissingError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error && error.code === "ENOENT"
}

function isFileAlreadyPresentError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error && error.code === "EEXIST"
}

class IntentionalFailureSnapshotError extends Error {
    constructor() {
        super("Intentional first-attempt failure. Click Retry in Terse to restore this run's failure snapshot.")
        this.name = "IntentionalFailureSnapshotError"
    }
}

class CompletedStepReexecutedError extends Error {
    constructor() {
        super("The completed preparation step executed again instead of replaying from the durable journal.")
        this.name = "CompletedStepReexecutedError"
    }
}

class FailureRetryVerificationError extends Error {
    constructor(label: string, expected: string, actual: string) {
        super(`${label} did not survive Retry: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
        this.name = "FailureRetryVerificationError"
    }
}

type FailureRetryVerification = {
    completedStepReplayed: true
    failureImageRestored: true
    preparedMarker: string
    recoveryMarker: string
}
