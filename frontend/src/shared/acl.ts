import { IntegrationType } from "./Integrations"

export enum ResourceType {
    CHANNEL = "channel",
    USER = "user",
    DATABASE = "database",
    PAGE = "page",
    TEAM = "team",
    PROJECT = "project",
    SPACE = "space",
    FILE = "file",
    ENVIRONMENT = "environment",
    REPOSITORY = "repository"
}

export type ACLItem = {
    integration: IntegrationType
    resourceType: ResourceType
    resourceId: string
}

export const ACL_WILDCARD = "*"

export function createACLItem(integration: IntegrationType, resourceType: ResourceType, resourceId: string | number): ACLItem {
    return { integration, resourceType, resourceId: String(resourceId) }
}

export type ACLCheckResult = { allowed: true } | { allowed: false; reason: string }

export interface ACLCheckContext {
    organizationId: string
}

/** Minimal structural interface for ACL-bearing configs. ConfigInstance satisfies this. */
export interface ACLProvider {
    integrationId: string
    getACL(): ACLItem[]
}
