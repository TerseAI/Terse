import type { Sandbox } from "./SandboxService"

export async function readSandboxRegion(sandbox: Pick<Sandbox, "exec">): Promise<string> {
    const process = await sandbox.exec(["printenv", "MODAL_REGION"], { stdout: "pipe", stderr: "pipe", timeoutMs: 10_000 })
    const [exitCode, output] = await Promise.all([process.wait(), process.stdout.readText()])
    const region = output.replace(/\r?\n$/u, "")
    if (exitCode !== 0 || !/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(region)) {
        throw new Error("Sandbox did not report a valid MODAL_REGION")
    }
    return region
}
