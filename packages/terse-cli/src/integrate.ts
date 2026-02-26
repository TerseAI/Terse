import { spawn } from "node:child_process"
import chalk from "chalk"

const FRONTEND_URL = "http://localhost:5173"
const INTEGRATIONS_URL = `${FRONTEND_URL}/app/integrations`

export async function integrate(): Promise<void> {
    console.log("")
    console.log(`  Open integrations in the Web UI: ${chalk.cyan(INTEGRATIONS_URL)}`)
    console.log("")

    const opened = openInBrowser(INTEGRATIONS_URL)
    if (opened) {
        console.log(chalk.green("  Opened in your default browser."))
        return
    }

    console.log(chalk.yellow("  Could not open browser automatically."))
    console.log(`  Open manually: ${chalk.cyan(INTEGRATIONS_URL)}`)
}

function openInBrowser(url: string): boolean {
    try {
        if (process.platform === "darwin") {
            spawn("open", [url], { detached: true, stdio: "ignore" }).unref()
            return true
        }
        if (process.platform === "win32") {
            spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref()
            return true
        }
        spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref()
        return true
    } catch {
        return false
    }
}
