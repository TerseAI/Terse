import { Tool } from "@openai/agents-core";
import { RunContext, tool } from "@openai/agents";
import ChatInterface from "./ChatInterface";
import { z } from "zod";
import { Channel } from "../../shared/types";
import { IntegrationType } from "../../shared/Integrations";
import { ConfigType } from "../../shared/Configs";

export function buildChatAgentTools(chatInterface: ChatInterface): Tool<void>[] {
    return [
        tool({
            name: 'buildPreview',
            description: 'Build a preview of the draft',
            parameters: z.object({
                draft: z.string().describe('The draft to build a preview of'),
            }),
            execute: async ({ draft }: { draft: string }, runContext?: RunContext<void>): Promise<string> => {
                return await chatInterface.buildPreview(parseChannel(draft));
            },
        }),
        tool({
            name: 'promptForIntegration',
            description: 'Prompt for an integration',
            parameters: z.object({
                integration: z.nativeEnum(IntegrationType).describe('The integration to prompt for'),
            }),
            execute: async ({ integration }: { integration: IntegrationType }, runContext?: RunContext<void>): Promise<string> => {
                return await chatInterface.promptForIntegration(integration);
            },
        }),
        tool({
            name: 'promptForConfig',
            description: 'Prompt for a config',
            parameters: z.object({
                config: z.string().describe('The config to prompt for'),
            }),
            execute: async ({ config }: { config: string }, runContext?: RunContext<void>): Promise<string> => {
                return await chatInterface.promptForConfig(parseConfig(config));
            },
        }),
    ];
}

function parseChannel(draft: string): Channel {
    return JSON.parse(draft) as Channel;
}

function parseConfig(config: string): ConfigType {
    return config as ConfigType;
}