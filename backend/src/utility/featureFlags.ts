import { PostHog } from "posthog-node"

import { settings } from "../config/settings"
import logger from "../logger"

export enum FeatureFlag {
    BIRDS_EYE_VIEW_HOMEPAGE = "Birds-eye-view-homepage"
}

export class FeatureFlagService {
    private static instance: FeatureFlagService | null = null
    private client: PostHog | null = null

    private constructor() {
        // Private constructor for singleton pattern
    }

    static getInstance(): FeatureFlagService {
        if (!FeatureFlagService.instance) {
            FeatureFlagService.instance = new FeatureFlagService()
        }
        return FeatureFlagService.instance
    }

    private initializeClient(): PostHog | null {
        if (this.client) {
            return this.client
        }

        if (!settings.posthog.apiKey) {
            logger.warn("Feature flag service not configured. Feature flags will not work.")
            return null
        }

        try {
            this.client = new PostHog(settings.posthog.apiKey, {
                host: settings.posthog.host
            })

            logger.info("Feature flag service initialized", { host: settings.posthog.host })
            return this.client
        } catch (error) {
            logger.error("Failed to initialize feature flag service", { error })
            return null
        }
    }

    async isFeatureFlagEnabled(flagKey: string, distinctId: string, properties?: Record<string, any>): Promise<boolean> {
        const client = this.initializeClient()

        if (!client) {
            // If feature flag service is not configured, default to false for safety
            return false
        }

        try {
            const isEnabled = await client.isFeatureEnabled(flagKey, distinctId, properties)
            return isEnabled ?? false
        } catch (error) {
            logger.error("Error checking feature flag", {
                error,
                flagKey,
                distinctId
            })
            // Default to false on error for safety
            return false
        }
    }

    async shutdown(): Promise<void> {
        if (this.client) {
            try {
                await this.client.shutdown()
                this.client = null
                logger.info("Feature flag service shut down")
            } catch (error) {
                logger.error("Error shutting down feature flag service", { error })
            }
        }
    }
}
