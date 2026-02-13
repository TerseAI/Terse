import { IntegrationDetails, IntegrationInstance, IntegrationType } from "../../shared/Integrations"
import { AtlassianIntegrationManager } from "../AtlassianIntegration"
import { CronJobIntegrationManager } from "../CronJobIntegration"
import { DatadogIntegrationManager } from "../DatadogIntegration"
import { FigmaIntegrationManager } from "../FigmaIntegration"
import { GithubIntegrationManager } from "../GithubIntegration"
import { GmailIntegrationManager } from "../GmailIntegration"
import { LaunchDarklyIntegrationManager } from "../LaunchDarklyIntegration"
import { LinearIntegrationManager } from "../LinearIntegration"
import { NotionIntegrationManager } from "../NotionIntegration"
import { PosthogIntegrationManager } from "../PosthogIntegration"
import { SlackIntegrationManager } from "../SlackIntegration"
import { AttioIntegrationManager } from "../AttioIntegration"
import { WorkOSIntegrationManager } from "../WorkOSIntegration"

import { FormIntegrationInstallation, Integration, OAuthIntegrationInstallation } from "./Integration"

type IntegrationWithInstallation = Integration<IntegrationInstance, any, IntegrationDetails, any> & (OAuthIntegrationInstallation<IntegrationType> | FormIntegrationInstallation<IntegrationType>)

// System integrations that don't require user ownership validation
const SYSTEM_INTEGRATION_TYPES: IntegrationType[] = [IntegrationType.TERSE, IntegrationType.CRON_JOB]

export function isSystemIntegration(integrationType: IntegrationType): boolean {
    return SYSTEM_INTEGRATION_TYPES.includes(integrationType)
}

export const INTEGRATION_REGISTRY: Array<IntegrationWithInstallation> = [
    new AtlassianIntegrationManager(),
    new CronJobIntegrationManager(),
    new FigmaIntegrationManager(),
    new GithubIntegrationManager(),
    new GmailIntegrationManager(),
    new LinearIntegrationManager(),
    new NotionIntegrationManager(),
    new SlackIntegrationManager(),
    new PosthogIntegrationManager(),
    new LaunchDarklyIntegrationManager(),
    new DatadogIntegrationManager(),
    new WorkOSIntegrationManager(),
    new AttioIntegrationManager()
]
