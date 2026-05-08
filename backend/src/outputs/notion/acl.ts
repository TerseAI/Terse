import { Client } from "@notionhq/client"
import { GetPageResponse } from "@notionhq/client/build/src/api-endpoints"
import type { RunContext } from "@openai/agents"
import { ACLRule, IntegrationType, hasACLRule, hasAnyACLRuleForIntegration } from "terse-types"

import { SessionWithTracking } from "../../agent/AgentRunner/BaseAgentRunner"
import { Session } from "../../express"
import { getNotionAccessTokenForOrganization } from "../../integrations/NotionIntegration"
import logger from "../../logger"
import type { ToolACLValidationResult } from "../abstract/Output"
import { ToolACLValidator, configIsWritableForIntegration, denyToolACL } from "../abstract/Output"

function denyReadOnlyIntegration(integrationId: string): ToolACLValidationResult {
    return denyToolACL(`Notion ACL denied: integration ${integrationId} is read-only for this run.`)
}

const MAX_PAGE_PARENT_WALK_DEPTH = 50

type NotionParent =
    | { type: "page_id"; id: string }
    | { type: "database_id"; id: string }
    | { type: "data_source_id"; id: string }
    | { type: "workspace" }
    | { type: "block_id"; id: string }
    | { type: "unknown" }

function hasNotionDatabaseACL(params: { aclRules: ACLRule[]; integrationId: string; databaseId: string }): boolean {
    return hasACLRule(params.aclRules, {
        integrationType: IntegrationType.NOTION,
        integrationId: params.integrationId,
        resourceType: "database",
        resourceId: params.databaseId
    })
}

function hasNotionPageACL(params: { aclRules: ACLRule[]; integrationId: string; pageId: string }): boolean {
    return hasACLRule(params.aclRules, {
        integrationType: IntegrationType.NOTION,
        integrationId: params.integrationId,
        resourceType: "page",
        resourceId: params.pageId
    })
}

function readNotionParent(page: GetPageResponse): NotionParent {
    const parent = "parent" in page ? page.parent : undefined
    if (!parent || typeof parent !== "object" || !("type" in parent)) {
        return { type: "unknown" }
    }
    const p = parent as { type: string; page_id?: string; database_id?: string; data_source_id?: string; block_id?: string }
    switch (p.type) {
        case "page_id":
            return p.page_id ? { type: "page_id", id: p.page_id } : { type: "unknown" }
        case "database_id":
            return p.database_id ? { type: "database_id", id: p.database_id } : { type: "unknown" }
        case "data_source_id":
            return p.data_source_id ? { type: "data_source_id", id: p.data_source_id } : { type: "unknown" }
        case "workspace":
            return { type: "workspace" }
        case "block_id":
            return p.block_id ? { type: "block_id", id: p.block_id } : { type: "unknown" }
        default:
            return { type: "unknown" }
    }
}

async function notionPageInScope(params: { aclRules: ACLRule[]; integrationId: string; pageId: string; client: Client }): Promise<boolean> {
    let currentPageId: string | undefined = params.pageId
    const seen = new Set<string>()

    for (let depth = 0; depth < MAX_PAGE_PARENT_WALK_DEPTH && currentPageId; depth++) {
        if (seen.has(currentPageId)) return false
        seen.add(currentPageId)

        if (hasNotionPageACL({ aclRules: params.aclRules, integrationId: params.integrationId, pageId: currentPageId })) {
            return true
        }

        let pageInfo: GetPageResponse
        try {
            pageInfo = await params.client.pages.retrieve({ page_id: currentPageId })
        } catch (error) {
            logger.warn("[Notion ACL] Failed to retrieve page during ACL walk", {
                integrationId: params.integrationId,
                pageId: currentPageId,
                error: error instanceof Error ? error.message : String(error)
            })
            return false
        }

        const parent = readNotionParent(pageInfo)

        if (parent.type === "database_id" || parent.type === "data_source_id") {
            return hasNotionDatabaseACL({ aclRules: params.aclRules, integrationId: params.integrationId, databaseId: parent.id })
        }

        if (parent.type === "page_id") {
            currentPageId = parent.id
            continue
        }

        return false
    }

    return false
}

async function buildNotionClient(integrationId: string, organizationId: string): Promise<Client | null> {
    try {
        const accessToken = await getNotionAccessTokenForOrganization(integrationId, organizationId)
        return new Client({ auth: accessToken })
    } catch (error) {
        logger.warn("[Notion ACL] Failed to acquire Notion token for ACL walk", {
            integrationId,
            error: error instanceof Error ? error.message : String(error)
        })
        return null
    }
}

