import { searchconsole_v1 } from "@googleapis/searchconsole"
import { ToolOutputByName } from "terse-types"

type Sitemap = ToolOutputByName["google_search_console_get_sitemap"]["sitemap"]

export function toSitemap(sitemap: searchconsole_v1.Schema$WmxSitemap): Sitemap {
    return {
        path: sitemap.path ?? null,
        type: sitemap.type ?? null,
        isPending: sitemap.isPending ?? null,
        isSitemapsIndex: sitemap.isSitemapsIndex ?? null,
        lastSubmitted: sitemap.lastSubmitted ?? null,
        lastDownloaded: sitemap.lastDownloaded ?? null,
        errors: toCount(sitemap.errors),
        warnings: toCount(sitemap.warnings),
        contents: (sitemap.contents ?? []).map(content => ({
            type: content.type ?? null,
            submitted: toCount(content.submitted)
        }))
    }
}

// Google returns these int64 counters as strings.
function toCount(value: string | null | undefined): number | null {
    if (value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}
