import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { transformJobSource } from "./jobMacro.js"

export type PrepareJobSourcesParams = {
    readonly cwd: string
    readonly entryFile: string
}

/** Copies and macro-transforms project sources for direct loading through tsx. */
export function prepareJobSources({ cwd, entryFile }: PrepareJobSourcesParams): string {
    const sourceDirectory = path.join(cwd, "src")
    const runtimeDirectory = path.join(cwd, ".terse", "runtime")
    const preparedSourceDirectory = path.join(runtimeDirectory, "src")

    fs.rmSync(runtimeDirectory, { recursive: true, force: true })
    fs.mkdirSync(runtimeDirectory, { recursive: true })
    fs.cpSync(sourceDirectory, preparedSourceDirectory, { recursive: true })

    const ts = loadTypescript(cwd)
    for (const file of findSourceFiles(preparedSourceDirectory)) {
        const source = fs.readFileSync(file, "utf8")
        const transformed = transformJobSource(ts, source, path.relative(cwd, file))
        if (transformed.code !== source) fs.writeFileSync(file, transformed.code)
    }

    return path.join(runtimeDirectory, entryFile)
}

function findSourceFiles(directory: string): string[] {
    const files: string[] = []
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name)
        if (entry.isDirectory()) files.push(...findSourceFiles(file))
        else if (/\.(?:ts|tsx|mts|cts)$/.test(entry.name)) files.push(file)
    }
    return files
}

function loadTypescript(cwd: string): typeof import("typescript") {
    try {
        return createRequire(path.join(cwd, "package.json"))("typescript")
    } catch {
        try {
            return createRequire(import.meta.url)("typescript")
        } catch {
            throw new Error("Durable execution needs TypeScript in your project. Run: npm install --save-dev typescript")
        }
    }
}
