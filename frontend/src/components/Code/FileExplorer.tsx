import { useLayoutEffect, useRef, useState } from "react"
import { NodeApi, Tree } from "react-arborist"

import Editor from "@monaco-editor/react"
import { Loader2 } from "lucide-react"

const languageByExtension: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    json: "json",
    html: "html",
    css: "css",
    md: "markdown"
}

export type FileExplorerProps = {
    files: File[]
    selectedFile: File | null
    onSelectFile: (file: File) => void
    editorValue: string
    editorStatus: "idle" | "loading" | "ready" | "error"
    editorErrorMessage?: string
    /** Full path in archive (used as Monaco model path) */
    editorPath?: string | null
}

export type File = {
    id: string
    name: string
    content?: string
    children?: File[]
}

export function FileExplorer({
    files,
    selectedFile,
    onSelectFile,
    editorValue,
    editorStatus,
    editorErrorMessage,
    editorPath
}: FileExplorerProps) {
    const treeBoxRef = useRef<HTMLDivElement>(null)
    const [treeSize, setTreeSize] = useState({ width: 224, height: 320 })

    const pathForLanguage = editorPath ?? selectedFile?.name ?? ""
    const selectedFileExtension = pathForLanguage.split(".").pop()?.toLowerCase() ?? ""
    const selectedFileLanguage = languageByExtension[selectedFileExtension] ?? "plaintext"

    useLayoutEffect(() => {
        const el = treeBoxRef.current
        if (!el) return

        const update = () => {
            const { width, height } = el.getBoundingClientRect()
            const w = Math.max(0, Math.floor(width))
            const h = Math.max(0, Math.floor(height))
            if (w > 0 && h > 0) setTreeSize({ width: w, height: h })
        }

        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const handleSelectFile = (nodes: NodeApi<File>[]) => {
        const node = nodes[0]
        if (!node || !node.isLeaf) return

        onSelectFile(node.data)
    }

    const monacoPath = editorPath ?? selectedFile?.name ?? "untitled"
    const showEditorChrome = editorStatus === "ready" || editorStatus === "loading"
    const showOverlay = editorStatus === "loading" || editorStatus === "error"
    const editorReadOnly = editorStatus !== "ready"

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
            <aside className="border-border flex min-h-0 w-56 shrink-0 flex-col border-r">
                <div ref={treeBoxRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    <Tree data={files} rowHeight={32} indent={16} width={treeSize.width} height={treeSize.height} onSelect={handleSelectFile} />
                </div>
            </aside>
            <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                {editorStatus === "idle" && (
                    <div className="text-muted-foreground flex h-full min-h-0 items-center justify-center px-4 text-center text-sm">
                        Select a file in the tree to view its contents.
                    </div>
                )}
                {(editorStatus === "ready" || editorStatus === "loading") && (
                    <div className="min-h-0 flex-1">
                        <Editor
                            width="100%"
                            height="100%"
                            path={monacoPath}
                            language={selectedFileLanguage}
                            value={editorValue}
                            options={{
                                readOnly: editorReadOnly,
                                minimap: { enabled: true },
                                scrollBeyondLastLine: false,
                                fontSize: 13,
                                padding: { top: 8 }
                            }}
                        />
                    </div>
                )}
                {editorStatus === "error" && (
                    <div className="text-destructive flex h-full min-h-0 flex-col items-center justify-center gap-2 px-6 text-center text-sm" role="alert">
                        <span className="font-medium">Could not show this file</span>
                        {editorErrorMessage ? <span className="text-muted-foreground max-w-md">{editorErrorMessage}</span> : null}
                    </div>
                )}
                {showOverlay && showEditorChrome && (
                    <div
                        className="bg-background/70 pointer-events-none absolute inset-0 flex items-center justify-center"
                        aria-hidden={editorStatus !== "loading"}
                    >
                        {editorStatus === "loading" ? <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" aria-label="Loading file" /> : null}
                    </div>
                )}
            </main>
        </div>
    )
}
