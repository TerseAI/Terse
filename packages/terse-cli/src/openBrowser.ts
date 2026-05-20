import { spawn } from "node:child_process"

function isSafeBrowserUrl(url: string): boolean {
    try {
        const parsed = new URL(url)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
    } catch {
        return false
    }
}

/** Best-effort open `url` in the system default browser. Returns whether the spawn was attempted without throwing. */
export function openUrlInBrowser(url: string): boolean {
    // Reject schemes other than http/https so a tainted URL can't reach the
    // shell-like cmd.exe handler on Windows where shell metacharacters in the
    // URL would be interpreted as command separators.
    if (!isSafeBrowserUrl(url)) return false
    try {
        if (process.platform === "darwin") {
            spawn("open", [url], { detached: true, stdio: "ignore" }).unref()
            return true
        }
        if (process.platform === "win32") {
            // rundll32 url.dll,FileProtocolHandler does not re-parse shell
            // metacharacters the way cmd.exe does — safer for unknown URLs.
            spawn("rundll32", ["url.dll,FileProtocolHandler", url], { detached: true, stdio: "ignore" }).unref()
            return true
        }
        spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref()
        return true
    } catch {
        return false
    }
}
