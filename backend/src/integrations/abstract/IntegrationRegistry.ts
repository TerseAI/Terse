import { AtlassianIntegrationManager } from "../AtlassianIntegration";
import { CronJobIntegrationManager } from "../CronJobIntegration";
import { FigmaIntegrationManager } from "../FigmaIntegration";
import { GithubIntegrationManager } from "../GithubIntegration";
import { GmailIntegrationManager } from "../GmailIntegration";
import { LinearIntegrationManager } from "../LinearIntegration";
import { NotionIntegrationManager } from "../NotionIntegration";
import { SlackIntegrationManager } from "../SlackIntegration";
import { FormIntegrationInstallation, Integration, OAuthIntegrationInstallation } from "./Integration";
import { IntegrationInstance, IntegrationDetails, IntegrationType } from "../../shared/Integrations";
import { PosthogIntegrationManager } from "../PosthogIntegration";
import { LaunchDarklyIntegrationManager } from "../LaunchDarklyIntegration";
import { DatadogIntegrationManager } from "../DatadogIntegration";


type IntegrationWithInstallation = Integration<IntegrationInstance, any, IntegrationDetails, any> & (OAuthIntegrationInstallation<IntegrationType> | FormIntegrationInstallation<IntegrationType>);

// System integrations that don't require user ownership validation
const SYSTEM_INTEGRATION_TYPES: IntegrationType[] = [
    IntegrationType.TERSE,
    IntegrationType.CRON_JOB,
];

export function isSystemIntegration(integrationType: IntegrationType): boolean {
    return SYSTEM_INTEGRATION_TYPES.includes(integrationType);
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
    new DatadogIntegrationManager()
]