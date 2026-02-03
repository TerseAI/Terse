import { useFeatureFlagEnabled } from "posthog-js/react"

/**
 * Hook to check if a feature flag is enabled
 * @param flagKey - The key of the feature flag in PostHog
 * @returns boolean indicating if the feature flag is enabled
 */
export function useFeatureFlag(flagKey: string): boolean {
    return useFeatureFlagEnabled(flagKey) ?? false
}
