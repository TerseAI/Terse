import { AtlassianIntegrationManager } from "../AtlassianIntegration";
import { FigmaIntegrationManager } from "../FigmaIntegration";
import { GithubIntegrationManager } from "../GithubIntegration";
import { GmailIntegrationManager } from "../GmailIntegration";
import { LinearIntegrationManager } from "../LinearIntegration";
import { NotionIntegrationManager } from "../NotionIntegration";
import { SlackIntegrationManager } from "../SlackIntegration";
import { FormIntegrationInstallation, Integration, OAuthIntegrationInstallation } from "./Integration";
import { IntegrationInstance, IntegrationDetails, IntegrationType } from "../../shared/Integrations";
import { PosthogIntegrationManager } from "../PosthogIntegration";


type IntegrationWithInstallation = Integration<IntegrationInstance, any, IntegrationDetails> & (OAuthIntegrationInstallation<IntegrationType> | FormIntegrationInstallation<IntegrationType>);


export const INTEGRATION_REGISTRY: Array<IntegrationWithInstallation> = [
    new AtlassianIntegrationManager(),
    new FigmaIntegrationManager(),
    new GithubIntegrationManager(),
    new GmailIntegrationManager(),
    new LinearIntegrationManager(),
    new NotionIntegrationManager(),
    new SlackIntegrationManager(),
    new PosthogIntegrationManager()
]