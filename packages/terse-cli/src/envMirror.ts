import chalk from "chalk"
import dotenv from "dotenv"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { CliError } from "./cliError.js"

const ENV_FILENAME = ".env"

export function mirrorSecretToLocalEnv(name: string, value: string, cwd: string = process.cwd()): void {
    let outcome: EnvMirrorOutcome
    try {
        outcome = upsertEnvEntry(cwd, name, value)
    } catch (error) {
        warnMirrorFailed(`write ${name} to`, error)
        return
    }
    reportOutcome(name, outcome)
    if (outcome !== "unchanged") warnIfNotGitignored(cwd)
}

export function removeSecretFromLocalEnv(name: string, cwd: string = process.cwd()): void {
    let removed: boolean
    try {
        removed = removeEnvEntry(cwd, name)
    } catch (error) {
        warnMirrorFailed(`remove ${name} from`, error)
        return
    }
    if (removed) {
        process.stdout.write(`Removed ${name} from ${ENV_FILENAME}.\n`)
    }
}

function upsertEnvEntry(cwd: string, name: string, value: string): EnvMirrorOutcome {
    const filePath = path.join(cwd, ENV_FILENAME)
    const entry = `${name}=${serializeEnvValue(name, value)}`

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `${entry}\n`, { mode: 0o600 })
        return "created"
    }

    const raw = fs.readFileSync(filePath, "utf8")
    if (dotenv.parse(raw)[name] === value) return "unchanged"

    const eol = raw.includes("\r\n") ? "\r\n" : "\n"
    const lines = raw.split(/\r?\n/)
    const [firstMatch, ...duplicateMatches] = lines.flatMap((line, index) => (envLineName(line) === name ? [index] : []))

    if (firstMatch === undefined) {
        const body = raw.length === 0 || raw.endsWith("\n") ? raw : `${raw}${eol}`
        fs.writeFileSync(filePath, `${body}${entry}${eol}`)
        return "added"
    }

    const updatedLines = lines.map((line, index) => (index === firstMatch ? entry : line)).filter((_, index) => !duplicateMatches.includes(index))
    fs.writeFileSync(filePath, updatedLines.join(eol))
    return "updated"
}

function removeEnvEntry(cwd: string, name: string): boolean {
    const filePath = path.join(cwd, ENV_FILENAME)
    if (!fs.existsSync(filePath)) return false

    const raw = fs.readFileSync(filePath, "utf8")
    const eol = raw.includes("\r\n") ? "\r\n" : "\n"
    const lines = raw.split(/\r?\n/)
    const remaining = lines.filter(line => envLineName(line) !== name)
    if (remaining.length === lines.length) return false

    fs.writeFileSync(filePath, remaining.join(eol))
    return true
}

function serializeEnvValue(name: string, value: string): string {
    const candidates = [value, `'${value}'`, `"${value}"`, `"${value.replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`]
    const usable = candidates.find(candidate => !/[\r\n]/.test(candidate) && dotenv.parse(`${name}=${candidate}`)[name] === value)
    if (usable === undefined) {
        throw new CliError("env_value_unwritable", `Could not represent the value of ${name} in ${ENV_FILENAME}.`)
    }
    return usable
}

function envLineName(line: string): string | null {
    const separatorIndex = line.indexOf("=")
    if (separatorIndex <= 0) return null
    return line.slice(0, separatorIndex).trim()
}

function reportOutcome(name: string, outcome: EnvMirrorOutcome): void {
    switch (outcome) {
        case "created":
            process.stdout.write(`Created ${ENV_FILENAME} with ${name} for local runs.\n`)
            return
        case "added":
            process.stdout.write(`Added ${name} to ${ENV_FILENAME} for local runs.\n`)
            return
        case "updated":
            process.stdout.write(`Updated ${name} in ${ENV_FILENAME} (replaced a different local value).\n`)
            return
        case "unchanged":
            return
        default:
            throw outcome satisfies never
    }
}

function warnIfNotGitignored(cwd: string): void {
    if (isEnvGitignored(cwd) === false) {
        process.stdout.write(chalk.yellow(`Warning: ${ENV_FILENAME} is not ignored by git. Add it to your .gitignore so secret values are not committed.\n`))
    }
}

function isEnvGitignored(cwd: string): boolean | null {
    try {
        execFileSync("git", ["check-ignore", "-q", ENV_FILENAME], { cwd, stdio: "ignore" })
        return true
    } catch (error) {
        return isCheckIgnoreMiss(error) ? false : null
    }
}

function isCheckIgnoreMiss(error: unknown): boolean {
    return typeof error === "object" && error !== null && "status" in error && error.status === 1
}

function warnMirrorFailed(action: string, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error)
    process.stdout.write(chalk.yellow(`Warning: could not ${action} ${ENV_FILENAME} (${detail}). Update it manually so local runs stay in sync.\n`))
}

type EnvMirrorOutcome = "created" | "added" | "updated" | "unchanged"