async function validateNotionPageScope(params: {
    args: { integrationId: string; pageId: string }
    aclRules: ACLRule[]
    runContext?: RunContext<SessionWithTracking<Session>>
}): Promise<ToolACLValidationResult> {
    const organizationId = params.runContext?.context?.user?.organizationId
    if (!organizationId) {
        return denyToolACL(`Notion ACL denied: page ${params.args.pageId} is not configured for this run.`)
    }
    const client = await buildNotionClient(params.args.integrationId, organizationId)
    if (!client) {
        return denyToolACL(`Notion ACL denied: page ${params.args.pageId} is not configured for this run.`)
    }

    const allowed = await notionPageInScope({
        aclRules: params.aclRules,
        integrationId: params.args.integrationId,
        pageId: params.args.pageId,
        client
    })
    return allowed ? { ok: true } : denyToolACL(`Notion ACL denied: page ${params.args.pageId} is not configured for this run.`)
}

export const validateNotionDatabaseACL: ToolACLValidator<{ integrationId: string; databaseId: string }> = ({ args, aclRules }) => {
    if (hasNotionDatabaseACL({ aclRules, integrationId: args.integrationId, databaseId: args.databaseId })) {
        return { ok: true }
    }
    return denyToolACL(`Notion ACL denied: database ${args.databaseId} is not configured for this run.`)
}

export const validateNotionDatabaseRowACL: ToolACLValidator<{
    integrationId: string
    databaseId: string
    page_id: string | null | undefined
}> = async ({ args, aclRules, configs, runContext }) => {
    if (
        !configIsWritableForIntegration({
            configs,
            integrationId: args.integrationId
        })
    ) {
        return denyReadOnlyIntegration(args.integrationId)
    }

    if (args.page_id) {
        const organizationId = runContext?.context?.user?.organizationId
        if (!organizationId) {
            return denyToolACL(`Notion ACL denied: page ${args.page_id} is not configured for this run.`)
        }
        const client = await buildNotionClient(args.integrationId, organizationId)
        if (!client) {
            return denyToolACL(`Notion ACL denied: page ${args.page_id} is not configured for this run.`)
        }
        const allowed = await notionPageInScope({ aclRules, integrationId: args.integrationId, pageId: args.page_id, client })
        return allowed ? { ok: true } : denyToolACL(`Notion ACL denied: page ${args.page_id} is not configured for this run.`)
    }

    if (hasNotionDatabaseACL({ aclRules, integrationId: args.integrationId, databaseId: args.databaseId })) {
        return { ok: true }
    }
    return denyToolACL(`Notion ACL denied: database ${args.databaseId} is not configured for this run.`)
}

export const validateNotionCreateOrUpdatePageACL: ToolACLValidator<{
    integrationId: string
    page_id?: string | null
    parentPageId?: string | null
}> = async ({ args, aclRules, configs, runContext }) => {
    if (
        !configIsWritableForIntegration({
            configs,
            integrationId: args.integrationId
        })
    ) {
        return denyReadOnlyIntegration(args.integrationId)
    }

    const organizationId = runContext?.context?.user?.organizationId
    if (!organizationId) {
        return denyToolACL(`Notion ACL denied: page ${args.page_id ?? args.parentPageId ?? "(none)"} is not configured for this run.`)
    }
    const client = await buildNotionClient(args.integrationId, organizationId)
    if (!client) {
        return denyToolACL(`Notion ACL denied: page ${args.page_id ?? args.parentPageId ?? "(none)"} is not configured for this run.`)
    }

    if (args.page_id) {
        const allowed = await notionPageInScope({ aclRules, integrationId: args.integrationId, pageId: args.page_id, client })
        return allowed ? { ok: true } : denyToolACL(`Notion ACL denied: page ${args.page_id} is not configured for this run.`)
    }

    if (args.parentPageId) {
        const allowed = await notionPageInScope({ aclRules, integrationId: args.integrationId, pageId: args.parentPageId, client })
        return allowed ? { ok: true } : denyToolACL(`Notion ACL denied: parent page ${args.parentPageId} is not configured for this run.`)
    }

    return denyToolACL("Notion ACL denied: notion_create_or_update_page requires page_id (update) or parentPageId (create).")
}

export const validateNotionReadPageACL: ToolACLValidator<{ integrationId: string; pageId: string }> = params => validateNotionPageScope(params)

export const validateNotionWritePageACL: ToolACLValidator<{ integrationId: string; pageId: string }> = async params => {
    if (
        !configIsWritableForIntegration({
            configs: params.configs,
            integrationId: params.args.integrationId
        })
    ) {
        return denyReadOnlyIntegration(params.args.integrationId)
    }
    return validateNotionPageScope(params)
}

export const validateNotionIntegrationACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules }) => {
    const allowed = hasAnyACLRuleForIntegration({
        rules: aclRules,
        integrationType: IntegrationType.NOTION,
        integrationId: args.integrationId
    })
    return allowed ? { ok: true } : denyToolACL(`Notion ACL denied: integration ${args.integrationId} has no Notion resources configured for this run.`)
}
