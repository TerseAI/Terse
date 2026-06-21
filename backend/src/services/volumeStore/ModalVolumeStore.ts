import logger from "../../common/logger"
import { shellQuote } from "../../common/shellEscape"
import { getSandboxProvider } from "../sandboxProvider"
import { SANDBOX_DEFAULT_OPTIONS } from "../sandboxProvider/ModalSandboxService"
import type { Sandbox, SandboxVolume } from "../sandboxProvider/SandboxService"

import type { AgentVolumeStore, VolumeFileEntry, VolumeStat } from "./types"
import { joinVolumePath, resolveVolumeRelativePath, volumeUtilitySandboxName } from "./volumePaths"

const MODAL_VOLUME_MOUNT = "/vol"
const UTILITY_APP_NAME = "terse-volume-access"
const UTILITY_IMAGE = "alpine:3.21"

type CachedVolumeSandbox = {
    sandbox: Sandbox
    volume: SandboxVolume
}

export class ModalVolumeStore implements AgentVolumeStore {
    private readonly cache = new Map<string, CachedVolumeSandbox>()

    private resolveMountedPath(relativePath: string, options?: { requiredPrefix?: string }): string {
        const resolved = resolveVolumeRelativePath(relativePath, options)
        const joined = joinVolumePath(resolved)
        if (joined === "." || joined === "") {
            return MODAL_VOLUME_MOUNT
        }
        return `${MODAL_VOLUME_MOUNT}/${joined}`
    }

    /** Drop cached utility sandboxes after the backing volume is deleted. */
    evictCache(volumeNames: string[]): void {
        for (const volumeName of volumeNames) {
            const cached = this.cache.get(volumeName)
            if (!cached) {
                continue
            }
            this.cache.delete(volumeName)
            void cached.sandbox.terminate().catch(error => {
                logger.warn("Modal volume store: failed to terminate evicted utility sandbox", {
                    volumeName,
                    sandboxId: cached.sandbox.sandboxId,
                    error
                })
            })
        }
    }

    private async getUtilitySandbox(volumeName: string): Promise<Sandbox> {
        const cached = this.cache.get(volumeName)
        if (cached) {
            return cached.sandbox
        }

        const sandboxService = getSandboxProvider()
        const app = await sandboxService.getOrCreateApp(UTILITY_APP_NAME)
        const volume = await sandboxService.getOrCreateVolume(volumeName)
        const image = sandboxService.getImageFromRegistry(UTILITY_IMAGE)
        const sandbox = await sandboxService.getOrCreateSandbox(app, image, volumeUtilitySandboxName(volumeName), {
            volumes: { [MODAL_VOLUME_MOUNT]: volume },
            ...SANDBOX_DEFAULT_OPTIONS
        })

        this.cache.set(volumeName, { sandbox, volume })
        logger.info("Modal volume store: utility sandbox ready", { volumeName, sandboxId: sandbox.sandboxId })
        return sandbox
    }

    private async exec(volumeName: string, command: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
        const sandbox = await this.getUtilitySandbox(volumeName)
        const proc = await sandbox.exec(["sh", "-c", command], { stdout: "pipe", stderr: "pipe" })
        const [stdout, stderr] = await Promise.all([proc.stdout.readText(), proc.stderr.readText()])
        const exitCode = await proc.wait()
        return { exitCode, stdout, stderr }
    }

    async read(volumeName: string, relativePath: string): Promise<string> {
        const mountedPath = this.resolveMountedPath(relativePath)
        const result = await this.exec(volumeName, `cat ${shellQuote(mountedPath)}`)
        if (result.exitCode !== 0) {
            throw new Error(result.stderr.trim() || `Failed to read ${relativePath}`)
        }
        return result.stdout
    }

    async write(volumeName: string, relativePath: string, content: string): Promise<void> {
        const mountedPath = this.resolveMountedPath(relativePath)
        const sandbox = await this.getUtilitySandbox(volumeName)
        const dirResult = await this.exec(volumeName, `mkdir -p ${shellQuote(mountedPath.replace(/\/[^/]+$/, "") || MODAL_VOLUME_MOUNT)}`)
        if (dirResult.exitCode !== 0) {
            throw new Error(dirResult.stderr.trim() || `Failed to create parent directory for ${relativePath}`)
        }

        const file = await sandbox.open(mountedPath, "w")
        try {
            await file.write(new TextEncoder().encode(content))
            await file.flush()
        } finally {
            await file.close()
        }
    }

