import { spawn } from "node:child_process"

/** Best-effort open `url` in the system default browser. Returns whether the spawn was attempted without throwing. */
export function openUrlInBrowser(url: string): boolean {
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
