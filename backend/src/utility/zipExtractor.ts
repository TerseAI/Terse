import AdmZip from "adm-zip"

const MAX_SOURCE_FILE_SIZE = 50_000 // 50KB per file
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".js", ".tsx", ".jsx", ".json", ".yaml", ".yml"])

export function extractSourceFilesFromZip(zipBuffer: Buffer): Array<{ path: string; content: string }> {
    const zip = new AdmZip(zipBuffer)
    const entries = zip.getEntries()
    const files: Array<{ path: string; content: string }> = []

    for (const entry of entries) {
        if (entry.isDirectory) continue
        if (entry.entryName.includes("node_modules/")) continue
        if (entry.entryName.startsWith(".")) continue

        const ext = entry.entryName.substring(entry.entryName.lastIndexOf("."))
        if (!SOURCE_FILE_EXTENSIONS.has(ext)) continue
        if (entry.header.size > MAX_SOURCE_FILE_SIZE) continue

        const content = entry.getData().toString("utf-8")
        files.push({ path: entry.entryName, content })
    }

    return files
}
