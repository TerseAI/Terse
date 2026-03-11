import { useFeatureFlagEnabled } from "posthog-js/react"

/**
 * Feature flag keys — must match PostHog dashboard.
 * Keep in sync with backend FeatureFlag enum in utility/featureFlags.ts.
 */
export const FeatureFlags = {
    AGENT_IMPROVEMENTS_TAB: "Agent-improvements-tab"
} as const

/**
 * Hook to check if a feature flag is enabled
 * @param flagKey - The key of the feature flag in PostHog
 * @returns boolean indicating if the feature flag is enabled
 */
export function useFeatureFlag(flagKey: string): boolean {
    return useFeatureFlagEnabled(flagKey) ?? false
}