    async list(volumeName: string, relativePath: string): Promise<VolumeFileEntry[]> {
        const mountedPath = relativePath === "" ? MODAL_VOLUME_MOUNT : this.resolveMountedPath(relativePath)
        const result = await this.exec(
            volumeName,
            `if [ ! -e ${shellQuote(mountedPath)} ]; then exit 44; fi; if [ ! -d ${shellQuote(mountedPath)} ]; then exit 45; fi; find ${shellQuote(mountedPath)} -mindepth 1 -maxdepth 1 \\( -name '.*' -o -name node_modules \\) -prune -o -print`
        )

        if (result.exitCode === 44) {
            throw new Error(`The path ${relativePath || "/"} does not exist. Please provide a valid path.`)
        }
        if (result.exitCode === 45) {
            throw new Error(`The path ${relativePath} is not a directory.`)
        }
        if (result.exitCode !== 0) {
            throw new Error(result.stderr.trim() || `Failed to list ${relativePath}`)
        }

        const lines = result.stdout
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean)

        const entries: VolumeFileEntry[] = []
        for (const absolute of lines) {
            const statResult = await this.exec(volumeName, `if [ -d ${shellQuote(absolute)} ]; then echo dir; stat -c %s ${shellQuote(absolute)} 2>/dev/null || echo 0; else echo file; stat -c %s ${shellQuote(absolute)}; fi`)
            if (statResult.exitCode !== 0) continue
            const [kind, sizeRaw] = statResult.stdout.trim().split("\n")
            const rel = absolute.startsWith(`${MODAL_VOLUME_MOUNT}/`) ? absolute.slice(MODAL_VOLUME_MOUNT.length + 1) : absolute.replace(`${MODAL_VOLUME_MOUNT}/`, "")
            entries.push({
                path: rel,
                isDirectory: kind === "dir",
                sizeBytes: Number.parseInt(sizeRaw ?? "0", 10) || 0
            })
        }

        return entries.sort((a, b) => a.path.localeCompare(b.path))
    }

    async exists(volumeName: string, relativePath: string): Promise<boolean> {
        if (relativePath === "") {
            return true
        }
        const mountedPath = this.resolveMountedPath(relativePath)
        const result = await this.exec(volumeName, `if [ -e ${shellQuote(mountedPath)} ]; then echo yes; else echo no; fi`)
        return result.stdout.trim() === "yes"
    }

    async stat(volumeName: string, relativePath: string): Promise<VolumeStat> {
        const mountedPath = this.resolveMountedPath(relativePath)
        const result = await this.exec(
            volumeName,
            `if [ ! -e ${shellQuote(mountedPath)} ]; then exit 44; fi; if [ -d ${shellQuote(mountedPath)} ]; then echo dir; echo 0; else echo file; stat -c %s ${shellQuote(mountedPath)}; fi`
        )
        if (result.exitCode === 44) {
            throw new Error(`The path ${relativePath} does not exist. Please provide a valid path.`)
        }
        if (result.exitCode !== 0) {
            throw new Error(result.stderr.trim() || `Failed to stat ${relativePath}`)
        }
        const [kind, sizeRaw] = result.stdout.trim().split("\n")
        return {
            path: relativePath,
            isDirectory: kind === "dir",
            sizeBytes: Number.parseInt(sizeRaw ?? "0", 10) || 0
        }
    }

    async deletePath(volumeName: string, relativePath: string): Promise<void> {
        const mountedPath = this.resolveMountedPath(relativePath)
        const result = await this.exec(volumeName, `rm -rf ${shellQuote(mountedPath)}`)
        if (result.exitCode !== 0) {
            throw new Error(result.stderr.trim() || `Failed to delete ${relativePath}`)
        }
    }

    async rename(volumeName: string, fromPath: string, toPath: string): Promise<void> {
        const fromMounted = this.resolveMountedPath(fromPath)
        const toMounted = this.resolveMountedPath(toPath)
        const result = await this.exec(
            volumeName,
            `if [ ! -e ${shellQuote(fromMounted)} ]; then exit 44; fi; if [ -e ${shellQuote(toMounted)} ]; then exit 46; fi; mkdir -p ${shellQuote(toMounted.replace(/\/[^/]+$/, "") || MODAL_VOLUME_MOUNT)}; mv ${shellQuote(fromMounted)} ${shellQuote(toMounted)}`
        )
        if (result.exitCode === 44) {
            throw new Error(`Error: The path ${fromPath} does not exist`)
        }
        if (result.exitCode === 46) {
            throw new Error(`Error: The destination ${toPath} already exists`)
        }
        if (result.exitCode !== 0) {
            throw new Error(result.stderr.trim() || `Failed to rename ${fromPath}`)
        }
    }

    async mkdir(volumeName: string, relativePath: string): Promise<void> {
        const mountedPath = this.resolveMountedPath(relativePath)
        const result = await this.exec(volumeName, `mkdir -p ${shellQuote(mountedPath)}`)
        if (result.exitCode !== 0) {
            throw new Error(result.stderr.trim() || `Failed to mkdir ${relativePath}`)
        }
    }
}
