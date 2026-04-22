import fs from "node:fs"
import path from "node:path"

import type { LanguageProvider } from "./LanguageProvider.js"
import { pythonProvider } from "./python/PythonProvider.js"
import { typeScriptProvider } from "./typescript/TypeScriptProvider.js"

const PROVIDERS: LanguageProvider[] = [typeScriptProvider, pythonProvider]

const LANGUAGE_ALIASES: Record<string, LanguageProvider["language"]> = {
    ts: "typescript",
    typescript: "typescript",
    py: "python",
    python: "python"
}

export function resolveProvider(opts?: { command?: string; language?: string; cwd?: string }): LanguageProvider {
    if (opts?.command === "init") {
        return resolveProviderByLanguage(opts.language ?? "ts")
    }

    const cwd = opts?.cwd ?? process.cwd()
    const matches = PROVIDERS.filter(provider => matchesProjectMarkers(provider, cwd))

    if (matches.length === 1) {
        return matches[0]
    }

    if (matches.length > 1) {
        console.error("Error: Multiple Terse project setups detected in the current directory.")
        process.exit(1)
    }

    console.error("Error: Could not detect a supported Terse project in the current directory.")
    console.error("  Expected TypeScript project markers: package.json, src/index.ts")
    process.exit(1)
}

export function resolveProviderByLanguage(language: string): LanguageProvider {
    const normalized = LANGUAGE_ALIASES[language.toLowerCase()]
    if (!normalized) {
        console.error(`Error: Unsupported init target "${language}". Use ts or typescript.`)
        process.exit(1)
    }

    const provider = PROVIDERS.find(candidate => candidate.language === normalized)
    if (!provider) {
        console.error(`Error: No provider registered for "${normalized}".`)
        process.exit(1)
    }

    return provider
}

function matchesProjectMarkers(provider: LanguageProvider, cwd: string): boolean {
    return provider.detectionMarkers.requiredFiles.every(relativePath => fs.existsSync(path.join(cwd, relativePath)))
}
