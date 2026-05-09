import fs from "node:fs"
import path from "node:path"

import { CliError } from "../cliError.js"

import type { LanguageProvider } from "./LanguageProvider.js"
import { typeScriptProvider } from "./typescript/TypeScriptProvider.js"

const ALL_PROVIDERS: LanguageProvider[] = [typeScriptProvider]
const PROVIDERS: LanguageProvider[] = ALL_PROVIDERS

const LANGUAGE_ALIASES: Record<string, LanguageProvider["language"]> = {
    ts: "typescript",
    typescript: "typescript"
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
        throw new CliError("multiple_project_setups", "Multiple Terse project setups detected in the current directory.")
    }

    throw new CliError("unsupported_project", "Could not detect a supported Terse project in the current directory.", {
        detail: "Expected TypeScript project markers: package.json, src/index.ts"
    })
}

function resolveProviderByLanguage(language: string): LanguageProvider {
    const normalized = LANGUAGE_ALIASES[language.toLowerCase()]
    if (!normalized) {
        throw new CliError("unsupported_init_language", `Unsupported init target "${language}". Use ts or typescript.`)
    }

    const provider = PROVIDERS.find(candidate => candidate.language === normalized)
    if (!provider) {
        throw new CliError("provider_not_registered", `No provider registered for "${normalized}".`)
    }

    return provider
}

function matchesProjectMarkers(provider: LanguageProvider, cwd: string): boolean {
    return provider.detectionMarkers.requiredFiles.every(relativePath => fs.existsSync(path.join(cwd, relativePath)))
}
