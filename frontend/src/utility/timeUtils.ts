import { DateTime } from "luxon"

export function getTrend(change: string): "up" | "down" {
    return change.startsWith("+") || (!change.startsWith("-") && change !== "0%") ? "up" : "down"
}

export function formatNumber(num: number): string {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
    return num.toLocaleString()
}

export function formatRelativeTime(date: Date | string): string {
    const dt = typeof date === "string" ? DateTime.fromISO(date) : DateTime.fromJSDate(date)
    return dt.toRelative() ?? ""
}

// Helper function to format timestamp with relative time (e.g., "2m ago", "3h ago")
export function formatTimestamp(timestamp?: string): string {
    if (!timestamp) return ""
    try {
        const dt = DateTime.fromISO(timestamp)
        if (!dt.isValid) return ""
        const diffMs = DateTime.now().diff(dt).milliseconds
        const seconds = Math.floor(diffMs / 1000)
        const minutes = Math.floor(diffMs / (1000 * 60))
        const hours = Math.floor(diffMs / (1000 * 60 * 60))
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (seconds < 60) return `${seconds}s ago`
        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        if (days < 7) return `${days}d ago`

        return dt.toFormat("MMM d, h:mm a")
    } catch {
        return ""
    }
}

// Helper function to get full timestamp
export function getFullTimestamp(timestamp?: string): string {
    if (!timestamp) return ""
    try {
        const dt = DateTime.fromISO(timestamp)
        if (!dt.isValid) return ""
        return dt.toFormat("MMM d, yyyy, h:mm:ss a")
    } catch {
        return ""
    }
}
