import chalk from "chalk"

export class CliError extends Error {
    readonly code: string
    readonly opts: CliErrorOpts

    constructor(code: string, message: string, opts: CliErrorOpts = {}) {
        super(message)
        this.name = "CliError"
        this.code = code
        this.opts = opts
    }

    get exitCode(): ErrorCode {
        return this.opts.exitCode ?? (this.opts.actionRequired ? ErrorCode.BAD_ARGUMENTS : ErrorCode.GENERIC_ERROR)
    }
}

type CliErrorOpts = {
    exitCode?: ErrorCode
    actionRequired?: boolean
    url?: string
    detail?: string
}

export enum ErrorCode {
    GENERIC_ERROR = 1,
    BAD_ARGUMENTS = 2
}

export function isCliError(err: unknown): err is CliError {
    return err instanceof CliError || (typeof err === "object" && err !== null && (err as { name?: string }).name === "CliError")
}

function formatCliErrorText(err: CliError): string {
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

function formatCliErrorJson(err: CliError): string {
    const error: {
        code: string
        message: string
        actionRequired: boolean
        url?: string
        detail?: string
    } = {
        code: err.code,
        message: err.message,
        actionRequired: Boolean(err.opts.actionRequired)
    }

    if (err.opts.url) {
        error.url = err.opts.url
    }

    if (err.opts.detail) {
        error.detail = err.opts.detail
    }

    return JSON.stringify({ error }) + "\n"
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
