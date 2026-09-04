import { PostHog } from "posthog-node"

import logger from "../common/logger"
import { settings } from "../settings"

export enum AnalyticsEvent {
    NEW_USER_ADDED = "new_user_added",
    ORGANIZATION_CREATED = "organization_created",
    INTEGRATION_ADDED = "integration_added",
    INTEGRATION_REMOVED = "integration_removed",
    PROJECT_CREATED = "project_created",
    PROJECT_DELETED = "project_deleted",
    PROJECT_DEPLOYED = "project_deployed",
    PROJECT_DEPLOY_FAILED = "project_deploy_failed",
    SDK_DEPLOY_LATENCY = "sdk_deploy_latency",
    JOB_CREATED = "job_created",
    JOB_ENABLED = "job_enabled",
    JOB_DISABLED = "job_disabled",
    JOB_AUTO_PAUSED = "job_auto_paused",
    JOB_TRIGGERED = "job_triggered",
    JOB_SKIPPED = "job_skipped",
    JOB_COMPLETED = "job_completed",
    JOB_FAILED = "job_failed",
    JOB_SUSPENDED = "job_suspended",
    JOB_AWAITING_APPROVAL = "job_awaiting_approval",
    JOB_RESUMED = "job_resumed",
    JOB_CANCELLED = "job_cancelled",
    SANDBOX_RUNTIME_LATENCY = "sandbox_runtime_latency",
    SANDBOX_SUSPEND_LATENCY = "sandbox_suspend_latency",
    API_TOKEN_CREATED = "api_token_created",
    CLI_LOGGED_IN = "cli_logged_in",
    BILLING_CHECKOUT_STARTED = "billing_checkout_started",
    BILLING_SUBSCRIPTION_CHANGE_REQUESTED = "billing_subscription_change_requested"
}

// When organizationId is set, capture() also attaches the event to the
// "organization" group so dashboards can slice by org, not just by person.
interface BaseEventProperties {
    organizationId?: string
}

interface NewUserAddedProperties extends BaseEventProperties {
    email: string
    displayName: string
    authMethod?: "github" | "google"
    githubUsername?: string | null
}

interface OrganizationCreatedProperties extends BaseEventProperties {
    organizationId: string
    organizationName: string
}

interface IntegrationAddedProperties extends BaseEventProperties {
    integrationType: string
    integrationName?: string
}

interface IntegrationRemovedProperties extends BaseEventProperties {
    integrationType: string
    organizationId: string
}

interface ProjectProperties extends BaseEventProperties {
    projectId: string
    organizationId: string
    projectName?: string
}

interface ProjectDeployedProperties extends BaseEventProperties {
    projectId: string
    organizationId: string
    deployId: string
    jobsDeployed: number
    jobsAdded: number
    jobsRemoved: number
    cliVersion?: string
    viaRemoteServer: boolean
}

interface ProjectDeployFailedProperties extends BaseEventProperties {
    projectId: string
    organizationId: string
    deployId: string
    errorMessage: string
}

export interface SdkDeployLatencyProperties extends BaseEventProperties {
    projectId: string
    deployId?: string
    cliVersion?: string
    viaRemoteServer: boolean
    success: boolean
    runtime?: string
    errorMessage?: string
    jobsDeployed: number
    jobsAdded?: number
    jobsRemoved?: number
    sourceZipBytes?: number
    baseImageKind?: string
    deployImageCacheHit?: boolean
    /** Per-step build durations, keyed by SdkDeployPhase. */
    phases?: Record<string, number>
    slowestPhase?: string
    totalDeployMs?: number
    parseSourceZipMs?: number
    prepareImagesMs?: number
    registerJobsAndTriggersMs?: number
    buildArchiveMs?: number
    resolveRuntimeMs?: number
    packLocalPackagesMs?: number
    defineDeployImageMs?: number
    computeSourceHashMs?: number
    deployImageResolveMs?: number
    deployImageBuildMs?: number
}

interface JobDefinitionProperties extends BaseEventProperties {
    jobId: string
    jobName: string
    organizationId: string
    projectId?: string
}

interface JobAutoPausedProperties extends BaseEventProperties {
    jobId: string
    consecutiveFailures: number
}

export interface RunEventProperties extends BaseEventProperties {
    runId: string
    jobId: string
    jobName: string
    triggerIntegration?: string
    triggerEvent?: string
    isManuallyTriggered?: boolean
    isTest?: boolean
    isReplay?: boolean
    suspensionKind?: "input" | "timer"
    failureStage?: string
    errorMessage?: string
    reason?: string
}

