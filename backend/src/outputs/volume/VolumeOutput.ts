import { OutputConfigType } from "@prisma/client"
import { VolumeConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { fileTool } from "./tools/fileTool"

export class VolumeOutput extends Output<VolumeConfig> {
    constructor() {
        super(OutputConfigType.VOLUME, [{ tool: fileTool, isReadOnly: false, integration: IntegrationType.TERSE, displayName: "File", validateACL: unrestricted }])
    }

    async validateConfig(_output: VolumeConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: VolumeConfig): Promise<void> {}

    protected getSystemInstructionsForConfigs(_configs: VolumeConfig[]): string {
        return [
            "AGENT FILES:",
            "- You have a persistent file store for this agent.",
            "- Use the `file` tool with command: list, read, write, or delete.",
            "- Paths are relative to the storage root; you cannot access other agents' files."
        ].join("\n")
    }
}
