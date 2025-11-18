import { IntegrationType } from "../shared/types"
import { 
    IntegrationsStatus,
    GmailIntegration,
    NotionIntegration,
    SlackIntegration,
    LinearIntegration,
    JiraIntegration,
    GithubIntegration,
    FigmaIntegration,
    ConfluenceIntegration
} from "../shared/types";

/**
 * Type-safe mapping from Integration enum to IntegrationsStatus keys
 */
export const INTEGRATION_KEY_MAP: Record<IntegrationType, keyof IntegrationsStatus['integrations']> = {
    [IntegrationType.GMAIL]: 'gmail',
    [IntegrationType.NOTION]: 'notion',
   // [IntegrationType.NOTION_PAGE]: 'notion', // Poin the notion page stuff to the notion integration
    [IntegrationType.LINEAR]: 'linear',
    [IntegrationType.JIRA]: 'jira',
    [IntegrationType.CONFLUENCE]: 'confluence', // Confluence shares credentials with Jira
    [IntegrationType.SLACK]: 'slack',
    [IntegrationType.GITHUB]: 'github',
    [IntegrationType.FIGMA]: 'figma',
};

/**
 * Type mapping from Integration enum to the corresponding integration type
 */
type IntegrationTypeMap = {
    [IntegrationType.GMAIL]: GmailIntegration[];
    [IntegrationType.NOTION]: NotionIntegration[];
    //[IntegrationType.NOTION_PAGE]: NotionIntegration[];
    [IntegrationType.LINEAR]: LinearIntegration[];
    [IntegrationType.JIRA]: JiraIntegration[];
    [IntegrationType.CONFLUENCE]: ConfluenceIntegration[]; // Confluence shares credentials with Jira
    [IntegrationType.SLACK]: SlackIntegration[];
    [IntegrationType.GITHUB]: GithubIntegration[];
    [IntegrationType.FIGMA]: FigmaIntegration[];
};

/**
 * Integration metadata including display names and descriptions
 */
export interface IntegrationMetadata {
    type: IntegrationType;
    name: string;
    description: string;
    inputDescription?: string;
    outputDescription?: string;
    isInput?: boolean;
    isOutput?: boolean;
}

export const INTEGRATION_METADATA: Record<IntegrationType, IntegrationMetadata> = {
    [IntegrationType.GMAIL]: {
        type: IntegrationType.GMAIL,
        name: 'Gmail',
        description: 'Monitor incoming emails',
        inputDescription: 'Monitor incoming emails',
        isInput: true,
        isOutput: false
    },
    [IntegrationType.NOTION]: {
        type: IntegrationType.NOTION,
        name: 'Notion',
        description: 'Update living documents',
        outputDescription: 'Update a living page',
        isInput: false,
        isOutput: true
    },
    // [IntegrationType.NOTION_PAGE]: {
    //     type: IntegrationType.NOTION_PAGE,
    //     name: 'Notion Page',
    //     description: 'Update a living page',
    //     outputDescription: 'Update a living page',
    //     isInput: false,
    //     isOutput: true
    // },
    [IntegrationType.LINEAR]: {
        type: IntegrationType.LINEAR,
        name: 'Linear',
        description: 'Track ticket updates',
        inputDescription: 'Track ticket updates',
        outputDescription: 'Update project docs',
        isInput: false,
        isOutput: false
    },
    [IntegrationType.JIRA]: {
        type: IntegrationType.JIRA,
        name: 'Jira',
        description: 'Monitor issue changes',
        inputDescription: 'Monitor issue changes',
        outputDescription: 'Update project docs and tickets',
        isInput: false,
        isOutput: false
    },
    [IntegrationType.CONFLUENCE]: {
        type: IntegrationType.CONFLUENCE,
        name: 'Confluence',
        description: 'Update documentation',
        inputDescription: 'Monitor page changes',
        outputDescription: 'Update documentation pages',
        isInput: false,
        isOutput: true
    },
    [IntegrationType.SLACK]: {
        type: IntegrationType.SLACK,
        name: 'Slack',
        description: 'Listen to messages',
        inputDescription: 'Monitor channel messages',
        outputDescription: 'Post to a channel',
        isInput: true,
        isOutput: false
    },
    [IntegrationType.GITHUB]: {
        type: IntegrationType.GITHUB,
        name: 'GitHub',
        description: 'Watch commits and PRs',
        inputDescription: 'Listen to commits, PRs, and issues',
        isInput: true,
        isOutput: false
    },
    [IntegrationType.FIGMA]: {
        type: IntegrationType.FIGMA,
        name: 'Figma',
        description: 'Monitor comments on design files',
        inputDescription: 'Monitor comments on Figma design files',
        isInput: true,
        isOutput: false
    }
};

/**
 * Get the integration instances from IntegrationsStatus for a given integration type
 * Returns a properly typed array based on the integration type
 */
export function getIntegrationInstances<T extends IntegrationType>(
    integrationData: IntegrationsStatus['integrations'],
    integrationType: T
): IntegrationTypeMap[T] {
    const key = INTEGRATION_KEY_MAP[integrationType];
    return (integrationData[key] || []) as IntegrationTypeMap[T];
}

