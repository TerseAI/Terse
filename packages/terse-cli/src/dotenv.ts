import dotenv from "dotenv"
import fs from "node:fs"
import path from "node:path"

let loadedFor: string | null = null

export function ensureDotenvLoaded(cwd: string = process.cwd()): void {
    if (loadedFor === cwd) return
    const envPath = path.resolve(cwd, ".env")
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, quiet: true })
    }
    loadedFor = cwd
}
