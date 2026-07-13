import { OutputConfigType } from "@prisma/client"
import { IntegrationType, MemoryConfig } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { memoryTool } from "./tools/memoryTool"

// Injected when the memory skill is active — mirrors the prompt the native Anthropic memory tool adds.
const MEMORY_SYSTEM_INSTRUCTIONS = [
    "You have a persistent `memory` tool whose files live under /memories and survive across runs.",
    "IMPORTANT: VIEW YOUR MEMORY DIRECTORY (view /memories) BEFORE STARTING A TASK to recover earlier progress and context.",
    "As you work, record durable status, decisions, and learnings in your memory; assume your context may reset at any time, so anything not written to memory is lost.",
    "Keep memory coherent and organized: update or delete stale files rather than piling up new ones, and do not store secrets or sensitive personal data."
].join(" ")

export class MemoryOutput extends Output<MemoryConfig> {
    constructor() {
        super(OutputConfigType.MEMORY, [{ tool: memoryTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Memory", validateACL: unrestricted }])
    }

    async validateConfig(_output: MemoryConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: MemoryConfig): Promise<void> {}

    protected getSystemInstructionsForConfigs(_configs: MemoryConfig[]): string {
        return MEMORY_SYSTEM_INSTRUCTIONS
    }
}
