import chalk from "chalk"

import logger from "./logger"

type ChalkColor = (s: string) => string

export function logProviderBanner(variant: "local" | "remote", title: string, subtitle: string): void {
    const color: ChalkColor = variant === "local" ? chalk.yellow : chalk.cyan
    const width = Math.max(title.length, subtitle.length) + 4
    const bar = "═".repeat(width)
    const pad = (s: string) => `║ ${s.padEnd(width - 2)} ║`
    logger.info(["", color(`╔${bar}╗`), color(pad(title)), color(pad(subtitle)), color(`╚${bar}╝`), ""].join("\n"))
}
