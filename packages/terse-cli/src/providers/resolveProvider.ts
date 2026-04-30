import fs from "node:fs"
import path from "node:path"

import { CliError } from "../cliError.js"

import type { LanguageProvider } from "./LanguageProvider.js"
import { pythonProvider } from "./python/PythonProvider.js"
import { typeScriptProvider } from "./typescript/TypeScriptProvider.js"

// Temporarily disable the Python SDK end-to-end. The provider remains imported
// and exported so all supporting code (templates, codegen, executor) compiles,
// but it is excluded from detection/selection so users cannot use it.
const PYTHON_SDK_ENABLED = false

const ALL_PROVIDERS: LanguageProvider[] = [typeScriptProvider, pythonProvider]
const PROVIDERS: LanguageProvider[] = ALL_PROVIDERS.filter(provider => PYTHON_SDK_ENABLED || provider.language !== "python")

const LANGUAGE_ALIASES: Record<string, LanguageProvider["language"]> = {
    ts: "typescript",
    typescript: "typescript",
    py: "python",
    python: "python"
}

const PYTHON_DISABLED_MESSAGE = "Python SDK support is currently disabled. Use TypeScript (`terse init <name>`) instead."

export function resolveProvider(opts?: { command?: string; language?: string; cwd?: string }): LanguageProvider {
    if (opts?.command === "init") {
        return resolveProviderByLanguage(opts.language ?? "ts")
    }

    const cwd = opts?.cwd ?? process.cwd()

    if (!PYTHON_SDK_ENABLED && matchesProjectMarkers(pythonProvider, cwd)) {
        throw new CliError("python_sdk_disabled", PYTHON_DISABLED_MESSAGE, {
            detail: "Detected a Python project (pyproject.toml) in the current directory, but the Python SDK is not currently available."
        })
    }

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

export function resolveProviderByLanguage(language: string): LanguageProvider {
    const normalized = LANGUAGE_ALIASES[language.toLowerCase()]
    if (!normalized) {
        throw new CliError("unsupported_init_language", `Unsupported init target "${language}". Use ts or typescript.`)
    }

    if (!PYTHON_SDK_ENABLED && normalized === "python") {
        throw new CliError("python_sdk_disabled", PYTHON_DISABLED_MESSAGE)
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
