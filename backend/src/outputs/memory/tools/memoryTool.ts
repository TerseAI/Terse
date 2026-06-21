import { defineSessionTool } from "../../../tools/toolUtils"
import { executeMemoryCommand } from "../../../services/volumeStore/memoryCommands"
import { resolveAgentStorageContext } from "../../volume/storageContext"

export const memoryTool = defineSessionTool({
    name: "memory",
    description:
        "Store and retrieve persistent memory files for this agent. Commands: view, create, str_replace, insert, delete, rename. All paths are under /memories.",
    execute: async (input, runContext) => {
        const storage = await resolveAgentStorageContext(runContext?.context)
        const result = await executeMemoryCommand(storage.organizationId, storage.agentId, {
            command: input.command,
            path: input.path ?? undefined,
            view_range: input.view_range ?? undefined,
            file_text: input.file_text ?? undefined,
            old_str: input.old_str ?? undefined,
            new_str: input.new_str ?? undefined,
            insert_line: input.insert_line ?? undefined,
            insert_text: input.insert_text ?? undefined,
            old_path: input.old_path ?? undefined,
            new_path: input.new_path ?? undefined
        })
        return result
    }
})
