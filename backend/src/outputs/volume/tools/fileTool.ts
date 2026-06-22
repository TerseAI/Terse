import { defineSessionTool } from "../../../tools/toolUtils"
import { executeFileCommand } from "../../../services/volumeStore/fileCommands"
import { resolveAgentStorageContext } from "../storageContext"

export const fileTool = defineSessionTool({
    name: "file",
    description: "Read and write this agent's persistent files. Commands: list, read, write, delete. Paths are relative to the storage root.",
    execute: async (input, runContext) => {
        const storage = await resolveAgentStorageContext(runContext?.context)
        const result = await executeFileCommand(storage.organizationId, storage.agentId, {
            command: input.command,
            path: input.path ?? undefined,
            content: input.content ?? undefined
        })
        return result
    }
})
