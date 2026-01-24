import { Tool } from "@openai/agents";
import { webSearchTool } from "@openai/agents";
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma";
import { Output, ToolboxEntry } from "../abstract/Output";
import { OutputConfigType } from "@prisma/client";
import { IntegrationType } from "../../shared/Integrations";
import { ConfigInstance } from "../../shared/Configs";


export class TerseSkillsOutput extends Output<ConfigInstance> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: webSearchTool({
                    searchContextSize: 'medium',
                }) as Tool,
                isReadOnly: true,
                integration: IntegrationType.TERSE,
                displayName: 'Web Search',
            }
        ];
        super(OutputConfigType.TERSE, toolbox);
    }

    async validateConfig(_output: ConfigInstance, _userId: string): Promise<void> {
        // No validation needed - this output has no config
    }

    async addOutputToAgent(_tx: PrismaTransaction, _agentOutputId: string, _output: ConfigInstance): Promise<void> {
        // No database records needed - this is always available
    }

    protected getSystemInstructionsForConfigs(_configs: AgentOutputWithConfigs[]): string {
        // No system instructions needed - these are always available skills
        return '';
    }
}
