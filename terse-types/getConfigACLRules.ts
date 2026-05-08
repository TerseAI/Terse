/**
 * Pure config-to-ACL derivation (no network I/O).
 *
 * ACL and `readOnly` apply only to model-selected tool calls during agent runs; see `ACL.ts`
 * for the full product contract.
 */

import type {
    ACLRule,
    AttioACLRule,
    DatadogACLRule,
    GitHubACLRule,
    GmailACLRule,
    ImageEditACLRule,
    LaunchDarklyACLRule,
    LinearACLRule,
    NotionACLRule,
    PosthogACLRule,
    SlackACLRule,
    SnowflakeACLRule,
    WebACLRule,
    WorkOSACLRule
} from "./ACL"
import type {
    AttioOutputConfigData,
    ConfigData,
    DatadogConfigData,
    GitHubConfigData,
    GitHubSkillConfigData,
    GmailDraftOutputConfigData,
    GmailOutputConfigData,
    ImageEditConfigData,
    LaunchDarklyConfigData,
    LinearInputConfigData,
    LinearOutputConfigData,
    NotionConfigData,
    PosthogConfigData,
    SlackConfigData,
    SlackOutputConfigData,
    SnowflakeOutputConfigData,
    WebConfigData,
    WorkOSInputConfigData,
    WorkOSOutputConfigData
} from "./Configs"
import { ConfigType } from "./Configs"
import { IntegrationType } from "./Integrations"

function assertNever(value: never): never {
    throw new Error(`Unhandled config type: ${JSON.stringify(value)}`)
}

function isGitHubSkillConfig(
    config: GitHubConfigData | GitHubSkillConfigData
): config is GitHubSkillConfigData {
    return !("eventTypes" in config)
}

function getSlackOutputConfigACLRules(config: SlackOutputConfigData): SlackACLRule[] {
    const rules: SlackACLRule[] = []

    if (config.channelId) {
        rules.push({
            integrationType: IntegrationType.SLACK,
            integrationId: config.integrationId,
            resourceType: "channel",
            resourceId: config.channelId
        })
    }

    for (const userId of config.userIds ?? []) {
        rules.push({
            integrationType: IntegrationType.SLACK,
            integrationId: config.integrationId,
            resourceType: "dm_user",
            resourceId: userId
        })
    }

    return rules
}

function getSlackInputConfigACLRules(config: SlackConfigData): SlackACLRule[] {
    const rules: SlackACLRule[] = []

    if (config.channelId) {
        rules.push({
            integrationType: IntegrationType.SLACK,
            integrationId: config.integrationId,
            resourceType: "channel",
            resourceId: config.channelId
        })
    }

    for (const userId of config.userIds ?? []) {
        rules.push({
            integrationType: IntegrationType.SLACK,
            integrationId: config.integrationId,
            resourceType: "dm_user",
            resourceId: userId
        })
    }

    return rules
}

function getNotionConfigACLRules(config: NotionConfigData): NotionACLRule[] {
    return [
        ...(config.pageIds ?? []).map(
            (pageId): NotionACLRule => ({
                integrationType: IntegrationType.NOTION,
                integrationId: config.integrationId,
                resourceType: "page",
                resourceId: pageId
            })
        ),
        ...(config.databaseIds ?? []).map(
            (databaseId): NotionACLRule => ({
                integrationType: IntegrationType.NOTION,
                integrationId: config.integrationId,
                resourceType: "database",
                resourceId: databaseId
            })
        )
    ]
}

/**
 * GitHub configs store repository IDs, while model tools use owner/repo names.
 * Pure terse-types derivation cannot hydrate IDs to names.
 * Backend runtime hydration will add GitHub repository ACL rules in a later phase.
 */
function getGitHubSkillConfigACLRules(_config: GitHubSkillConfigData): GitHubACLRule[] {
    return []
}

/** @see getGitHubSkillConfigACLRules */
function getGitHubTriggerConfigACLRules(_config: GitHubConfigData): GitHubACLRule[] {
    return []
}

