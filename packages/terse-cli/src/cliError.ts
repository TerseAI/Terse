import chalk from "chalk"

export type CliErrorOpts = {
    exitCode?: 1 | 2
    actionRequired?: boolean
    url?: string
    detail?: string
}

export class CliError extends Error {
    readonly code: string
    readonly opts: CliErrorOpts

    constructor(code: string, message: string, opts: CliErrorOpts = {}) {
        super(message)
        this.name = "CliError"
        this.code = code
        this.opts = opts
    }

    get exitCode(): 1 | 2 {
        return this.opts.exitCode ?? (this.opts.actionRequired ? 2 : 1)
    }
}

export function isCliError(err: unknown): err is CliError {
    return err instanceof CliError || (typeof err === "object" && err !== null && (err as { name?: string }).name === "CliError")
}

export function formatCliErrorText(err: CliError): string {
    const lines: string[] = []
    if (err.opts.actionRequired) {
        lines.push(chalk.yellow(`ACTION REQUIRED: ${err.message}`))
    } else {
        lines.push(chalk.red(`Error: ${err.message}`))
    }
    if (err.opts.url) lines.push(chalk.cyan(`  ${err.opts.url}`))
    if (err.opts.detail) lines.push(chalk.dim(`  ${err.opts.detail}`))
    return lines.join("\n") + "\n"
}

export function formatCliErrorJson(err: CliError): string {
    return (
        JSON.stringify({
            error: {
                code: err.code,
                message: err.message,
                actionRequired: !!err.opts.actionRequired,
                ...(err.opts.url ? { url: err.opts.url } : {}),
                ...(err.opts.detail ? { detail: err.opts.detail } : {})
            }
        }) + "\n"
    )
}

/**
 * Set via index.ts when the invoked subcommand is in JSON output mode so the
 * top-level error handler can emit a structured envelope instead of prose.
 */
let jsonMode = false

export function setErrorOutputJson(enabled: boolean): void {
    jsonMode = enabled
}

export function emitCliError(err: CliError): void {
    if (jsonMode) {
        process.stdout.write(formatCliErrorJson(err))
    } else {
        process.stderr.write(formatCliErrorText(err))
    }
}
