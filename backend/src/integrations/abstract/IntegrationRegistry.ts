import { IntegrationDetails, IntegrationInstance, IntegrationType } from "terse-types"

import { AttioIntegrationManager } from "../attio/integration"
import { CronJobIntegrationManager } from "../cronJob/integration"
import { DatadogIntegrationManager } from "../datadog/integration"
import { GithubIntegrationManager } from "../github/integration"
import { GmailIntegrationManager } from "../gmail/integration"
import { HeyReachIntegrationManager } from "../heyreach/integration"
import { LaunchDarklyIntegrationManager } from "../launchdarkly/integration"
import { LinearIntegrationManager } from "../linear/integration"
import { MetaAdsIntegrationManager } from "../metaAds/integration"
import { NotionIntegrationManager } from "../notion/integration"
import { PosthogIntegrationManager } from "../posthog/integration"
import { ResendIntegrationManager } from "../resend/integration"
import { SlackIntegrationManager } from "../slack/integration"
import { SnowflakeIntegrationManager } from "../snowflake/integration"
import { WebMonitorIntegrationManager } from "../webMonitor/integration"
import { WorkOSIntegrationManager } from "../workos/integration"

import { FormIntegrationInstallation, Integration, OAuthIntegrationInstallation } from "./Integration"

type IntegrationWithInstallation = Integration<IntegrationInstance, any, IntegrationDetails, any> & (OAuthIntegrationInstallation<IntegrationType> | FormIntegrationInstallation<IntegrationType>)

// System integrations that don't require user ownership validation
const SYSTEM_INTEGRATION_TYPES: IntegrationType[] = [IntegrationType.TERSE, IntegrationType.CRON_JOB, IntegrationType.WEBHOOK, IntegrationType.WEBMONITOR]

export function isSystemIntegration(integrationType: IntegrationType): boolean {
    return SYSTEM_INTEGRATION_TYPES.includes(integrationType)
}

function buildIntegrationTuple() {
    return [
        new CronJobIntegrationManager(),
        new WebMonitorIntegrationManager(),
        new GithubIntegrationManager(),
        new GmailIntegrationManager(),
        new LinearIntegrationManager(),
        new NotionIntegrationManager(),
        new SlackIntegrationManager(),
        new PosthogIntegrationManager(),
        new LaunchDarklyIntegrationManager(),
        new DatadogIntegrationManager(),
        new WorkOSIntegrationManager(),
        new AttioIntegrationManager(),
        new SnowflakeIntegrationManager(),
        new HeyReachIntegrationManager(),
        new ResendIntegrationManager(),
        new MetaAdsIntegrationManager()
    ] as const satisfies readonly IntegrationWithInstallation[]
}

export type IntegrationManagers = ReturnType<typeof buildIntegrationTuple>

export class IntegrationRegistry {
    private static instance: IntegrationRegistry
    private registry: readonly IntegrationWithInstallation[] | null = null

    private constructor() {}

    public static getInstance(): IntegrationRegistry {
        if (!IntegrationRegistry.instance) {
            IntegrationRegistry.instance = new IntegrationRegistry()
        }
        return IntegrationRegistry.instance
    }

    // Only include integrations that have necessary secrets provided.
    public all(): readonly IntegrationWithInstallation[] {
        if (!this.registry) {
            this.registry = buildIntegrationTuple().filter(m => m.isAvailable)
        }
        return this.registry
    }
}
