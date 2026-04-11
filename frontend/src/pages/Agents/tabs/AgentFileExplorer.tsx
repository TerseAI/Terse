import { useState } from "react"

import { Loader2 } from "lucide-react"

import { FileExplorer, FileNode as File } from "../../../components/Code/FileExplorer"
import { useAgentFiles } from "../../../hooks/api/useAgentFiles"
import { useAgentSdkFileEditorContent } from "../../../hooks/api/useAgentSdkFileEditorContent"

type AgentFileExplorerProps = {
    agentId: string
}

export function AgentFileExplorer({ agentId }: AgentFileExplorerProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const { files, isLoading, isError } = useAgentFiles(agentId)
    const editor = useAgentSdkFileEditorContent(agentId, selectedFile?.id)

    const fileTree = (files ?? []) as File[]

    if (isLoading) {
        return (
            <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm" aria-busy="true" role="status">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
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

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
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
    )
}
