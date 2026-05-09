import fs from "node:fs"
import path from "node:path"

export function loadDotenv(cwd: string): NodeJS.ProcessEnv {
    const env = { ...process.env }
    const envPath = path.join(cwd, ".env")
    if (!fs.existsSync(envPath)) return env

    const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/)
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue

        const separatorIndex = trimmed.indexOf("=")
        if (separatorIndex === -1) continue

        const key = trimmed.slice(0, separatorIndex).trim()
        let value = trimmed.slice(separatorIndex + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }

        env[key] = value
    }

    return env
}
