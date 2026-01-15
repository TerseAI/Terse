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
        'us': 'datadoghq.com',
        'eu': 'datadoghq.eu',
        'us3': 'us3.datadoghq.com',
        'us5': 'us5.datadoghq.com',
        'ap1': 'ap1.datadoghq.com',
    };
    return regionMap[region.toLowerCase()] || 'datadoghq.com';
}

/**
 * Get Datadog API base URL from region.
 * @param region Region code (us, eu, us3, us5, ap1)
 * @returns API base URL (e.g., https://api.datadoghq.com)
 */
export function getDatadogApiUrl(region: string): string {
    const site = getDatadogSite(region);
    if (site === 'datadoghq.com') {
        return 'https://api.datadoghq.com';
    }
    return `https://api.${site}`;
}

/**
 * Get Datadog app (web UI) URL from region.
 * @param region Region code (us, eu, us3, us5, ap1)
 * @returns App base URL (e.g., https://app.datadoghq.com)
 */
export function getDatadogAppUrl(region: string): string {
    const site = getDatadogSite(region);
    if (site === 'datadoghq.com') {
        return 'https://app.datadoghq.com';
    }
    return `https://app.${site}`;
}
