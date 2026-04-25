import { InvalidArgumentError } from "commander"

import { CliError } from "./cliError.js"

export type NonInteractiveOpts = {
    nonInteractive?: boolean
}

/**
 * True when the CLI should avoid any interactive prompt.
 */
export function isNonInteractive(opts?: NonInteractiveOpts): boolean {
    if (opts?.nonInteractive) return true
    return !process.stdin.isTTY || !process.stdout.isTTY
}

/**
 * Supports parsing a series of key=value flags from the CLI.
 */
export function parseKeyValueFlags(values: string[] | undefined): Record<string, string> {
    const out: Record<string, string> = {}
    values?.forEach(raw => {
        const eq = raw.indexOf("=")
        if (eq <= 0) {
            throw new CliError("invalid_field", `Invalid --field value "${raw}"`, { detail: "Expected key=value" })
        }
        out[raw.slice(0, eq)] = raw.slice(eq + 1)
    })
    return out
}

/**
 * Read a JSON object from stdin and return it as a string map. Used by
 * `terse integrate connect --fields-stdin` so passwords and tokens never touch
 * argv.
 */
export async function readFieldsFromStdin(): Promise<Record<string, string>> {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }
    const raw = Buffer.concat(chunks).toString("utf-8").trim()
    if (!raw) return {}

    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch (err) {
        throw new CliError("invalid_fields_stdin", "Could not parse JSON from stdin", {
            detail: err instanceof Error ? err.message : String(err)
        })
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new CliError("invalid_fields_stdin", "Expected a JSON object on stdin", { detail: 'Example: {"password":"..."}' })
    }

    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v !== "string") {
            throw new CliError("invalid_fields_stdin", `Field "${k}" must be a string`)
        }
        out[k] = v
    }
    return out
}

export function collectKeyValue(value: string, previous: string[]): string[] {
    return [...previous, value]
}

export function parseIntFlag(value: string): number {
    const n = Number.parseInt(value, 10)
    if (!Number.isFinite(n) || n <= 0) {
        throw new InvalidArgumentError(`Expected a positive integer, got "${value}".`)
    }
    return n
}
