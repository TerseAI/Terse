import chalk from "chalk"
import type { IncomingMessage, ServerResponse } from "http"
import morgan, { type TokenIndexer } from "morgan"

import { settings } from "../config/settings"
import logger from "../logger"

export const httpAccessLog = settings.nodeEnv === "development" ? devAccessLog() : prodAccessLog()

/** Morgan uses "-" when a token has no value (e.g. missing header or aborted request). */
function parseTokenNumber(value: string | undefined | null): number | undefined {
    if (value == null || value === "") return undefined

    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
}

function parseTokenString(value: string | undefined | null): string | undefined {
    if (value == null || value === "") return undefined

    return value
}

function buildAccessLogEntry(tokens: TokenIndexer, req: IncomingMessage, res: ServerResponse): Record<string, unknown> {
    return {
        method: parseTokenString(tokens.method(req, res)),
        url: parseTokenString(tokens.url(req, res)),
        status: parseTokenNumber(tokens.status(req, res)),
        responseTimeMs: parseTokenNumber(tokens["response-time"](req, res)),
        requestLength: parseTokenNumber(tokens.req(req, res, "content-length")),
        responseLength: parseTokenNumber(tokens.res(req, res, "content-length")),
        ip: parseTokenString(tokens["remote-addr"](req, res)),
        userAgent: parseTokenString(tokens["user-agent"](req, res)),
        referrer: parseTokenString(tokens.referrer(req, res))
    }
}

function devAccessLog() {
    return morgan((tokens, req, res) => {
        const time = new Date().toLocaleTimeString("en-US", { hour12: false })
        const method = (tokens.method(req, res) || "").padEnd(6)
        const statusRaw = tokens.status(req, res)
        const status = parseTokenNumber(statusRaw)
        const statusLabel = statusRaw === "-" || statusRaw === "" ? "-" : String(status ?? "-").padEnd(3)
        const durationMs = Math.round(parseTokenNumber(tokens["response-time"](req, res)) ?? 0)
        const url = tokens.url(req, res) || ""
        const statusForColor = status ?? 0
        return `${chalk.dim(time)} ${methodColor(method)(method)} ${statusColor(statusForColor)(statusLabel)}  ${durationColor(durationMs)(`${durationMs}ms`.padStart(6))} ${chalk.white(url)}`
    })
}

function prodAccessLog() {
    return morgan((tokens, req, res) => {
        const entry = buildAccessLogEntry(tokens, req, res)
        const status = typeof entry.status === "number" ? entry.status : 0
        if (status >= 500) logger.error("http_request", entry)
        else if (status >= 400) logger.warn("http_request", entry)
        else logger.info("http_request", entry)
        return null
    })
}

function methodColor(method: string): (text: string) => string {
    const verb = method.trim()
    switch (verb) {
        case "GET":
            return chalk.cyan
        case "POST":
            return chalk.green
        case "PUT":
        case "PATCH":
            return chalk.yellow
        case "DELETE":
            return chalk.red
        default:
            return chalk.white
    }
}

function statusColor(status: number): (text: string) => string {
    if (status >= 500) return chalk.red
    if (status >= 400) return chalk.yellow
    if (status >= 300) return chalk.cyan
    if (status >= 200) return chalk.green
    return chalk.dim
}

function durationColor(ms: number): (text: string) => string {
    if (ms >= 1000) return chalk.red
    if (ms >= 250) return chalk.yellow
    return chalk.dim
}
