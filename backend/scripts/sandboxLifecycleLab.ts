/**
 * Sandbox lifecycle lab.
 *
 * Exercises ModalSandboxService.getOrCreateSandbox end-to-end against real Modal,
 * walking through every branch the production fix touches:
 *
 *   1. Cold create   — fresh name, no existing sandbox      → "not found, will create" → "created new"
 *   2. Reuse         — same name, sandbox still healthy     → "reused existing"
 *   3. Stale recover — same name after we terminate it      → "stale, terminating before recreate" OR
 *                                                              "not found, will create" (depending on
 *                                                              how fast Modal frees the name)
 *   4. Race          — N parallel calls against a wiped name → likely fires "name conflict on create,
 *                                                              attempting recovery" on at least one caller
 *
 * Run from the backend dir:
 *     pnpm run lab:sandbox
 *
 * Requires backend/.env populated with MODAL_TOKEN_ID, MODAL_TOKEN_SECRET, and the rest of the
 * vars settings.ts requires (a copy of .env.example with secrets filled in is enough).
 *
 * Modal docs grounding the assertions below:
 *   - Sandbox.poll(): https://modal.com/docs/reference/modal.Sandbox
 *     "Returns None if the Sandbox is still running, else returns the exit code."
 *   - Sandbox.terminate(): https://modal.com/docs/reference/modal.Sandbox
 *     "This is a no-op if the Sandbox has already finished running."
 *   - Named sandboxes: https://modal.com/docs/guide/sandboxes
 *     "If a Sandbox with the given name is already running, create() will raise an error."
 *     "Once a Sandbox completely stops running, its name becomes available for reuse."
 */

import "dotenv/config"

import crypto from "node:crypto"

import { Sandbox } from "../src/services/sandboxProvider/SandboxService"
import { ModalSandboxService } from "../src/services/sandboxProvider/ModalSandboxService"

const APP_NAME = "terse-sandbox-lifecycle-lab"
const IMAGE_REGISTRY = "alpine:3.21"
// Per-invocation suffix so concurrent labs from different developers do not collide.
const RUN_ID = crypto.randomBytes(4).toString("hex")
const SANDBOX_UNIQUE_NAME = `lab-${RUN_ID}`

// Tighter than SANDBOX_DEFAULT_OPTIONS so the lab finishes fast and any sandbox left behind
// expires quickly. 60s idle / 5min cap is well within Modal's allowed range.
const FAST_OPTIONS = {
    idleTimeoutMs: 60 * 1000,
    timeoutMs: 5 * 60 * 1000
}

interface ScenarioResult {
    name: string
    sandbox: Sandbox
    durationMs: number
}

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now()
    process.stdout.write(`\n=== ${label} ===\n`)
    try {
        const result = await fn()
        process.stdout.write(`  ok (${Date.now() - t0}ms)\n`)
        return result
    } catch (error) {
        process.stdout.write(`  FAIL (${Date.now() - t0}ms): ${(error as Error).message}\n`)
        throw error
    }
}

async function runOneAndPing(service: ModalSandboxService, label: string): Promise<ScenarioResult> {
    const t0 = Date.now()
    const app = await service.getOrCreateApp(APP_NAME)
    const image = service.getImageFromRegistry(IMAGE_REGISTRY)
    const sb = await service.getOrCreateSandbox(app, image, SANDBOX_UNIQUE_NAME, FAST_OPTIONS)
    const proc = await sb.exec(["echo", `${label}:${sb.sandboxId}`], { stdout: "pipe", stderr: "pipe" })
    const out = (await proc.stdout.readText()).trim()
    const code = await proc.wait()
    process.stdout.write(`  exec exitCode=${code} stdout=${JSON.stringify(out)}\n`)
    return { name: label, sandbox: sb, durationMs: Date.now() - t0 }
}

async function safeTerminate(sb: Sandbox, label: string): Promise<void> {
    try {
        await sb.terminate()
    } catch (error) {
        process.stdout.write(`  ${label} terminate warning: ${(error as Error).message}\n`)
    }
}

