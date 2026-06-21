import { defineSessionTool } from "../../../tools/toolUtils"
import { getAgentVolumeStore, agentFilesVolumeName } from "../../../services/volumeStore"
import { resolveAgentStorageContext } from "../storageContext"

function formatSize(sizeBytes: number): string {
    if (sizeBytes < 1024) return `${sizeBytes}B`
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)}K`
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)}M`
}

export const volumeListFilesTool = defineSessionTool({
    name: "volume_list_files",
    description: "List files and directories in this agent's persistent shared volume. Paths are relative to the volume root.",
    execute: async ({ path }, runContext) => {
        const storage = await resolveAgentStorageContext(runContext?.context)
        const store = getAgentVolumeStore()
        const entries = await store.list(agentFilesVolumeName(storage.organizationId, storage.agentId), path ?? "")

        if (entries.length === 0) {
            return {
                success: true,
                message: `Directory ${path || "/"} is empty.`,
                entries: []
            }
        }

        const listing = entries.map(entry => `${formatSize(entry.sizeBytes)}\t${entry.path}${entry.isDirectory ? "/" : ""}`).join("\n")
        return {
            success: true,
            message: `Files in ${path || "/"}:\n${listing}`,
            entries: entries.map(entry => ({
                path: entry.path,
                isDirectory: entry.isDirectory,
                sizeBytes: entry.sizeBytes
            }))
        }
    }
})

export const volumeReadFileTool = defineSessionTool({
    name: "volume_read_file",
    description: "Read a file from this agent's persistent shared volume.",
    execute: async ({ path }, runContext) => {
        const storage = await resolveAgentStorageContext(runContext?.context)
        const store = getAgentVolumeStore()
        const content = await store.read(agentFilesVolumeName(storage.organizationId, storage.agentId), path)
        return {
            success: true,
            path,
            content
        }
    }
})

export const volumeWriteFileTool = defineSessionTool({
    name: "volume_write_file",
    description: "Write or overwrite a file in this agent's persistent shared volume.",
    execute: async ({ path, content }, runContext) => {
        const storage = await resolveAgentStorageContext(runContext?.context)
        const store = getAgentVolumeStore()
        await store.write(agentFilesVolumeName(storage.organizationId, storage.agentId), path, content)
        return {
            success: true,
            message: `Wrote file ${path}`,
            path
        }
    }
})

export const volumeDeleteFileTool = defineSessionTool({
    name: "volume_delete_file",
    description: "Delete a file or directory from this agent's persistent shared volume.",
    execute: async ({ path }, runContext) => {
        const storage = await resolveAgentStorageContext(runContext?.context)
        const store = getAgentVolumeStore()
        await store.deletePath(agentFilesVolumeName(storage.organizationId, storage.agentId), path)
        return {
            success: true,
            message: `Deleted ${path}`,
            path
        }
    }
})
