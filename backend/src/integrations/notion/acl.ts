import { Client } from "@notionhq/client"
import { DataSourceObjectResponse, GetDataSourceResponse, GetPageResponse, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints"
import { NotionConfig } from "terse-types"

import logger from "../../common/logger"
import { getNotionAccessTokenForOrganization } from "../../integrations/NotionIntegration"
import { ToolACLValidationResult, denyToolACL, findConfigsByIntegrationId } from "../../outputs/abstract/acl"

type NotionScope = { databaseIds: readonly string[]; pageIds: readonly string[] }

const DEFAULT_MAX_DEPTH = 100

const normalizeId = (id: string): string => id.replace(/-/g, "").toLowerCase()

const idMatches = (id: string, allowed: readonly string[]): boolean => {
    const target = normalizeId(id)
    return allowed.some(a => normalizeId(a) === target)
}

const isFullPage = (page: GetPageResponse): page is PageObjectResponse => "parent" in page
const isFullDataSource = (ds: GetDataSourceResponse): ds is DataSourceObjectResponse => "database_parent" in ds

type Kind = "page" | "database"
type ResolverKey = `${Kind}:${string}`

interface NotionScopeResolver {
    isPageInScope(pageId: string): Promise<boolean>
    isDatabaseInScope(databaseId: string): Promise<boolean>
}

/**
 * Each call walks the parent chain fresh — no memoization across calls. Cycles are detected with a `visited`
 * set local to one walk; recursion is bounded by `maxDepth` (default 100).
 */
function createNotionScopeResolver(notion: Client, scope: NotionScope, maxDepth: number = DEFAULT_MAX_DEPTH): NotionScopeResolver {
    const walk = (kind: Kind, id: string): Promise<boolean> => {
        const visited = new Set<ResolverKey>()

        const resolve = async (k: Kind, currentId: string, depth: number): Promise<boolean> => {
            const key: ResolverKey = `${k}:${normalizeId(currentId)}`
            if (visited.has(key)) return false
            if (depth >= maxDepth) {
                logger.warn("[NotionACL] hit maxDepth without finding allowed ancestor", { kind: k, id: currentId, maxDepth })
                return false
            }
            visited.add(key)
            return k === "page" ? resolvePage(currentId, depth) : resolveDatabase(currentId, depth)
        }

        const resolvePage = async (pageId: string, depth: number): Promise<boolean> => {
            if (idMatches(pageId, scope.pageIds)) return true
            const page = await notion.pages.retrieve({ page_id: pageId })
            if (!isFullPage(page)) return false
            const parent = page.parent
            switch (parent.type) {
                case "page_id":
                    return resolve("page", parent.page_id, depth + 1)
                case "database_id":
                    if (idMatches(parent.database_id, scope.databaseIds)) return true
                    return resolve("database", parent.database_id, depth + 1)
                case "data_source_id":
                    if (idMatches(parent.data_source_id, scope.databaseIds)) return true
                    return resolve("database", parent.data_source_id, depth + 1)
                case "workspace":
                case "block_id":
                default:
                    return false
            }
        }

        const resolveDatabase = async (databaseId: string, depth: number): Promise<boolean> => {
            if (idMatches(databaseId, scope.databaseIds)) return true
            // The codebase treats Notion "databaseId" as a data_source_id throughout (see NotionIntegration.validateNotionDatabasesExist).
            const ds = await notion.dataSources.retrieve({ data_source_id: databaseId })
            if (!isFullDataSource(ds)) return false
            const parent = ds.database_parent
            switch (parent.type) {
                case "page_id":
                    return resolve("page", parent.page_id, depth + 1)
                case "database_id":
                    if (idMatches(parent.database_id, scope.databaseIds)) return true
                    return resolve("database", parent.database_id, depth + 1)
                case "workspace":
                case "block_id":
                default:
                    return false
            }
        }

        return resolve(kind, id, 0)
    }

    return {
        isPageInScope: pageId => walk("page", pageId),
        isDatabaseInScope: databaseId => walk("database", databaseId)
    }
}

/**
 * Union the page/database scopes across every config sharing this integrationId.
 * If no config matches, returns an empty scope (which causes denials downstream).
 */
function buildScopeFromConfigs(integrationId: string, configs: NotionConfig[]): { scope: NotionScope; configsForIntegration: NotionConfig[] } {
    const configsForIntegration = findConfigsByIntegrationId(integrationId, configs)
    const databaseIds = Array.from(new Set(configsForIntegration.flatMap(c => c.databaseIds ?? [])))
    const pageIds = Array.from(new Set(configsForIntegration.flatMap(c => c.pageIds ?? [])))
    return { scope: { databaseIds, pageIds }, configsForIntegration }
}

function describeScope(scope: NotionScope): string {
    const pages = scope.pageIds.join(", ") || "(none)"
    const dbs = scope.databaseIds.join(", ") || "(none)"
    return `allowed pages: ${pages}; allowed databases: ${dbs}; descendants of these are also accessible.`
}

async function getResolverFor(integrationId: string, organizationId: string, scope: NotionScope): Promise<NotionScopeResolver> {
    const accessToken = await getNotionAccessTokenForOrganization(integrationId, organizationId)
    const notion = new Client({ auth: accessToken })
    return createNotionScopeResolver(notion, scope)
}

export async function verifyNotionPageInScope(integrationId: string, organizationId: string, pageId: string, configs: NotionConfig[]): Promise<ToolACLValidationResult> {
    const { scope, configsForIntegration } = buildScopeFromConfigs(integrationId, configs)
    if (configsForIntegration.length === 0) {
        return denyToolACL(`Integration ID "${integrationId}" not found.`)
    }
    const resolver = await getResolverFor(integrationId, organizationId, scope)
    const allowed = await resolver.isPageInScope(pageId)
    if (allowed) return { ok: true }
    return denyToolACL(`Notion page ${pageId} is not in scope for integration "${integrationId}". ${describeScope(scope)}`)
}

export async function verifyNotionDatabaseInScope(integrationId: string, organizationId: string, databaseId: string, configs: NotionConfig[]): Promise<ToolACLValidationResult> {
    const { scope, configsForIntegration } = buildScopeFromConfigs(integrationId, configs)
    if (configsForIntegration.length === 0) {
        return denyToolACL(`Integration ID "${integrationId}" not found.`)
    }
    const resolver = await getResolverFor(integrationId, organizationId, scope)
    const allowed = await resolver.isDatabaseInScope(databaseId)
    if (allowed) return { ok: true }
    return denyToolACL(`Notion database ${databaseId} is not in scope for integration "${integrationId}". ${describeScope(scope)}`)
}
