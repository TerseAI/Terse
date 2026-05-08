import { OutputConfigType } from "@prisma/client"
import { ImageEditConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { defineToolboxEntry, Output } from "../abstract/Output"

import { validateImageEditCapabilityACL } from "./acl"
import { imageEditTool } from "./tools/editImage"

export class ImageEditOutput extends Output<ImageEditConfig> {
    constructor() {
        const toolbox = [
            defineToolboxEntry({
                tool: imageEditTool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: "Edit Image",
                validateACL: validateImageEditCapabilityACL
            })
        ]
        super(OutputConfigType.IMAGE_EDIT, toolbox)
    }

    async validateConfig(_output: ImageEditConfig, _userId: string): Promise<void> {}

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: ImageEditConfig): Promise<void> {}

    protected getDummyConfigForCapability(): ImageEditConfig {
        return new ImageEditConfig()
    }

    protected getSystemInstructionsForConfigs(_configs: ImageEditConfig[]): string {
        return ""
    }
}
