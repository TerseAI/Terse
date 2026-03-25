import { useMemo } from "react"
import { Diff, Hunk, parseDiff } from "react-diff-view"

import { cn } from "@/lib/utils"

type DiffViewerProps = {
    patch: string
    className?: string
}

export function DiffViewer({ patch, className }: DiffViewerProps) {
    const files = useMemo(() => {
        // parseDiff expects a full diff with --- / +++ headers.
        // If the patch is missing the diff header, wrap it so parseDiff can handle it.
        const normalized = patch.startsWith("diff ") || patch.startsWith("--- ") ? patch : `--- a/file\n+++ b/file\n${patch}`
        try {
            return parseDiff(normalized)
        } catch {
            return null
        }
    }, [patch])

    if (!files || files.length === 0) {
        // Fallback: render as plain preformatted text
        return <pre className={cn("text-xs rounded-md border border-border bg-muted/50 p-3 overflow-x-auto whitespace-pre-wrap break-words", className)}>{patch}</pre>
    }

    return (
        <div className={cn("diff-viewer overflow-hidden rounded-md border border-border text-xs", className)}>
            {files.map((file, i) => (
                <Diff key={i} viewType="unified" diffType={file.type} hunks={file.hunks} gutterType="none">
                    {hunks => hunks.map(hunk => <Hunk key={hunk.content} hunk={hunk} />)}
                </Diff>
            ))}
        </div>
    )
}
