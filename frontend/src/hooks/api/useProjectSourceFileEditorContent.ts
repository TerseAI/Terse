import useSWR from "swr"
import type { AgentFileContentResponse } from "terse-types/types"
import { projectSourceFileContentKey } from "terse-types/InvalidationKeys"

import { decodeArchiveFileText } from "../../lib/decodeArchiveFile"
import { BackendProvider } from "../../services/backend"

export type ProjectSourceEditorStatus = "idle" | "loading" | "ready" | "error"

export type ProjectSourceEditorContentResult = {
    displayContent: string
    status: ProjectSourceEditorStatus
    errorMessage?: string
    fileName?: string
}

/**
 * Resolves proxied SDK file bytes for a project-level source archive into editor-displayable text.
 * Mirrors {@link useAgentSdkFileEditorContent} but keyed by projectId.
 */
export function useProjectSourceFileEditorContent(projectId: string | null, selectedFileId: string | undefined): ProjectSourceEditorContentResult {
    const key = projectId && selectedFileId ? projectSourceFileContentKey(projectId, selectedFileId) : null

    const { data, error } = useSWR<AgentFileContentResponse>(key, projectId && selectedFileId ? () => BackendProvider.getProjectSourceFileContent(projectId, selectedFileId) : null, {
        keepPreviousData: true
    })

    if (!selectedFileId || !projectId) {
        return { displayContent: "", status: "idle" }
    }

    if (error) {
        return { displayContent: "", status: "error", errorMessage: "Could not load file from the server." }
    }

    if (!data) {
        return { displayContent: "", status: "loading" }
    }

    try {
        return {
            displayContent: decodeArchiveFileText(data.contentBase64),
            status: "ready",
            fileName: data.fileName
        }
    } catch {
        return { displayContent: "", status: "error", errorMessage: "Could not decode file contents.", fileName: data.fileName }
    }
}
