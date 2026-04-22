import chalk from "chalk"

import { FRONTEND_URL } from "../config.js"
import { openUrlInBrowser } from "../openBrowser.js"

export function openDashboard(): void {
    console.log(`\n  ${chalk.bold("Terse dashboard")}\n`)
    console.log(`  ${chalk.cyan(FRONTEND_URL)}\n`)
    openUrlInBrowser(FRONTEND_URL)
}
