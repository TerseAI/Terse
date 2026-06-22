import { reachBackMemoryFs } from "../../../services/sandboxReach"
import { executeFileCommand } from "../../../services/volumeStore/fileCommands"
import { defineSessionTool } from "../../../tools/toolUtils"
import { resolveAgentStorageContext } from "../storageContext"

export const fileTool = defineSessionTool({
    name: "file",
    description: "Read and write this agent's persistent files. Commands: list, read, write, delete. Paths are relative to the storage root.",
    execute: async (input, runContext) => {
        const storage = await resolveAgentStorageContext(runContext?.context)
        const fileInput = {
            command: input.command,
            path: input.path ?? undefined,
            content: input.content ?? undefined
        }

        // On Modal, run against the originating sandbox's co-located volume. Off Modal (or if
        // the sandbox isn't reachable), fall back to the backend-local store.
        const reachBack = await reachBackMemoryFs({ organizationId: storage.organizationId, agentId: storage.agentId, tool: "file", input: fileInput })
        if (reachBack !== null) {
            return reachBack as Awaited<ReturnType<typeof executeFileCommand>>
        }

        return executeFileCommand(storage.organizationId, storage.agentId, fileInput)
    }
})