export interface SandboxRuntimeLatencyProperties extends BaseEventProperties {
    runId: string
    jobId: string
    projectId: string
    mode: "fresh" | "resume"
    provider: "containerized" | "local"
    success: boolean
    runtime?: string
    cliVersion?: string
    jobName?: string
    errorMessage?: string
    resumeSignalKind?: "timer" | "input"
    resumeSignalToCliStartMs?: number
    queueWaitMs?: number
    resumeSchedulerLagMs?: number
    totalWorkerExecutionMs?: number
    resolveSourceImageMs?: number
    createSandboxTokenMs?: number
    fetchProjectSecretsMs?: number
    createSourceImageSandboxMs?: number
    sandboxAppReadyMs?: number
    sourceImageLoadMs?: number
    sandboxReadyMs?: number
    runtimeCommandMs?: number
    resolveRunStatusMs?: number
    terminateRunSandboxMs?: number
}

export interface SandboxSuspendLatencyProperties extends BaseEventProperties {
    runId: string
    jobId?: string
    projectId?: string
    suspensionKind: "timer" | "input"
    success: boolean
    delaySeconds?: number
    snapshotSandboxMs?: number
    markRunSuspendedMs?: number
    enqueueRunResumptionMs?: number
    totalSuspendMs?: number
    errorMessage?: string
}

interface ApiTokenCreatedProperties extends BaseEventProperties {
    organizationId: string
    tokenName: string
}

interface OrganizationScopedProperties extends BaseEventProperties {
    organizationId: string
}

type EventProperties = {
    [AnalyticsEvent.NEW_USER_ADDED]: NewUserAddedProperties
    [AnalyticsEvent.ORGANIZATION_CREATED]: OrganizationCreatedProperties
    [AnalyticsEvent.INTEGRATION_ADDED]: IntegrationAddedProperties
    [AnalyticsEvent.INTEGRATION_REMOVED]: IntegrationRemovedProperties
    [AnalyticsEvent.PROJECT_CREATED]: ProjectProperties
    [AnalyticsEvent.PROJECT_DELETED]: ProjectProperties
    [AnalyticsEvent.PROJECT_DEPLOYED]: ProjectDeployedProperties
    [AnalyticsEvent.PROJECT_DEPLOY_FAILED]: ProjectDeployFailedProperties
    [AnalyticsEvent.SDK_DEPLOY_LATENCY]: SdkDeployLatencyProperties
    [AnalyticsEvent.JOB_CREATED]: JobDefinitionProperties
    [AnalyticsEvent.JOB_ENABLED]: JobDefinitionProperties
    [AnalyticsEvent.JOB_DISABLED]: JobDefinitionProperties
    [AnalyticsEvent.JOB_AUTO_PAUSED]: JobAutoPausedProperties
    [AnalyticsEvent.JOB_TRIGGERED]: RunEventProperties
    [AnalyticsEvent.JOB_SKIPPED]: RunEventProperties
    [AnalyticsEvent.JOB_COMPLETED]: RunEventProperties
    [AnalyticsEvent.JOB_FAILED]: RunEventProperties
    [AnalyticsEvent.JOB_SUSPENDED]: RunEventProperties
    [AnalyticsEvent.JOB_AWAITING_APPROVAL]: RunEventProperties
    [AnalyticsEvent.JOB_RESUMED]: RunEventProperties
    [AnalyticsEvent.JOB_CANCELLED]: RunEventProperties
    [AnalyticsEvent.SANDBOX_RUNTIME_LATENCY]: SandboxRuntimeLatencyProperties
    [AnalyticsEvent.SANDBOX_SUSPEND_LATENCY]: SandboxSuspendLatencyProperties
    [AnalyticsEvent.API_TOKEN_CREATED]: ApiTokenCreatedProperties
    [AnalyticsEvent.CLI_LOGGED_IN]: OrganizationScopedProperties
    [AnalyticsEvent.BILLING_CHECKOUT_STARTED]: OrganizationScopedProperties
    [AnalyticsEvent.BILLING_SUBSCRIPTION_CHANGE_REQUESTED]: OrganizationScopedProperties
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
            const message: Parameters<PostHog["capture"]>[0] = {
                distinctId: userId,
                event,
                properties: { ...properties, timestamp: new Date().toISOString() }
            }
            if (properties.organizationId) message.groups = { organization: properties.organizationId }
            client.capture(message)
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

    groupIdentify(organizationId: string, properties: Record<string, any>): void {
        const client = this.initializeClient()
        if (!client) return
        try {
            client.groupIdentify({ groupType: "organization", groupKey: organizationId, properties })
            logger.debug("Organization identified in analytics", { organizationId })
        } catch (error) {
            logger.error("Failed to identify organization in analytics", { error, organizationId })
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
