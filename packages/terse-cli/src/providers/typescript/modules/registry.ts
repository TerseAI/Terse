import type { ExternalIntegrationType } from "terse-types"
import { IntegrationType } from "terse-types"

import type { IntegrationModule } from "./IntegrationModule.js"
import { ApolloModule } from "./apollo/ApolloModule.js"
import { AttioModule } from "./attio/AttioModule.js"
import { DatadogModule } from "./datadog/DatadogModule.js"
import { GithubModule } from "./github/GithubModule.js"
import { GmailModule } from "./gmail/GmailModule.js"
import { HeyReachModule } from "./hey_reach/HeyReachModule.js"
import { LaunchDarklyModule } from "./launchdarkly/LaunchDarklyModule.js"
import { LinearModule } from "./linear/LinearModule.js"
import { NotionModule } from "./notion/NotionModule.js"
import { PosthogModule } from "./posthog/PosthogModule.js"
import { ResendModule } from "./resend/ResendModule.js"
import { SlackModule } from "./slack/SlackModule.js"
import { SnowflakeModule } from "./snowflake/SnowflakeModule.js"
import { TerseModule } from "./terse/TerseModule.js"
import { WorkOSModule } from "./workos/WorkOSModule.js"

/**
 * Exhaustive by construction: adding an IntegrationType won't compile until its
 * module exists here. The terse module lives outside the record because built-ins
 * are always active and never fetched.
 */
export const integrationModuleRegistry: Record<ExternalIntegrationType, IntegrationModule> = {
    [IntegrationType.GITHUB]: new GithubModule(),
    [IntegrationType.HEY_REACH]: new HeyReachModule(),
    [IntegrationType.RESEND]: new ResendModule(),
    [IntegrationType.GMAIL]: new GmailModule(),
    [IntegrationType.LINEAR]: new LinearModule(),
    [IntegrationType.SLACK]: new SlackModule(),
    [IntegrationType.NOTION]: new NotionModule(),
    [IntegrationType.POSTHOG]: new PosthogModule(),
    [IntegrationType.DATADOG]: new DatadogModule(),
    [IntegrationType.LAUNCHDARKLY]: new LaunchDarklyModule(),
    [IntegrationType.WORKOS]: new WorkOSModule(),
    [IntegrationType.ATTIO]: new AttioModule(),
    [IntegrationType.SNOWFLAKE]: new SnowflakeModule(),
    [IntegrationType.APOLLO]: new ApolloModule()
}

export const terseModule = new TerseModule()
