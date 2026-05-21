import { PostHog } from "posthog-node"

import { settings } from "../settings"
import logger from "../common/logger"

enum AnalyticsEvent {
    NEW_USER_ADDED = "new_user_added",
    INTEGRATION_ADDED = "integration_added"
}

interface NewUserAddedProperties {
    email: string
    displayName: string
    authMethod?: "github" | "google"
    githubUsername?: string | null
}

interface IntegrationAddedProperties {
    integrationType: string
    integrationName?: string
}

type EventProperties = {
    [AnalyticsEvent.NEW_USER_ADDED]: NewUserAddedProperties
    [AnalyticsEvent.INTEGRATION_ADDED]: IntegrationAddedProperties
}

class AnalyticsService {
    private static instance: AnalyticsService | null = null
    private client: PostHog | null = null

    private constructor() {}

    static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) AnalyticsService.instance = new AnalyticsService()
        return AnalyticsService.instance
    }

    private initializeClient(): PostHog | null {
        if (this.client) return this.client

        if (!settings.posthog.apiKey) {
            logger.warn("Analytics service not configured. Events will not be tracked.")
            return null
        }

        try {
            this.client = new PostHog(settings.posthog.apiKey, { host: settings.posthog.host })
            logger.info("Analytics service initialized", { host: settings.posthog.host })
            return this.client
        } catch (error) {
            logger.error("Failed to initialize analytics service", { error })
            return null
        }
    }

    public getPostHogClient(): PostHog | null {
        return this.initializeClient()
    }

    capture<E extends AnalyticsEvent>(userId: string, event: E, properties: EventProperties[E]): void {
        const client = this.initializeClient()
        if (!client) {
            logger.debug("Analytics event skipped (client not initialized)", { event, userId })
            return
        }
        try {
            client.capture({
                distinctId: userId,
                event,
                properties: { ...properties, timestamp: new Date().toISOString() }
            })
            logger.debug("Analytics event captured", { event, userId, properties })
        } catch (error) {
            logger.error("Failed to capture analytics event", { error, event, userId })
        }
    }

    identify(userId: string, properties: Record<string, any>): void {
        const client = this.initializeClient()
        if (!client) return
        try {
            client.identify({ distinctId: userId, properties })
            logger.debug("User identified in analytics", { userId })
        } catch (error) {
            logger.error("Failed to identify user in analytics", { error, userId })
        }
    }

    async shutdown(): Promise<void> {
        if (this.client) {
            try {
                await this.client.shutdown()
                this.client = null
                logger.info("Analytics service shut down")
            } catch (error) {
                logger.error("Error shutting down analytics service", { error })
            }
        }
    }
}

export const analytics = AnalyticsService.getInstance()

export function trackIntegrationAdded(userId: string, properties: IntegrationAddedProperties): void {
    analytics.capture(userId, AnalyticsEvent.INTEGRATION_ADDED, properties)
}
