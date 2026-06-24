import fs from "node:fs/promises"
import path from "node:path"

import logger from "../../common/logger"
import { SandboxVolume } from "../sandboxProvider/SandboxService"
import { projectVolumeName } from "../sdkSandboxLayerKeys"

import { VolumeManager } from "./VolumeManager"
import { VolumeDirEntry, VolumeFs } from "./types"

const SANDBOX_ROOT = "/data/sandbox"
const VOLUMES_DIR = path.join(SANDBOX_ROOT, "volumes")

export class LocalVolumeManager implements VolumeManager {
    async getOrCreateProjectVolume(projectId: string): Promise<SandboxVolume> {
        const dir = path.join(VOLUMES_DIR, projectVolumeName(projectId))
        await fs.mkdir(dir, { recursive: true })
        logger.info("#LocalSandbox volume ensured", { projectId, dir })
        return dir
    }

    async deleteProjectVolume(projectId: string): Promise<void> {
        const dir = path.join(VOLUMES_DIR, projectVolumeName(projectId))
        await fs.rm(dir, { recursive: true, force: true })
        logger.info("#LocalSandbox volume deleted", { projectId, dir })
    }

    async openProjectVolumeFs(projectId: string, _runId?: string): Promise<VolumeFs> {
        const dir = path.join(VOLUMES_DIR, projectVolumeName(projectId))
        await fs.mkdir(dir, { recursive: true })
        logger.info("#LocalSandbox volume fs ready", { projectId, dir })
        return new LocalVolumeFs(dir)
    }
}

/** VolumeFs backed by a directory on the persistent local disk. No sandbox or sync needed. */
class LocalVolumeFs implements VolumeFs {
    constructor(private readonly root: string) {}

    private abs(relPath: string): string {
        const resolved = path.resolve(this.root, relPath.replace(/^\/+/, ""))
        if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
            throw new Error("Path escapes volume root")
        }
        return resolved
    }

    async list(dirPath: string): Promise<VolumeDirEntry[]> {
        const entries = await fs.readdir(this.abs(dirPath), { withFileTypes: true })
        const out: VolumeDirEntry[] = []
        for (const entry of entries) {
            const isDirectory = entry.isDirectory()
            let sizeBytes = 0
            try {
                sizeBytes = (await fs.stat(path.join(this.abs(dirPath), entry.name))).size
            } catch {
                sizeBytes = 0
            }
            out.push({ name: entry.name, isDirectory, sizeBytes })
        }
        return out
    }

    async read(filePath: string): Promise<string | null> {
        try {
            return await fs.readFile(this.abs(filePath), "utf8")
        } catch {
            return null
        }
    }

    async write(filePath: string, content: string): Promise<void> {
        const abs = this.abs(filePath)
        await fs.mkdir(path.dirname(abs), { recursive: true })
        await fs.writeFile(abs, content, "utf8")
    }

    async stat(p: string): Promise<{ isDirectory: boolean; sizeBytes: number } | null> {
        try {
            const s = await fs.stat(this.abs(p))
            return { isDirectory: s.isDirectory(), sizeBytes: s.size }
        } catch {
            return null
        }
    }

    async remove(p: string): Promise<void> {
        await fs.rm(this.abs(p), { recursive: true, force: true })
    }

    async rename(fromPath: string, toPath: string): Promise<void> {
        const dest = this.abs(toPath)
        await fs.mkdir(path.dirname(dest), { recursive: true })
        await fs.rename(this.abs(fromPath), dest)
    }

    async mkdirp(dirPath: string): Promise<void> {
        await fs.mkdir(this.abs(dirPath), { recursive: true })
    }

    async sync(): Promise<void> {}

    async dispose(): Promise<void> {}
}
