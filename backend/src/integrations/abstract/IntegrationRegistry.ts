import { IntegrationDetails, IntegrationInstance, IntegrationType } from "terse-types"

import { AttioIntegrationManager } from "../AttioIntegration"
import { CronJobIntegrationManager } from "../CronJobIntegration"
import { DatadogIntegrationManager } from "../DatadogIntegration"
import { GithubIntegrationManager } from "../GithubIntegration"
import { GmailIntegrationManager } from "../GmailIntegration"
import { LaunchDarklyIntegrationManager } from "../LaunchDarklyIntegration"
import { LinearIntegrationManager } from "../LinearIntegration"
import { NotionIntegrationManager } from "../NotionIntegration"
import { PosthogIntegrationManager } from "../PosthogIntegration"
import { SlackIntegrationManager } from "../SlackIntegration"
import { SnowflakeIntegrationManager } from "../SnowflakeIntegration"
import { WebMonitorIntegrationManager } from "../WebMonitorIntegration"
import { WorkOSIntegrationManager } from "../WorkOSIntegration"

import { FormIntegrationInstallation, Integration, OAuthIntegrationInstallation } from "./Integration"

type IntegrationWithInstallation = Integration<IntegrationInstance, any, IntegrationDetails, any> & (OAuthIntegrationInstallation<IntegrationType> | FormIntegrationInstallation<IntegrationType>)

// System integrations that don't require user ownership validation
const SYSTEM_INTEGRATION_TYPES: IntegrationType[] = [IntegrationType.TERSE, IntegrationType.CRON_JOB, IntegrationType.WEBHOOK, IntegrationType.WEBMONITOR]

export function isSystemIntegration(integrationType: IntegrationType): boolean {
    return SYSTEM_INTEGRATION_TYPES.includes(integrationType)
}

export const INTEGRATION_REGISTRY: Array<IntegrationWithInstallation> = [
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
    new SnowflakeIntegrationManager()
]
