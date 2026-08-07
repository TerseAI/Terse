import { OutputConfigType } from "@prisma/client"
import { GoogleSearchConsoleConfigData, IntegrationType } from "terse-types"

import { getSearchConsoleClient, listSearchConsoleSites } from "../../integrations/googlesearchconsole/apiClient"
import { isSiteUrlAllowed } from "../../integrations/googlesearchconsole/siteScope"
import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import {
    googleSearchConsoleAddSiteTool,
    googleSearchConsoleDeleteSiteTool,
    googleSearchConsoleDeleteSitemapTool,
    googleSearchConsoleGetSiteTool,
    googleSearchConsoleGetSitemapTool,
    googleSearchConsoleInspectUrlTool,
    googleSearchConsoleListSitemapsTool,
    googleSearchConsoleListSitesTool,
    googleSearchConsoleQuerySearchAnalyticsTool,
    googleSearchConsoleSubmitSitemapTool,
    validateInspectUrlInScope,
    validateSiteUrlInScope
} from "./tools"

export class GoogleSearchConsoleOutput extends Output<GoogleSearchConsoleConfigData> {
    constructor() {
        super(OutputConfigType.GOOGLE_SEARCH_CONSOLE, [
            {
                tool: googleSearchConsoleListSitesTool,
                isReadOnly: true,
                integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
                displayName: "List properties",
                validateACL: unrestricted
            },
            {
                tool: googleSearchConsoleGetSiteTool,
                isReadOnly: true,
                integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
                displayName: "Get property",
                validateACL: validateSiteUrlInScope
            },
            {
                tool: googleSearchConsoleAddSiteTool,
                isReadOnly: false,
                integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
                displayName: "Add property",
                supportsApproval: true,
                validateACL: validateSiteUrlInScope
            },
            {
                tool: googleSearchConsoleDeleteSiteTool,
                isReadOnly: false,
                integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
                displayName: "Remove property",
                supportsApproval: true,
                validateACL: validateSiteUrlInScope
            },
            {
                tool: googleSearchConsoleListSitemapsTool,
                isReadOnly: true,
                integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
                displayName: "List sitemaps",
                validateACL: validateSiteUrlInScope
            },
            {
                tool: googleSearchConsoleGetSitemapTool,
                isReadOnly: true,
                integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
                displayName: "Get sitemap",
                validateACL: validateSiteUrlInScope
            },
            {
                tool: googleSearchConsoleSubmitSitemapTool,
                isReadOnly: false,
                integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
                displayName: "Submit sitemap",
                supportsApproval: true,
                validateACL: validateSiteUrlInScope
            },
            {
                tool: googleSearchConsoleDeleteSitemapTool,
                isReadOnly: false,
                integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
                displayName: "Remove sitemap",
                supportsApproval: true,
                validateACL: validateSiteUrlInScope
            },
            {
                tool: googleSearchConsoleQuerySearchAnalyticsTool,
                isReadOnly: true,
                integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
                displayName: "Query search analytics",
                validateACL: validateSiteUrlInScope
            },
            {
                tool: googleSearchConsoleInspectUrlTool,
                isReadOnly: true,
                integration: IntegrationType.GOOGLE_SEARCH_CONSOLE,
                displayName: "Inspect URL",
                validateACL: validateInspectUrlInScope
            }
        ])
    }

    async validateConfig(output: GoogleSearchConsoleConfigData, _userId: string): Promise<void> {
        const siteUrls = output.siteUrls ?? []
        if (siteUrls.length === 0) {
            throw new Error("Invalid Google Search Console output config: you must supply at least one Search Console property.")
        }

        const client = await getSearchConsoleClient(output.integrationId)
        const accessibleSiteUrls = (await listSearchConsoleSites(client)).map(site => site.siteUrl)
        const unknown = siteUrls.filter(siteUrl => !isSiteUrlAllowed(siteUrl, accessibleSiteUrls))
        if (unknown.length > 0) {
            throw new Error(`Google Search Console properties not accessible to this connection: ${unknown.join(", ")}. Available properties: ${accessibleSiteUrls.join(", ") || "(none)"}.`)
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: GoogleSearchConsoleConfigData): Promise<void> {
        await tx.automation_google_search_console_configs.create({
            data: {
                automation_output_id: agentOutputId,
                site_urls: output.siteUrls ?? []
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: GoogleSearchConsoleConfigData[]): string {
        if (configs.length === 0) {
            throw new Error("No Google Search Console configs provided")
        }

        const configList = configs.map(config => `  • Integration ID: ${config.integrationId} | Allowed properties: ${(config.siteUrls ?? []).join("; ") || "(none)"}`)

        return [
            "=== GOOGLE SEARCH CONSOLE OUTPUT ===",
            "Available configurations:",
            configList.join("\n"),
            "\nWhen calling Google Search Console tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.",
            "\n" + GOOGLE_SEARCH_CONSOLE_OUTPUT_INSTRUCTIONS
        ].join("\n")
    }
}

const GOOGLE_SEARCH_CONSOLE_OUTPUT_INSTRUCTIONS = `
PROPERTY IDENTIFIERS:
- A property is either a URL-prefix property ("https://example.com/", trailing slash included) or a Domain property ("sc-domain:example.com").
- Pass the identifier exactly as \`siteUrl\`. Use \`google_search_console_list_sites\` when you are unsure which properties exist.

RESTRICTION — You may only operate on the allowed properties listed above:
- Every tool except \`google_search_console_list_sites\` is restricted to those properties. \`google_search_console_list_sites\` shows every property the connected Google account can see, including ones you are not allowed to act on.
- An allowed Domain property also covers its subdomains, in either property form.
- \`google_search_console_inspect_url\` additionally requires \`inspectionUrl\` to sit under the property given in \`siteUrl\`.

TOOLS:
- Properties: \`google_search_console_list_sites\`, \`google_search_console_get_site\`, \`google_search_console_add_site\`, \`google_search_console_delete_site\`
- Sitemaps: \`google_search_console_list_sitemaps\`, \`google_search_console_get_sitemap\`, \`google_search_console_submit_sitemap\`, \`google_search_console_delete_sitemap\`
- Reporting: \`google_search_console_query_search_analytics\`, \`google_search_console_inspect_url\`

SEARCH ANALYTICS:
- Dates are inclusive YYYY-MM-DD in PST and Search Console data lags by roughly 2-3 days, so do not report "zero traffic" for the last few days; state that the data is not yet available.
- Group with \`dimensions\` (applied in order) and narrow with \`dimensionFilterGroups\`. Each row returns its dimension values in the \`dimensions\` object keyed by dimension name.
- Use \`aggregationType: "auto"\` whenever grouping or filtering by page.
- Page through more than 25000 rows with \`startRow\`, and prefer one large \`rowLimit\` over many small requests.
- Query-grouped results omit anonymized queries, so their clicks will not sum to the property total. Do not present the difference as data loss.

WRITE OPERATIONS:
- Adding or removing a property changes the user's Google account, and removing one cuts off access to that property's history. Only do it when explicitly asked, and confirm the exact identifier first.
- Submitting a sitemap only queues it; report it as submitted, not as processed. Check results later with \`google_search_console_get_sitemap\`.

USER-FACING RESPONSE STYLE:
- Report metrics with the date range they cover, and name the property you queried.
- Round CTR to a sensible precision (for example 3.4%) rather than echoing raw floats.
`.trim()
