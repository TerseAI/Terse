import { CliError } from "./cliError.js"

export type NonInteractiveOpts = {
    yes?: boolean
    nonInteractive?: boolean
}

/**
 * True when the CLI should avoid any interactive prompt. Honors the explicit
 * flag first, falls back to TTY detection so subprocess / piped invocations
 * behave non-interactively without the caller needing to pass `--yes`.
 */
export function isNonInteractive(opts?: NonInteractiveOpts): boolean {
    if (opts?.yes || opts?.nonInteractive) return true
    return !process.stdin.isTTY || !process.stdout.isTTY
}

export function parseKeyValueFlags(values: string[] | undefined): Record<string, string> {
    const out: Record<string, string> = {}
    for (const raw of values ?? []) {
        const eq = raw.indexOf("=")
        if (eq <= 0) {
            throw new CliError("invalid_field", `Invalid --field value "${raw}"`, { detail: "Expected key=value" })
        }
        out[raw.slice(0, eq)] = raw.slice(eq + 1)
    }
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
