import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

import { resolveVolumeRelativePath } from "./volumePaths"
import type { AgentVolumeStore, VolumeFileEntry } from "./types"

const SANDBOX_ROOT = "/data/sandbox"
export const LOCAL_VOLUMES_DIR = path.join(SANDBOX_ROOT, "volumes")

export class LocalVolumeStore implements AgentVolumeStore {
    private volumeRoot(volumeName: string): string {
        return path.join(LOCAL_VOLUMES_DIR, volumeName)
    }

    private resolveAbsolute(volumeName: string, inputPath: string): string {
        const relative = resolveVolumeRelativePath(inputPath)
        const root = this.volumeRoot(volumeName)
        const absolute = path.resolve(root, relative)
        const normalizedRoot = path.resolve(root)
        if (absolute !== normalizedRoot && !absolute.startsWith(`${normalizedRoot}${path.sep}`)) {
            throw new Error("Path traversal is not allowed.")
        }
        return absolute
    }

    async read(volumeName: string, relativePath: string): Promise<string> {
        const absolute = this.resolveAbsolute(volumeName, relativePath)
        return fs.readFile(absolute, "utf8")
    }

    async write(volumeName: string, relativePath: string, content: string): Promise<void> {
        const absolute = this.resolveAbsolute(volumeName, relativePath)
        await fs.mkdir(path.dirname(absolute), { recursive: true })
        await fs.writeFile(absolute, content, "utf8")
    }

    async list(volumeName: string, relativePath: string): Promise<VolumeFileEntry[]> {
        const absolute = relativePath === "" ? this.volumeRoot(volumeName) : this.resolveAbsolute(volumeName, relativePath)
        if (!existsSync(absolute)) {
            if (relativePath === "") {
                return []
            }
            throw new Error(`The path ${relativePath} does not exist. Please provide a valid path.`)
        }

        const stat = await fs.stat(absolute)
        if (!stat.isDirectory()) {
            throw new Error(`The path ${relativePath} is not a directory.`)
        }

        const entries = await fs.readdir(absolute, { withFileTypes: true })
        const results: VolumeFileEntry[] = []

        for (const entry of entries) {
            if (entry.name.startsWith(".") || entry.name === "node_modules") continue
            const entryPath = path.join(absolute, entry.name)
            const entryStat = await fs.stat(entryPath)
            const rel = [relativePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, ""), entry.name].filter(Boolean).join("/")
            results.push({
                path: rel,
                isDirectory: entryStat.isDirectory(),
                sizeBytes: entryStat.isDirectory() ? 0 : entryStat.size
            })
        }

        return results.sort((a, b) => a.path.localeCompare(b.path))
    }

    async exists(volumeName: string, relativePath: string): Promise<boolean> {
        if (relativePath === "") {
            return existsSync(this.volumeRoot(volumeName))
        }
        const absolute = this.resolveAbsolute(volumeName, relativePath)
        return existsSync(absolute)
    }

    async stat(volumeName: string, relativePath: string): Promise<VolumeFileEntry> {
        const absolute = this.resolveAbsolute(volumeName, relativePath)
        if (!existsSync(absolute)) {
            throw new Error(`The path ${relativePath} does not exist. Please provide a valid path.`)
        }
        const entryStat = await fs.stat(absolute)
        return {
            path: relativePath,
            isDirectory: entryStat.isDirectory(),
            sizeBytes: entryStat.isDirectory() ? 0 : entryStat.size
        }
    }

    async deletePath(volumeName: string, relativePath: string): Promise<void> {
        const absolute = this.resolveAbsolute(volumeName, relativePath)
        await fs.rm(absolute, { recursive: true, force: true })
    }

    async rename(volumeName: string, fromPath: string, toPath: string): Promise<void> {
        const fromAbsolute = this.resolveAbsolute(volumeName, fromPath)
        const toAbsolute = this.resolveAbsolute(volumeName, toPath)
        if (!existsSync(fromAbsolute)) {
            throw new Error(`Error: The path ${fromPath} does not exist`)
        }
        if (existsSync(toAbsolute)) {
            throw new Error(`Error: The destination ${toPath} already exists`)
        }
        await fs.mkdir(path.dirname(toAbsolute), { recursive: true })
        await fs.rename(fromAbsolute, toAbsolute)
    }
}
