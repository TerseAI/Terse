import { reachBackMemoryFs } from "../../../services/sandboxReach"
import { executeMemoryCommand } from "../../../services/volumeStore/memoryCommands"
import { defineSessionTool } from "../../../tools/toolUtils"
import { resolveAgentStorageContext } from "../../volume/storageContext"

export const memoryTool = defineSessionTool({
    name: "memory",
    description:
        "Store and retrieve persistent memory files for this agent. Commands: view, create, str_replace, insert, delete, rename. All paths are under /memories.",
    execute: async (input, runContext) => {
        const storage = await resolveAgentStorageContext(runContext?.context)
        const memoryInput = {
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
        }

        // On Modal, run against the originating sandbox's co-located volume. Off Modal (or if
        // the sandbox isn't reachable), fall back to the backend-local store.
        const reachBack = await reachBackMemoryFs({ organizationId: storage.organizationId, agentId: storage.agentId, tool: "memory", input: memoryInput })
        if (reachBack !== null) {
            return reachBack as Awaited<ReturnType<typeof executeMemoryCommand>>
        }

        return executeMemoryCommand(storage.organizationId, storage.agentId, memoryInput)
    }
})
