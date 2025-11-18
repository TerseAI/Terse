import { ConfluenceIntegrationManager } from "../ConfluenceIntegration";
import { FigmaIntegrationManager } from "../FigmaIntegration";
import { GithubIntegrationManager } from "../GithubIntegration";
import { GmailIntegrationManager } from "../GmailIntegration";
import { JiraIntegrationManager } from "../JiraIntegration";
import { LinearIntegrationManager } from "../LinearIntegration";
import { NotionIntegrationManager } from "../NotionIntegration";
import { SlackIntegrationManager } from "../SlackIntegration";
import { Integration, OAuthIntegrationInstallation } from "./Integration";


type IntegrationWithInstallation = Integration<any, any> & (OAuthIntegrationInstallation);


export const IntegrationRegistry: Array<IntegrationWithInstallation> = [
    // new ConfluenceIntegrationManager(),
    // new FigmaIntegrationManager(),
    // new GithubIntegrationManager(),
    new GmailIntegrationManager(),
    // new JiraIntegrationManager(),
    // new LinearIntegrationManager(),
    // new NotionIntegrationManager(),
    // new SlackIntegrationManager(),
]