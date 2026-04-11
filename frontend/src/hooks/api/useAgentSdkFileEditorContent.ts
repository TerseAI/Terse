import { useAgentFileContent } from "./useAgentFileContent"

export type AgentSdkEditorStatus = "idle" | "loading" | "ready" | "error"

export type AgentSdkEditorContentResult = {
    displayContent: string
    status: AgentSdkEditorStatus
    errorMessage?: string
    fileName?: string
    rawBytes?: Uint8Array
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
}

function hasNulByte(bytes: Uint8Array, maxScan = 65536): boolean {
    const end = Math.min(bytes.length, maxScan)
    for (let i = 0; i < end; i++) {
        if (bytes[i] === 0) {
            return true
        }
    }
    return false
}

function bytesToEditorText(bytes: Uint8Array, mimeType?: string): string {
    if (hasNulByte(bytes)) {
        return "[Binary file — use download or an external editor]"
    }

    const textish =
        !mimeType ||
        mimeType.startsWith("text/") ||
        mimeType.includes("json") ||
        mimeType.includes("javascript") ||
        mimeType.includes("typescript") ||
        mimeType.includes("xml") ||
        mimeType.includes("svg")

    if (!textish && mimeType === "application/octet-stream") {
        return "[Binary file — use download or an external editor]"
    }

    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch {
        return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
    }
}

/**
 * Resolves proxied SDK file bytes from {@link useAgentFileContent} into editor text.
 */
export function useAgentSdkFileEditorContent(agentId: string, selectedFileId: string | undefined): AgentSdkEditorContentResult {
    const meta = useAgentFileContent(agentId, selectedFileId)

    if (!selectedFileId) {
        return {
            displayContent: "",
            status: "idle" satisfies AgentSdkEditorStatus,
            errorMessage: undefined as string | undefined,
            fileName: undefined as string | undefined,
            rawBytes: undefined as Uint8Array | undefined
        }
    }

    if (meta.isLoading) {
        return {
            displayContent: "",
            status: "loading" satisfies AgentSdkEditorStatus,
            errorMessage: undefined as string | undefined,
            fileName: undefined as string | undefined,
            rawBytes: undefined as Uint8Array | undefined
        }
    }

    if (meta.isError) {
        return {
            displayContent: "",
            status: "error" satisfies AgentSdkEditorStatus,
            errorMessage: "Could not load file from the server.",
            fileName: undefined as string | undefined,
            rawBytes: undefined as Uint8Array | undefined
        }
    }

    const b64 = meta.contentBase64
    if (b64 === undefined) {
        return {
            displayContent: "",
            status: "error" satisfies AgentSdkEditorStatus,
            errorMessage: "Missing file payload.",
            fileName: meta.fileName,
            rawBytes: undefined as Uint8Array | undefined
        }
    }

    try {
        const rawBytes = base64ToUint8Array(b64)
        const displayContent = bytesToEditorText(rawBytes, meta.mimeType)
        return {
            displayContent,
            status: "ready" satisfies AgentSdkEditorStatus,
            errorMessage: undefined as string | undefined,
            fileName: meta.fileName,
            rawBytes
        }
    } catch {
        return {
            displayContent: "",
            status: "error" satisfies AgentSdkEditorStatus,
            errorMessage: "Could not decode file contents.",
            fileName: meta.fileName,
            rawBytes: undefined as Uint8Array | undefined
        }
    }
}
