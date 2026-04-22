import chalk from "chalk"

import { DOCS_URL } from "../config.js"
import { openUrlInBrowser } from "../openBrowser.js"

export function openDocs(): void {
    console.log(`\n  ${chalk.bold("Terse documentation")}\n`)
    console.log(`  ${chalk.cyan(DOCS_URL)}\n`)
    openUrlInBrowser(DOCS_URL)
}
