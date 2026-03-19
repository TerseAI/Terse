import { Client } from "@notionhq/client"

import { getACLOrNull, isPermitted } from "../../agent/acl/aclGuardrail"
import { getNotionAccessTokenOrThrow } from "../../integrations/NotionIntegration"
import logger from "../../logger"
import { NotionConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { ACLCheckResult, ACLItem, ResourceType, createACLItem } from "../../shared/acl"
import { getStringArg } from "../../utility/args"

export const MAX_PARENT_TRAVERSAL_DEPTH = 10

export type PageParent = { type?: string; data_source_id?: string; database_id?: string; page_id?: string }

export function checkDatabaseAccess(configs: NotionConfig[], args: Record<string, unknown>): ACLCheckResult {
    const integrationId = getStringArg(args, "integrationId")
    const databaseId = getStringArg(args, "databaseId")

    if (!integrationId || !databaseId) {
        return { allowed: false, reason: "Notion database tools must include integrationId and databaseId." }
    }

    const acl = getACLOrNull(configs, integrationId)
    if (!acl) {
        return { allowed: false, reason: `Notion integration ${integrationId} is not configured for this agent.` }
    }

    if (isPermitted(createACLItem(IntegrationType.NOTION, ResourceType.DATABASE, databaseId), acl)) {
        return { allowed: true }
    }

    return { allowed: false, reason: `Notion database ${databaseId} is outside the configured ACL for integration ${integrationId}.` }
}

export async function checkDatabaseRowAccess(configs: NotionConfig[], args: Record<string, unknown>): Promise<ACLCheckResult> {
    const dbCheck = checkDatabaseAccess(configs, args)
    if (!dbCheck.allowed) return dbCheck

    const integrationId = getStringArg(args, "integrationId")!
    const databaseId = getStringArg(args, "databaseId")!
    const pageId = getStringArg(args, "page_id")
    if (!pageId) return { allowed: true }

    try {
        const notion = await createNotionClient(integrationId)
        const parentDatabaseId = await resolvePageDatabaseId(pageId, notion)

        if (!parentDatabaseId) {
            return { allowed: false, reason: `Notion page ${pageId} is not a database row and cannot be updated with notion_create_or_update_database_row.` }
        }

        if (parentDatabaseId !== databaseId) {
            return { allowed: false, reason: `Notion page ${pageId} belongs to database ${parentDatabaseId}, but the tool call requested database ${databaseId}.` }
        }

        return { allowed: true }
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        logger.error("Failed to resolve Notion row ACL", { integrationId, databaseId, pageId, reason })
        return { allowed: false, reason: `Unable to verify Notion row ACL for page ${pageId}: ${reason}` }
    }
}

export async function checkPageCreateOrUpdateAccess(configs: NotionConfig[], args: Record<string, unknown>): Promise<ACLCheckResult> {
    const pageId = getStringArg(args, "page_id")
    if (pageId) return checkPageAccess(configs, args, pageId)

    const parentPageId = getStringArg(args, "parentPageId")
    if (!parentPageId) {
        return { allowed: false, reason: "notion_create_or_update_page create calls must include parentPageId." }
    }

    return checkPageAccess(configs, args, parentPageId)
}

export async function checkPageScopedAccess(configs: NotionConfig[], args: Record<string, unknown>, toolName: string): Promise<ACLCheckResult> {
    const pageId = getStringArg(args, "pageId")
    if (!pageId) {
        return { allowed: false, reason: `${toolName} must include pageId.` }
    }

    return checkPageAccess(configs, args, pageId)
}

export async function checkPageAccess(configs: NotionConfig[], args: Record<string, unknown>, pageId: string): Promise<ACLCheckResult> {
    const integrationId = getStringArg(args, "integrationId")

    if (!integrationId) {
        return { allowed: false, reason: "Notion page tools must include integrationId." }
    }

    const acl = getACLOrNull(configs, integrationId)
    if (!acl) {
        return { allowed: false, reason: `Notion integration ${integrationId} is not configured for this agent.` }
    }

    if (isPermitted(createACLItem(IntegrationType.NOTION, ResourceType.PAGE, pageId), acl)) {
        return { allowed: true }
    }

    try {
        const notion = await createNotionClient(integrationId)
        const resolved = await resolvePageAccess(pageId, acl, notion)
        if (resolved.allowed) return { allowed: true }

        return { allowed: false, reason: `Notion page ${pageId} is outside the configured ACL for integration ${integrationId}.` }
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        logger.error("Failed to resolve Notion page ACL", { integrationId, pageId, reason })
        return { allowed: false, reason: `Unable to verify Notion ACL for page ${pageId}: ${reason}` }
    }
}

export async function createNotionClient(integrationId: string): Promise<Client> {
    const accessToken = await getNotionAccessTokenOrThrow(integrationId)
    return new Client({ auth: accessToken })
}

export async function getPageParent(pageId: string, notion: Client): Promise<PageParent | undefined> {
    const page = await notion.pages.retrieve({ page_id: pageId })
    return (page as { parent?: PageParent }).parent
}

export async function resolvePageAccess(pageId: string, allowed: ACLItem[], notion: Client, depth = 0): Promise<{ allowed: boolean }> {
    if (depth >= MAX_PARENT_TRAVERSAL_DEPTH) return { allowed: false }

    const parent = await getPageParent(pageId, notion)
    if (!parent?.type) return { allowed: false }

    if ((parent.type === "data_source_id" && parent.data_source_id) || (parent.type === "database_id" && parent.database_id)) {
        const dbId = (parent.data_source_id ?? parent.database_id)!
        return { allowed: isPermitted(createACLItem(IntegrationType.NOTION, ResourceType.DATABASE, dbId), allowed) }
    }

    if (parent.type === "page_id" && parent.page_id) {
        if (isPermitted(createACLItem(IntegrationType.NOTION, ResourceType.PAGE, parent.page_id), allowed)) {
            return { allowed: true }
        }
        return resolvePageAccess(parent.page_id, allowed, notion, depth + 1)
    }

    return { allowed: false }
}

export async function resolvePageDatabaseId(pageId: string, notion: Client, depth = 0): Promise<string | undefined> {
    if (depth >= MAX_PARENT_TRAVERSAL_DEPTH) return undefined

    const parent = await getPageParent(pageId, notion)
    if (!parent?.type) return undefined

    if (parent.type === "data_source_id") return parent.data_source_id
    if (parent.type === "database_id") return parent.database_id
    if (parent.type === "page_id" && parent.page_id) return resolvePageDatabaseId(parent.page_id, notion, depth + 1)

    return undefined
}
