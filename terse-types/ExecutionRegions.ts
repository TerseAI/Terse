import * as z from "zod"

export const EXECUTION_REGIONS = ["us-west", "us-central", "us-east"] as const
export const executionRegionSchema = z.enum(EXECUTION_REGIONS)
export type ExecutionRegion = z.infer<typeof executionRegionSchema>

export const DEFAULT_EXECUTION_REGION: ExecutionRegion = "us-east"

export const DURABLE_OBJECT_STORAGE_REGIONS = {
    "us-west": "north-america-west",
    "us-central": "north-america-central",
    "us-east": "north-america-east"
} as const satisfies Record<ExecutionRegion, string>
export type DurableObjectStorageRegion = (typeof DURABLE_OBJECT_STORAGE_REGIONS)[ExecutionRegion]

export const EXECUTION_REGION_LABELS: Record<ExecutionRegion, string> = {
    "us-west": "US West",
    "us-central": "US Central",
    "us-east": "US East"
}

const WESTERN_US_TIMEZONES = new Set([
    "America/Adak",
    "America/Anchorage",
    "America/Boise",
    "America/Denver",
    "America/Juneau",
    "America/Los_Angeles",
    "America/Metlakatla",
    "America/Nome",
    "America/Phoenix",
    "America/Shiprock",
    "America/Sitka",
    "America/Yakutat",
    "Pacific/Honolulu",
    // Legacy IANA aliases can still be returned by older browsers.
    "US/Alaska",
    "US/Aleutian",
    "US/Arizona",
    "US/Hawaii",
    "US/Mountain",
    "US/Pacific",
    "MST7MDT",
    "Navajo",
    "PST8PDT"
])

const CENTRAL_US_TIMEZONES = new Set([
    "America/Chicago",
    "America/Indiana/Knox",
    "America/Indiana/Tell_City",
    "America/Menominee",
    "America/North_Dakota/Beulah",
    "America/North_Dakota/Center",
    "America/North_Dakota/New_Salem",
    "CST6CDT",
    "US/Central",
    "US/Indiana-Starke"
])

export function executionRegionForTimeZone(timeZone: string | null | undefined): ExecutionRegion {
    if (timeZone && WESTERN_US_TIMEZONES.has(timeZone)) return "us-west"
    if (timeZone && CENTRAL_US_TIMEZONES.has(timeZone)) return "us-central"
    return DEFAULT_EXECUTION_REGION
}

export function executionRegionLabel(region: ExecutionRegion): string {
    return EXECUTION_REGION_LABELS[region]
}

export function durableObjectStorageRegion(region: ExecutionRegion): DurableObjectStorageRegion {
    return DURABLE_OBJECT_STORAGE_REGIONS[region]
}
