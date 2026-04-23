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

/**
 * Decodes the base64 bytes of an SDK archive member to editor-displayable text.
 * Returns a placeholder when the file is binary.
 */
export function decodeArchiveFileText(contentBase64: string): string {
    const bytes = base64ToUint8Array(contentBase64)
    if (hasNulByte(bytes)) {
        return "[Binary file — not shown in preview]"
    }
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch {
        return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
    }
}
