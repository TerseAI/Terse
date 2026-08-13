#!/usr/bin/env node
/**
 * Boots one throwaway sandbox from a freshly published image so Modal pulls and caches it.
 *
 * Modal caches an image the first time something runs on it, so without this the first customer
 * deploy after a release pays the pull: measured at 22.8s against ~200ms once cached, and the
 * image is ~1.5GB. Nobody should draw that straw at random.
 */
import { ModalClient } from "modal"

const APP = "terse-sdk-image-builder"

const reference = requireEnv("SANDBOX_IMAGE_REFERENCE")
const modal = new ModalClient({ tokenId: requireEnv("MODAL_TOKEN_ID"), tokenSecret: requireEnv("MODAL_TOKEN_SECRET") })

const started = Date.now()
const app = await modal.apps.fromName(APP, { createIfMissing: true })
const sandbox = await modal.sandboxes.create(app, modal.images.fromRegistry(reference), {
    timeoutMs: 10 * 60_000,
    name: `warm-${Date.now()}`
})

try {
    // Touch the paths a deploy depends on, so a broken image fails the release rather than a customer.
    // The version marker has no trailing newline, so the count would run onto the end of it.
    const proc = await sandbox.exec(["sh", "-c", "cat /opt/terse-sdk-cache/cli/.terse-cli-version; echo; ls /opt/terse-sdk-run/project/node_modules | wc -l"], {
        stdout: "pipe",
        stderr: "pipe"
    })
    const [stdout, stderr] = await Promise.all([proc.stdout.readText(), proc.stderr.readText()])
    const exitCode = await proc.wait()
    if (exitCode !== 0) throw new Error(`Sandbox image is not usable: ${stderr.trim() || `exit ${exitCode}`}`)

    const [cliVersion, packageCount] = stdout.trim().split("\n")
    console.log(`Warmed ${reference} in ${((Date.now() - started) / 1000).toFixed(1)}s (baked CLI ${cliVersion}, ${packageCount} packages)`)
} finally {
    await sandbox.terminate().catch(() => {})
}

function requireEnv(name) {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}
