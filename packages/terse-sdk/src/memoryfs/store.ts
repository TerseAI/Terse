import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

import { resolveRelativePath } from "./paths.js"

export interface FsEntry {
    path: string
    isDirectory: boolean
    sizeBytes: number
}

/**
 * Node-fs store rooted at a single co-located directory. This is the local-disk
 * implementation used in-process by both reach-back paths: the `terse __fs-exec` CLI
 * (Path A) and the SDK's executeTool interception (Path B). An empty relativePath
 * refers to the root itself.
 */
export class LocalFsStore {
    constructor(private readonly root: string) {}

    private resolveAbsolute(inputPath: string): string {
        const relative = resolveRelativePath(inputPath)
        const absolute = path.resolve(this.root, relative)
        const normalizedRoot = path.resolve(this.root)
        if (absolute !== normalizedRoot && !absolute.startsWith(`${normalizedRoot}${path.sep}`)) {
            throw new Error("Path traversal is not allowed.")
        }
        return absolute
    }

    async read(relativePath: string): Promise<string> {
        return fs.readFile(this.resolveAbsolute(relativePath), "utf8")
    }

    async write(relativePath: string, content: string): Promise<void> {
        const absolute = this.resolveAbsolute(relativePath)
        await fs.mkdir(path.dirname(absolute), { recursive: true })
        await fs.writeFile(absolute, content, "utf8")
    }

    async list(relativePath: string): Promise<FsEntry[]> {
        const absolute = relativePath === "" ? path.resolve(this.root) : this.resolveAbsolute(relativePath)
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
        const results: FsEntry[] = []

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

    async exists(relativePath: string): Promise<boolean> {
        if (relativePath === "") {
            return existsSync(path.resolve(this.root))
        }
        return existsSync(this.resolveAbsolute(relativePath))
    }

    async stat(relativePath: string): Promise<FsEntry> {
        const absolute = this.resolveAbsolute(relativePath)
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

    async deletePath(relativePath: string): Promise<void> {
        await fs.rm(this.resolveAbsolute(relativePath), { recursive: true, force: true })
    }

    async rename(fromPath: string, toPath: string): Promise<void> {
        const fromAbsolute = this.resolveAbsolute(fromPath)
        const toAbsolute = this.resolveAbsolute(toPath)
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
