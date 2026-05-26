import { useFeatureFlagEnabled } from "posthog-js/react"

/**
 * Feature flag keys — must match PostHog dashboard.
 * Keep in sync with backend FeatureFlag enum in utility/featureFlags.ts.
 */
export const FeatureFlags = {
    AGENT_IMPROVEMENTS_TAB: "Agent-improvements-tab",
    SDK_INTERFACE: "SDK-Interface"
} as const

/**
 * Hook to check if a feature flag is enabled.
 * Waits for flags to be loaded via posthog.onFeatureFlags before evaluating.
 */
export function useFeatureFlag(flagKey: string): boolean {
    return useFeatureFlagEnabled(flagKey) ?? false
}
