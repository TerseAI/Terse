import { DEFAULT_EXECUTION_REGION, type ExecutionRegion, executionRegionForTimeZone } from "terse-types/ExecutionRegions"

export function detectBrowserExecutionRegion(): ExecutionRegion {
    try {
        return executionRegionForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    } catch {
        return DEFAULT_EXECUTION_REGION
    }
}
