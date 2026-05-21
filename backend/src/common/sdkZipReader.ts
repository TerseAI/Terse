import AdmZip from "adm-zip"
import mime from "mime"
import { AgentFileContentResponse, File } from "terse-types/types"

import logger from "../logger"
import { downloadSdkDeployZip } from "../services/FileStorageService"

const MAX_SDK_ZIP_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

type SdkZipTreeNode = { id: string; name: string; children?: SdkZipTreeNode[] }

export async function loadSdkSourceZip(gcsKey: string | null): Promise<AdmZip | null> {
    if (!gcsKey) return null
    const buffer = await downloadSdkDeployZip(gcsKey)
    if (!buffer) return null
    if (buffer.length > MAX_SDK_ZIP_SIZE_BYTES) {
        logger.error("SDK source ZIP exceeds size limit, refusing to load", { gcsKey, sizeBytes: buffer.length })
        return null
    }
    return new AdmZip(buffer)
}

export function listSdkZipPathsRecursive(zip: AdmZip): File[] {
    const root: SdkZipTreeNode[] = []
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue
        const path = normalizeZipEntryName(entry.entryName)
        if (shouldSkipZipListingPath(path)) continue
        insertPathIntoSdkTree(root, path)
    }
    return sortSdkFileTreeNodes(root)
}

export function extractSdkZipFile(zip: AdmZip, fileId: string): AgentFileContentResponse | null {
    let decodedPath = fileId
    try {
        decodedPath = decodeURIComponent(fileId)
    } catch {
        return null
    }

    if (!isSafeArchiveMemberPath(decodedPath)) return null

    const entry = zip.getEntries().find(e => !e.isDirectory && normalizeZipEntryName(e.entryName) === decodedPath)
    if (!entry) return null

    const raw = entry.getData()
    const fileName = decodedPath.split("/").pop() ?? decodedPath
    const mimeType = mimeTypeForSdkPath(decodedPath)

    return { path: decodedPath, fileName, contentBase64: raw.toString("base64"), mimeType }
}

function normalizeZipEntryName(entryName: string): string {
    return entryName.replace(/\\/g, "/").replace(/^\/+/, "")
}

function shouldSkipZipListingPath(path: string): boolean {
    if (!path) return true
    if (path === ".DS_Store" || path.endsWith("/.DS_Store")) return true
    if (path.startsWith("__MACOSX/") || path === "__MACOSX") return true
    return false
}

function isSafeArchiveMemberPath(path: string): boolean {
    if (!path || path.startsWith("/") || path.includes("\0")) return false
    const segments = path.split("/")
    return !segments.some(s => s === ".." || s === ".")
}

function insertPathIntoSdkTree(root: SdkZipTreeNode[], relativePath: string): void {
    const parts = relativePath.split("/").filter(Boolean)
    if (parts.length === 0) return

    let level = root
    for (let depth = 0; depth < parts.length; depth++) {
        const name = parts[depth]
        const id = parts.slice(0, depth + 1).join("/")
        const isFile = depth === parts.length - 1

        let node = level.find(n => n.name === name)
        if (!node) {
            node = isFile ? { id, name } : { id, name, children: [] }
            level.push(node)
        } else if (!isFile && node.children === undefined) {
            node.children = []
        }

        if (!isFile) {
            if (!node.children) node.children = []
            level = node.children
        }
    }
}

function sortSdkFileTreeNodes(nodes: SdkZipTreeNode[]): File[] {
    const sorted = [...nodes].sort((a, b) => {
        const aDir = a.children !== undefined
        const bDir = b.children !== undefined
        if (aDir !== bDir) return aDir ? -1 : 1
        return a.name.localeCompare(b.name)
    })
    return sorted.map(n => ({
        id: n.id,
        name: n.name,
        ...(n.children?.length ? { children: sortSdkFileTreeNodes(n.children) } : {})
    }))
}

function mimeTypeForSdkPath(path: string): string {
    const lower = path.toLowerCase()
    if (lower.endsWith(".tsx") || lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
        return "text/typescript"
    }

    const fromMime = mime.getType(path)
    if (fromMime) return fromMime

    const base = (path.split("/").pop() ?? path).toLowerCase()
    if (base === "dockerfile" || base === "makefile" || base === "containerfile") {
        return "text/plain"
    }
    return "application/octet-stream"
}