function getGmailOutputConfigACLRules(config: GmailOutputConfigData): GmailACLRule[] {
    return [
        {
            integrationType: IntegrationType.GMAIL,
            integrationId: config.integrationId,
            resourceType: "send",
            resourceId: "send"
        }
    ]
}

function getGmailDraftOutputConfigACLRules(config: GmailDraftOutputConfigData): GmailACLRule[] {
    return [
        {
            integrationType: IntegrationType.GMAIL,
            integrationId: config.integrationId,
            resourceType: "draft",
            resourceId: "draft"
        }
    ]
}

function getWebConfigACLRules(config: WebConfigData): WebACLRule[] {
    return [
        {
            integrationType: IntegrationType.TERSE,
            integrationId: config.integrationId,
            resourceType: "web_capability",
            resourceId: "system"
        }
    ]
}

function getImageEditConfigACLRules(config: ImageEditConfigData): ImageEditACLRule[] {
    return [
        {
            integrationType: IntegrationType.TERSE,
            integrationId: config.integrationId,
            resourceType: "image_edit_capability",
            resourceId: "system"
        }
    ]
}

function getLinearInputConfigACLRules(config: LinearInputConfigData): LinearACLRule[] {
    const rules: LinearACLRule[] = [
        {
            integrationType: IntegrationType.LINEAR,
            integrationId: config.integrationId,
            resourceType: "integration",
            resourceId: config.integrationId
        }
    ]
    if (config.teamId) {
        rules.push({
            integrationType: IntegrationType.LINEAR,
            integrationId: config.integrationId,
            resourceType: "team",
            resourceId: config.teamId
        })
    }
    if (config.projectId) {
        rules.push({
            integrationType: IntegrationType.LINEAR,
            integrationId: config.integrationId,
            resourceType: "project",
            resourceId: config.projectId
        })
    }
    return rules
}

function getLinearOutputConfigACLRules(config: LinearOutputConfigData): LinearACLRule[] {
    const rules: LinearACLRule[] = [
        {
            integrationType: IntegrationType.LINEAR,
            integrationId: config.integrationId,
            resourceType: "integration",
            resourceId: config.integrationId
        }
    ]
    if (config.teamId) {
        rules.push({
            integrationType: IntegrationType.LINEAR,
            integrationId: config.integrationId,
            resourceType: "team",
            resourceId: config.teamId
        })
    }
    if (config.projectId) {
        rules.push({
            integrationType: IntegrationType.LINEAR,
            integrationId: config.integrationId,
            resourceType: "project",
            resourceId: config.projectId
        })
    }
    return rules
}

function getPosthogConfigACLRules(config: PosthogConfigData): PosthogACLRule[] {
    return [
        {
            integrationType: IntegrationType.POSTHOG,
            integrationId: config.integrationId,
            resourceType: "project",
            resourceId: config.projectId
        }
    ]
}

function getDatadogConfigACLRules(config: DatadogConfigData): DatadogACLRule[] {
    const rules: DatadogACLRule[] = [
        {
            integrationType: IntegrationType.DATADOG,
            integrationId: config.integrationId,
            resourceType: "integration",
            resourceId: config.integrationId
        }
    ]
    for (const indexName of config.defaultIndexes ?? []) {
        rules.push({
            integrationType: IntegrationType.DATADOG,
            integrationId: config.integrationId,
            resourceType: "index",
            resourceId: indexName
        })
    }
    return rules
}

function getLaunchDarklyConfigACLRules(config: LaunchDarklyConfigData): LaunchDarklyACLRule[] {
    const rules: LaunchDarklyACLRule[] = [
        {
            integrationType: IntegrationType.LAUNCHDARKLY,
            integrationId: config.integrationId,
            resourceType: "project",
            resourceId: config.projectKey
        }
    ]
    for (const envKey of config.environmentKeys) {
        rules.push({
            integrationType: IntegrationType.LAUNCHDARKLY,
            integrationId: config.integrationId,
            resourceType: "environment",
            resourceId: envKey
        })
    }
    return rules
}

