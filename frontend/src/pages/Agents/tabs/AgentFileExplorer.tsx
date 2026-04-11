import { useState } from "react"

import { Download, Loader2 } from "lucide-react"

import { File, FileExplorer } from "../../../components/Code/FileExplorer"
import { Button } from "../../../components/ui/button"
import { useAgentFiles } from "../../../hooks/api/useAgentFiles"
import { useAgentSdkFileEditorContent } from "../../../hooks/api/useAgentSdkFileEditorContent"

type AgentFileExplorerProps = {
    agentId: string
}

function triggerBrowserDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.rel = "noopener"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

export function AgentFileExplorer({ agentId }: AgentFileExplorerProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const { files, isLoading, isError } = useAgentFiles(agentId)
    const editor = useAgentSdkFileEditorContent(agentId, selectedFile?.id)

    const fileTree = (files ?? []) as File[]

    const handleDownload = () => {
        if (!selectedFile || editor.status !== "ready") {
            return
        }
        const filename = editor.fileName ?? selectedFile.name
        if (editor.rawBytes && editor.rawBytes.length > 0) {
            const copy = new Uint8Array(editor.rawBytes.byteLength)
            copy.set(editor.rawBytes)
            triggerBrowserDownload(new Blob([copy], { type: "application/octet-stream" }), filename)
            return
        }
        triggerBrowserDownload(new Blob([editor.displayContent], { type: "text/plain;charset=utf-8" }), filename)
    }

    if (isLoading) {
        return (
            <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm" aria-busy="true" role="status">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                Loading source files…
            </div>
        )
    }

    if (isError) {
        return (
            <div className="text-destructive flex h-full items-center justify-center px-4 text-center text-sm" role="alert">
                Could not load source files for this job.
            </div>
        )
    }

    if (fileTree.length === 0) {
        return <div className="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm">No source archive for this job, or the archive has no listable files.</div>
    }

    const canDownload = editor.status === "ready" && Boolean(editor.rawBytes?.length || editor.displayContent.length > 0)

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <div className="border-border flex shrink-0 items-center justify-end gap-2 border-b px-2 py-1.5">
                <Button type="button" variant="outline" size="sm" disabled={!canDownload} onClick={handleDownload} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Download
                </Button>
            </div>
            <div className="min-h-0 min-w-0 flex-1">
                <FileExplorer
                    files={fileTree}
                    selectedFile={selectedFile}
                    onSelectFile={setSelectedFile}
                    editorValue={editor.displayContent}
                    editorStatus={editor.status}
                    editorErrorMessage={editor.errorMessage}
                    editorPath={selectedFile?.id ?? null}
                />
            </div>
        </div>
    )
}
