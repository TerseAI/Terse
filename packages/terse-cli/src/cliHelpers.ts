import { InvalidArgumentError } from "commander"
import { z } from "zod"

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

export async function readRawStdin(): Promise<string> {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }
    return Buffer.concat(chunks).toString("utf-8").trim()
}

/**
 * Read a JSON object from stdin and return it as a string map. Used by
 * `terse integrate connect --fields-stdin` so passwords and tokens never touch
 * argv.
 */
export async function readFieldsFromStdin(): Promise<Record<string, string>> {
    const raw = await readRawStdin()
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

// CLI flags arrive as strings. Coerce each raw value to the type the schema expects
// before parsing, so users can write `--field isBotUser=true` instead of being forced
// into a typed input format. Lives in CLI (not terse-types) because string-coercion
// is a wire-format concern of how `--field`/stdin inputs are encoded.
function coerceRawInputForField(raw: string, fieldSchema: unknown): unknown {
    if (fieldSchema instanceof z.ZodBoolean) {
        const lowered = raw.trim().toLowerCase()
        if (lowered === "true" || lowered === "1") return true
        if (lowered === "false" || lowered === "0") return false
        return raw
    }
    if (fieldSchema instanceof z.ZodNumber) {
        const n = Number(raw)
        return Number.isFinite(n) ? n : raw
    }
    return raw
}

/**
 * Coerce raw `--field`/stdin string values into the types declared by a zod object
 * schema, then validate with the schema. Returns the typed result on success or
 * throws a `CliError` with structured detail describing each invalid field.
 */
export function coerceAndValidateForSchema<S extends z.ZodObject<z.ZodRawShape>>(raw: Record<string, string>, schema: S, errorContext: { integrationType: string }): z.infer<S> {
    const shape = schema.shape
    const coerced: Record<string, unknown> = {}

    const unknown: string[] = []
    for (const [key, value] of Object.entries(raw)) {
        const fieldSchema = shape[key]
        if (!fieldSchema) {
            unknown.push(key)
            continue
        }
        coerced[key] = coerceRawInputForField(value, fieldSchema)
    }
    if (unknown.length > 0) {
        const known = Object.keys(shape)
        throw new CliError("unknown_fields", `Unknown field(s): ${unknown.join(", ")}`, {
            detail: `Valid fields: ${known.length > 0 ? known.join(", ") : "(none)"}`
        })
    }

    const result = schema.safeParse(coerced)
    if (!result.success) {
        const issues = result.error.issues.map(issue => ({
            field: issue.path.join(".") || "<root>",
            message: issue.message
        }))
        const summary = issues.map(i => `${i.field}: ${i.message}`).join("; ")
        throw new CliError("invalid_fields", `Invalid field(s) for ${errorContext.integrationType}: ${summary}`, {
            detail: `Run \`terse integrate describe ${errorContext.integrationType} --json\` to see the full field schema.`
        })
    }
    return result.data
}
