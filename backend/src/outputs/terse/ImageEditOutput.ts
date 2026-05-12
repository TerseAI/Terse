import { OutputConfigType } from "@prisma/client"
import { ImageEditConfig } from "terse-types"
import { IntegrationType } from "terse-types"
import { ToolName } from "terse-types"

import { PrismaTransaction } from "../../types/prisma"
import { Output, ToolACLValidator, defineToolEntry } from "../abstract/Output"

import { imageEditTool } from "./tools/editImage"

export class ImageEditOutput extends Output<ImageEditConfig> {
    constructor() {
        const t = defineToolEntry<ImageEditConfig>()
        const toolbox = [t({ tool: imageEditTool, isReadOnly: true, integration: IntegrationType.TERSE, displayName: "Edit Image", validateACL: validateImageEdit })]
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

type ImageEditACL<TName extends ToolName> = ToolACLValidator<TName, ImageEditConfig>

const validateImageEdit: ImageEditACL<"image_edit"> = _params => ({ ok: true as const })
