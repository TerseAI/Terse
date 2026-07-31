import { searchconsole_v1 } from "@googleapis/searchconsole"
import { RunHistoryActionType } from "@prisma/client"
import { GoogleSearchConsoleConfigData, ToolOutputByName } from "terse-types"

import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

import { requireSearchConsoleSiteContext, requireUrlUnderSiteUrl, searchConsoleAction } from "./toolContext"

type IndexStatus = NonNullable<ToolOutputByName["google_search_console_inspect_url"]["indexStatus"]>

export const googleSearchConsoleInspectUrlTool = defineSessionTool({
    name: "google_search_console_inspect_url",
    execute: async ({ integrationId, siteUrl, inspectionUrl, languageCode }, runContext) => {
        const { client, siteUrl: property } = await requireSearchConsoleSiteContext(integrationId, siteUrl, runContext)
        const response = await client.urlInspection.index.inspect({
            requestBody: {
                siteUrl: property,
                inspectionUrl,
                ...(languageCode ? { languageCode } : {})
            }
        })

        const result = response.data.inspectionResult
        const indexStatus = result?.indexStatusResult ? toIndexStatus(result.indexStatusResult) : null

        return {
            success: true,
            inspectionResultLink: result?.inspectionResultLink ?? null,
            indexStatus,
            mobileUsabilityVerdict: result?.mobileUsabilityResult?.verdict ?? null,
            richResultsVerdict: result?.richResultsResult?.verdict ?? null,
            ampVerdict: result?.ampResult?.verdict ?? null,
            actions: [
                searchConsoleAction({
                    action: "Inspected URL in Search Console",
                    siteUrl: property,
                    details: `${inspectionUrl}: ${indexStatus?.verdict ?? "no verdict"}${indexStatus?.coverageState ? ` (${indexStatus.coverageState})` : ""}`,
                    type: RunHistoryActionType.read,
                    isReadOnly: true
                })
            ]
        }
    }
})

export const validateGoogleSearchConsoleInspectUrl: ToolACLValidator<"google_search_console_inspect_url", GoogleSearchConsoleConfigData> = ({ args, configs }) =>
    requireUrlUnderSiteUrl(args.integrationId, args.siteUrl, args.inspectionUrl, configs)

function toIndexStatus(indexStatus: searchconsole_v1.Schema$IndexStatusInspectionResult): IndexStatus {
    return {
        verdict: indexStatus.verdict ?? null,
        coverageState: indexStatus.coverageState ?? null,
        robotsTxtState: indexStatus.robotsTxtState ?? null,
        indexingState: indexStatus.indexingState ?? null,
        pageFetchState: indexStatus.pageFetchState ?? null,
        lastCrawlTime: indexStatus.lastCrawlTime ?? null,
        crawledAs: indexStatus.crawledAs ?? null,
        googleCanonical: indexStatus.googleCanonical ?? null,
        userCanonical: indexStatus.userCanonical ?? null,
        referringUrls: indexStatus.referringUrls ?? [],
        sitemap: indexStatus.sitemap ?? []
    }
}
