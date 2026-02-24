import { PostHog } from "posthog-node"

import { settings } from "../config/settings"
import logger from "../logger"

/**
 * Analytics events for tracking key user actions.
 * These map to PostHog events for product analytics.
 */
export enum AnalyticsEvent {
    NEW_USER_ADDED = "new_user_added",
    AGENT_TRIGGERED = "agent_triggered",
    ACTION_TAKEN = "action_taken",
    AGENT_CREATED = "agent_created",
    INTEGRATION_ADDED = "integration_added"
}

interface NewUserAddedProperties {
    email: string
    displayName: string
    authMethod?: "github" | "google"
    githubUsername?: string | null
}

interface AgentTriggeredProperties {
    agentId: string
    agentName: string
    triggerType: string
    triggerSource?: string
    runId: string
}

interface ActionTakenProperties {
    runId: string
    actionType: string
    integration: string
    target?: string
    isReadOnly?: boolean
}

interface AgentCreatedProperties {
    agentId: string
    agentName: string
    triggerCount: number
    outputCount: number
    requiresApproval: boolean
}

interface IntegrationAddedProperties {
    integrationType: string
    integrationName?: string
}

type EventProperties = {
    [AnalyticsEvent.NEW_USER_ADDED]: NewUserAddedProperties
    [AnalyticsEvent.AGENT_TRIGGERED]: AgentTriggeredProperties
    [AnalyticsEvent.ACTION_TAKEN]: ActionTakenProperties
    [AnalyticsEvent.AGENT_CREATED]: AgentCreatedProperties
    [AnalyticsEvent.INTEGRATION_ADDED]: IntegrationAddedProperties
}

/**
 * Analytics service for tracking product events via PostHog.
 * Uses a singleton pattern to ensure a single client instance.
 */
class AnalyticsService {
    private static instance: AnalyticsService | null = null
    private client: PostHog | null = null

    private constructor() {
        // Private constructor for singleton pattern
    }

    static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService()
        }
        return AnalyticsService.instance
    }

    private initializeClient(): PostHog | null {
        if (this.client) {
            return this.client
        }

        if (!settings.posthog.apiKey) {
            logger.warn("Analytics service not configured. Events will not be tracked.")
            return null
        }

        try {
            this.client = new PostHog(settings.posthog.apiKey, {
                host: settings.posthog.host
            })

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

    /**
     * Capture an analytics event for a specific user.
     *
     * @param userId - The unique identifier for the user (distinct_id in PostHog)
     * @param event - The event type to capture
     * @param properties - Event-specific properties
     */
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
                properties: {
                    ...properties,
                    timestamp: new Date().toISOString()
                }
            })

            logger.debug("Analytics event captured", { event, userId, properties })
        } catch (error) {
            logger.error("Failed to capture analytics event", { error, event, userId })
        }
    }

    /**
     * Identify a user with their properties.
     * Called when a user signs up or their profile changes.
     */
    identify(userId: string, properties: Record<string, any>): void {
        const client = this.initializeClient()

        if (!client) {
            return
        }

        try {
            client.identify({
                distinctId: userId,
                properties
            })

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

// Export singleton instance
export const analytics = AnalyticsService.getInstance()

// Export convenience functions for cleaner API
export function trackNewUserAdded(userId: string, properties: NewUserAddedProperties): void {
    analytics.capture(userId, AnalyticsEvent.NEW_USER_ADDED, properties)
}

export function trackAgentTriggered(userId: string, properties: AgentTriggeredProperties): void {
    analytics.capture(userId, AnalyticsEvent.AGENT_TRIGGERED, properties)
}

export function trackActionTaken(userId: string, properties: ActionTakenProperties): void {
    analytics.capture(userId, AnalyticsEvent.ACTION_TAKEN, properties)
}

export function trackAgentCreated(userId: string, properties: AgentCreatedProperties): void {
    analytics.capture(userId, AnalyticsEvent.AGENT_CREATED, properties)
}

export function trackIntegrationAdded(userId: string, properties: IntegrationAddedProperties): void {
    analytics.capture(userId, AnalyticsEvent.INTEGRATION_ADDED, properties)
}
