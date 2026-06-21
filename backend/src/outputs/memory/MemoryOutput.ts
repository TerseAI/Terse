import { OutputConfigType } from "@prisma/client"
import { MemoryConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { memoryTool } from "./tools/memoryTool"

const MEMORY_SYSTEM_INSTRUCTIONS = [
    "IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE.",
    "MEMORY PROTOCOL:",
    "1. Use the `view` command of your `memory` tool to check for earlier progress.",
    "2. Work on the task.",
    "3. As you make progress, record status / progress / thoughts etc in your memory.",
    "ASSUME INTERRUPTION: Your context window might be reset at any moment, so you risk losing any progress that is not recorded in your memory directory.",
    "Note: when editing your memory folder, always try to keep its content up-to-date, coherent and organized. You can rename or delete files that are no longer relevant. Do not create new files unless necessary."
].join("\n")

export class MemoryOutput extends Output<MemoryConfig> {
    constructor() {
        super(OutputConfigType.MEMORY, [
            { tool: memoryTool, isReadOnly: false, integration: IntegrationType.TERSE, displayName: "Memory", validateACL: unrestricted }
        ])
    }

    async validateConfig(_output: MemoryConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: MemoryConfig): Promise<void> {}

    protected getSystemInstructionsForConfigs(_configs: MemoryConfig[]): string {
        return MEMORY_SYSTEM_INSTRUCTIONS
    }
}