function getWorkOSInputConfigACLRules(config: WorkOSInputConfigData): WorkOSACLRule[] {
    return [
        {
            integrationType: IntegrationType.WORKOS,
            integrationId: config.integrationId,
            resourceType: "integration",
            resourceId: config.integrationId
        }
    ]
}

function getWorkOSOutputConfigACLRules(config: WorkOSOutputConfigData): WorkOSACLRule[] {
    return [
        {
            integrationType: IntegrationType.WORKOS,
            integrationId: config.integrationId,
            resourceType: "integration",
            resourceId: config.integrationId
        }
    ]
}

function getAttioOutputConfigACLRules(config: AttioOutputConfigData): AttioACLRule[] {
    const rules: AttioACLRule[] = [
        {
            integrationType: IntegrationType.ATTIO,
            integrationId: config.integrationId,
            resourceType: "integration",
            resourceId: config.integrationId
        }
    ]
    if (config.objectSlug) {
        rules.push({
            integrationType: IntegrationType.ATTIO,
            integrationId: config.integrationId,
            resourceType: "object",
            resourceId: config.objectSlug
        })
    }
    return rules
}

function getSnowflakeOutputConfigACLRules(config: SnowflakeOutputConfigData): SnowflakeACLRule[] {
    return [
        {
            integrationType: IntegrationType.SNOWFLAKE,
            integrationId: config.integrationId,
            resourceType: "integration",
            resourceId: config.integrationId
        }
    ]
}

export function getConfigACLRules(config: ConfigData): ACLRule[] {
    switch (config.configType) {
        case ConfigType.GMAIL:
            return []
        case ConfigType.SLACK:
            return getSlackInputConfigACLRules(config)
        case ConfigType.SLACK_OUTPUT:
            return getSlackOutputConfigACLRules(config)
        case ConfigType.NOTION:
            return getNotionConfigACLRules(config)
        case ConfigType.LINEAR_INPUT:
            return getLinearInputConfigACLRules(config)
        case ConfigType.LINEAR_OUTPUT:
            return getLinearOutputConfigACLRules(config)
        case ConfigType.GITHUB:
            return isGitHubSkillConfig(config) ? getGitHubSkillConfigACLRules(config) : getGitHubTriggerConfigACLRules(config)
        case ConfigType.GMAIL_OUTPUT:
            return getGmailOutputConfigACLRules(config)
        case ConfigType.GMAIL_DRAFT_OUTPUT:
            return getGmailDraftOutputConfigACLRules(config)
        case ConfigType.POSTHOG:
            return getPosthogConfigACLRules(config)
        case ConfigType.DATADOG:
            return getDatadogConfigACLRules(config)
        case ConfigType.LAUNCHDARKLY:
            return getLaunchDarklyConfigACLRules(config)
        case ConfigType.WEB:
            return getWebConfigACLRules(config)
        case ConfigType.IMAGE_EDIT:
            return getImageEditConfigACLRules(config)
        case ConfigType.WORKOS_INPUT:
            return getWorkOSInputConfigACLRules(config)
        case ConfigType.WORKOS_OUTPUT:
            return getWorkOSOutputConfigACLRules(config)
        case ConfigType.ATTIO_OUTPUT:
            return getAttioOutputConfigACLRules(config)
        case ConfigType.SNOWFLAKE_OUTPUT:
            return getSnowflakeOutputConfigACLRules(config)
        case ConfigType.TIME_TRIGGER:
        case ConfigType.WEBHOOK_INPUT:
        case ConfigType.WEBMONITOR:
            return []
        default:
            return assertNever(config)
    }
}

export function getMergedACLRules(configs: ConfigData[]): ACLRule[] {
    return configs.flatMap(getConfigACLRules)
}
