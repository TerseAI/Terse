/**
 * Utility functions for Datadog API integration.
 * Centralized helpers for working with Datadog regions and URLs.
 */

/**
 * Map region code to Datadog site configuration.
 * @param region Region code (us, eu, us3, us5, ap1)
 * @returns Datadog site domain
 */
export function getDatadogSite(region: string): string {
    const regionMap: Record<string, string> = {
        us: "datadoghq.com",
        eu: "datadoghq.eu",
        us3: "us3.datadoghq.com",
        us5: "us5.datadoghq.com",
        ap1: "ap1.datadoghq.com"
    }
    return regionMap[region.toLowerCase()] || "datadoghq.com"
}

/**
 * Get Datadog API base URL from region.
 * @param region Region code (us, eu, us3, us5, ap1)
 * @returns API base URL (e.g., https://api.datadoghq.com)
 */
export function getDatadogApiUrl(region: string): string {
    const site = getDatadogSite(region)
    if (site === "datadoghq.com") {
        return "https://api.datadoghq.com"
    }
    return `https://api.${site}`
}

/**
 * Get Datadog app (web UI) URL from region.
 * @param region Region code (us, eu, us3, us5, ap1)
 * @returns App base URL (e.g., https://app.datadoghq.com)
 */
export function getDatadogAppUrl(region: string): string {
    const site = getDatadogSite(region)
    if (site === "datadoghq.com") {
        return "https://app.datadoghq.com"
    }
    return `https://app.${site}`
}

export function parseDatadogTimeString(timeString: string): Date {
    // Reject relative time formats - this endpoint only supports ISO8601 dates
    if (timeString.startsWith("now")) {
        throw new Error(`Relative time formats like "now-15m" are not supported. Please use ISO8601 format (e.g., "2020-09-17T11:48:36+01:00")`)
    }

    // Try to parse as ISO8601 date
    const date = new Date(timeString)
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${timeString}. Expected ISO8601 format (e.g., "2020-09-17T11:48:36+01:00")`)
    }

    return date
}

/**
 * Build a deep link to Datadog Logs Explorer with query parameters.
 * @param region Region code (us, eu, us3, us5, ap1)
 * @param query Optional log search query
 * @param from Optional start time (ISO8601 or relative like "now-1h")
 * @param to Optional end time (ISO8601 or relative like "now")
 * @returns Deep link URL to Datadog Logs Explorer with filters applied
 */
export function getDatadogLogsDeepLink(region: string, query?: string | null, from?: string | null, to?: string | null): string {
    const appUrl = getDatadogAppUrl(region)
    const url = new URL(`${appUrl}/logs`)

    if (query) {
        url.searchParams.set("query", query)
    }
    if (from) {
        url.searchParams.set("from", from)
    }
    if (to) {
        url.searchParams.set("to", to)
    }

    return url.toString()
}

/**
 * Build a deep link to Datadog RUM Explorer with query parameters.
 * @param region Region code (us, eu, us3, us5, ap1)
 * @param query Optional RUM search query
 * @param from Optional start time (ISO8601 or relative like "now-15m")
 * @param to Optional end time (ISO8601 or relative like "now")
 * @returns Deep link URL to Datadog RUM Explorer with filters applied
 */
export function getDatadogRumDeepLink(region: string, query?: string | null, from?: string | null, to?: string | null): string {
    const appUrl = getDatadogAppUrl(region)
    const url = new URL(`${appUrl}/rum/explorer`)

    if (query) {
        url.searchParams.set("query", query)
    }
    if (from) {
        url.searchParams.set("from", from)
    }
    if (to) {
        url.searchParams.set("to", to)
    }

    return url.toString()
}