async function main(): Promise<void> {
    process.stdout.write(`\n[lab] runId=${RUN_ID} app=${APP_NAME} sandboxName=${SANDBOX_UNIQUE_NAME}\n`)
    process.stdout.write(`[lab] inspect logs in PostHog (or stdout) for "Modal sandbox:" lifecycle entries\n`)

    const service = new ModalSandboxService()

    // ── Scenario 1 ────────────────────────────────────────────────────────────
    // Expectation: "not found, will create" → "create begin" → "created new"
    const s1 = await step("Scenario 1: cold create", () => runOneAndPing(service, "s1"))
    const coldId = s1.sandbox.sandboxId
    process.stdout.write(`  sandboxId=${coldId} (cold)\n`)

    // ── Scenario 2 ────────────────────────────────────────────────────────────
    // Expectation: "getOrCreate begin" → "reused existing" with same sandboxId.
    const s2 = await step("Scenario 2: reuse healthy", () => runOneAndPing(service, "s2"))
    if (s2.sandbox.sandboxId === coldId) {
        process.stdout.write(`  PASS: reused same sandboxId=${s2.sandbox.sandboxId}\n`)
    } else {
        process.stdout.write(`  FAIL: expected reuse, got fresh sandbox ${s2.sandbox.sandboxId} (was ${coldId})\n`)
    }

    // ── Scenario 3 ────────────────────────────────────────────────────────────
    // Terminate then call again. Expectation: either
    //   (a) fromName returns the sandbox + poll() != null → "stale, terminating" → recreate, OR
    //   (b) Modal already freed the name → "not found, will create" → fresh create.
    // Both paths produce a fresh sandboxId. The pre-fix code would fail with AlreadyExistsError
    // (or just silently fall through to a doomed create) — so any success here is a regression
    // signal.
    await step("Scenario 3a: terminate the reused sandbox", () => safeTerminate(s2.sandbox, "s2"))
    const s3 = await step("Scenario 3b: getOrCreate after terminate", () => runOneAndPing(service, "s3"))
    if (s3.sandbox.sandboxId !== coldId) {
        process.stdout.write(`  PASS: fresh sandboxId=${s3.sandbox.sandboxId} (was ${coldId})\n`)
    } else {
        process.stdout.write(`  FAIL: expected new sandbox after terminate, got the original\n`)
    }

    // ── Scenario 4 ────────────────────────────────────────────────────────────
    // Best-effort race: terminate, then fire N parallel getOrCreate calls. At least one is
    // expected to hit "name conflict on create, attempting recovery" — this is the path that
    // covers the production race (two runs for the same agent racing through the create step
    // after a stale eviction). Result is non-deterministic; we report what we observed.
    await step("Scenario 4a: terminate s3 sandbox", () => safeTerminate(s3.sandbox, "s3"))
    const racers = await step("Scenario 4b: 4 parallel getOrCreate calls", async () => {
        return Promise.all([
            runOneAndPing(service, "race-0"),
            runOneAndPing(service, "race-1"),
            runOneAndPing(service, "race-2"),
            runOneAndPing(service, "race-3")
        ])
    })
    const distinctIds = new Set(racers.map(r => r.sandbox.sandboxId))
    process.stdout.write(`  racers resolved to ${distinctIds.size} distinct sandboxId(s): ${[...distinctIds].join(", ")}\n`)
    process.stdout.write(`  (Race exercised conflict recovery if you see "name conflict on create, attempting recovery" in logs)\n`)

    // ── Cleanup ───────────────────────────────────────────────────────────────
    await step("Cleanup: terminate all racer sandboxes", async () => {
        const seen = new Set<string>()
        for (const r of racers) {
            if (seen.has(r.sandbox.sandboxId)) continue
            seen.add(r.sandbox.sandboxId)
            await safeTerminate(r.sandbox, r.name)
        }
    })

    process.stdout.write("\n[lab] done.\n")
}

main()
    .then(() => {
        // Logger uses OpenTelemetry batch processor; give in-flight logs a moment to flush.
        setTimeout(() => process.exit(0), 1000)
    })
    .catch(error => {
        process.stderr.write(`\n[lab] fatal: ${(error as Error).stack ?? error}\n`)
        setTimeout(() => process.exit(1), 1000)
    })