/**
 * Get display name for an integration type
 */
export function getIntegrationName(type: IntegrationType): string {
    return INTEGRATION_METADATA[type].name;
}

/**
 * Get description for an integration type
 */
export function getIntegrationDescription(type: IntegrationType): string {
    return INTEGRATION_METADATA[type].description;
}

/**
 * Get all integration metadata
 */
export function getAllIntegrationMetadata(): IntegrationMetadata[] {
    return Object.values(INTEGRATION_METADATA);
}

/**
 * Get all integration metadata with input-specific descriptions
 */
export function getAllInputIntegrationMetadata() {
    return Object.values(INTEGRATION_METADATA).filter(meta => meta.isInput === true).map(meta => ({
        type: meta.type,
        name: meta.name,
        description: meta.inputDescription || meta.description
    }));
}

/**
 * Get all integration metadata with output-specific descriptions
 */
export function getAllOutputIntegrationMetadata() {
    return Object.values(INTEGRATION_METADATA).filter(meta => meta.isOutput === true).map(meta => ({
        type: meta.type,
        name: meta.name,
        description: meta.outputDescription || meta.description
    }));
}

/**
 * Get the config field name for an integration type
 * e.g., IntegrationType.NOTION -> 'notionConfig'
 */
export function getIntegrationConfigFieldName(integration: IntegrationType): string {
    return `${integration}Config`;
}

/**
 * Clears all integration config fields from an object, optionally preserving one
 * @param obj - Object that may contain config fields
 * @param preserveIntegration - Optional integration type whose config should be preserved
 * @returns Object with all config fields cleared (except the preserved one)
 */
export function clearIntegrationConfigs<T extends Record<string, any>>(
    obj: T,
    preserveIntegration?: IntegrationType
): Partial<T> {
    const cleared: Partial<T> = {};
    const allIntegrations = Object.values(IntegrationType);
    
    for (const integration of allIntegrations) {
        const configField = getIntegrationConfigFieldName(integration) as keyof T;
        if (integration === preserveIntegration) {
            // Preserve the config for the specified integration
            if (obj[configField] !== undefined) {
                cleared[configField] = obj[configField];
            }
        } else {
            // Clear config for all other integrations
            cleared[configField] = undefined as any;
        }
    }
    
    return cleared;
}

/**
 * Checks if an input integration configuration is complete
 * Each integration type defines its own completeness requirements
 */
export function isInputComplete(input: { integration: IntegrationType; integrationId?: string; [key: string]: any }): boolean {
    // Base requirement: IntegrationType type and ID must be set
    if (!input.integration || !input.integrationId) {
        return false;
    }

    // Integration-specific completeness checks
    switch (input.integration) {
        case IntegrationType.FIGMA:
            // Figma requires both fileKey and teamId
            const figmaConfig = input.figmaConfig;
            return !!(figmaConfig?.fileKey && figmaConfig?.teamId);
        
        case IntegrationType.SLACK:
            // Slack is complete if either channelId is set OR listenToUserDms is true
            const slackConfig = input.slackConfig;
            return !!(slackConfig?.channelId || slackConfig?.listenToUserDms);
        
        case IntegrationType.NOTION:
        // case IntegrationType.NOTION_PAGE:
            // Notion requires databaseId or pageId
            const notionConfig = input.notionConfig;
            const notionPageConfig = input.notionPageConfig;
            return !!(notionConfig?.databaseId || notionPageConfig?.pageId);
        
        case IntegrationType.GMAIL:
        case IntegrationType.GITHUB:
        case IntegrationType.LINEAR:
        case IntegrationType.JIRA:
        case IntegrationType.CONFLUENCE:
            // These integrations don't require additional config beyond integrationId
            return true;
        
        default:
            return true;
    }
}

/**
 * Checks if an output integration configuration is complete
 * Each integration type defines its own completeness requirements
 */
export function isOutputComplete(output: { integration: IntegrationType; integrationId?: string; [key: string]: any }): boolean {
    // Base requirement: IntegrationType type and ID must be set
    if (!output.integration || !output.integrationId) {
        return false;
    }

    // Integration-specific completeness checks
    switch (output.integration) {
        case IntegrationType.NOTION:
            // Notion output requires databaseId
            return !!(output.notionConfig?.databaseId);
        
        // case IntegrationType.NOTION_PAGE:
        //     // Notion Page output requires pageId
        //     return !!(output.notionPageConfig?.pageId);
        
        case IntegrationType.SLACK:
            // Slack output requires channelId
            return !!(output.slackConfig?.channelId);
        
        case IntegrationType.GMAIL:
        case IntegrationType.GITHUB:
        case IntegrationType.LINEAR:
        case IntegrationType.JIRA:
        case IntegrationType.CONFLUENCE:
        case IntegrationType.FIGMA:
            // These integrations don't require additional config beyond integrationId
            return true;
        
        default:
            return true;
    }
}
