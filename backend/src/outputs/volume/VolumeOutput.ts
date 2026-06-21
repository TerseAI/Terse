import { OutputConfigType } from "@prisma/client"
import { VolumeConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"
import { unrestricted } from "../abstract/acl"

import { volumeDeleteFileTool, volumeListFilesTool, volumeReadFileTool, volumeWriteFileTool } from "./tools/volumeTools"

export class VolumeOutput extends Output<VolumeConfig> {
    constructor() {
        super(OutputConfigType.VOLUME, [
            { tool: volumeListFilesTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "List volume files", validateACL: unrestricted },
            { tool: volumeReadFileTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Read volume file", validateACL: unrestricted },
            { tool: volumeWriteFileTool, isReadOnly: false, integration: IntegrationType.TERSE, displayName: "Write volume file", validateACL: unrestricted },
            { tool: volumeDeleteFileTool, isReadOnly: false, integration: IntegrationType.TERSE, displayName: "Delete volume file", validateACL: unrestricted }
        ])
    }

    async validateConfig(_output: VolumeConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: VolumeConfig): Promise<void> {}

    protected getSystemInstructionsForConfigs(_configs: VolumeConfig[]): string {
        return [
            "AGENT VOLUME:",
            "- You have access to a persistent shared volume for this agent.",
            "- Use volume_list_files, volume_read_file, volume_write_file, and volume_delete_file.",
            "- Paths are relative to the volume root; you cannot access other agents' volumes."
        ].join("\n")
    }
}
