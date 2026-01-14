import { Tool } from "@openai/agents-core";
import { RunContext, tool } from "@openai/agents";
import ChatInterface from "./ChatInterface";
import { z } from "zod";
import { Channel } from "../../shared/types";
import { IntegrationType } from "../../shared/Integrations";
import { ConfigType } from "../../shared/Configs";
import { getConfigSearchProvider } from "../../integrations/abstract/ConfigSearchHelpers";
import logger from "../../logger";

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
            name: 'searchConfigOptions',
            description: 'Search for available options when configuring an integration (e.g., Slack channels, GitHub repos, Notion pages). Use this when the user mentions specific names or when you need to show them options to choose from.',
            parameters: z.object({
                configType: z.nativeEnum(ConfigType).describe('The config type to search for'),
                integrationId: z.string().describe('The integration ID to search within'),
                searchQuery: z.string().nullish().describe('Search term (e.g., channel name, repo name, page title). Leave empty to list all options.'),
                page: z.number().nullish().describe('Page number for pagination (starts at 1). Defaults to 1 if not provided.'),
            }),
            execute: async ({ configType, integrationId, searchQuery, page }: { configType: ConfigType; integrationId: string; searchQuery?: string | null; page?: number | null }, runContext?: RunContext<void>): Promise<string> => {
                try {
                    const provider = getConfigSearchProvider(configType, integrationId);
                    if (!provider) {
                        return `No search provider available for ${configType}. This config type may not support searching.`;
                    }

                    const result = await provider.searchConfigOptions({
                        configType,
                        integrationId,
                        searchQuery: searchQuery ?? undefined,
                        page: page ?? 1,
                        limit: 20, // Reasonable default for chat
                    });

                    if (result.results.length === 0) {
                        return `No results found${searchQuery ? ` for "${searchQuery}"` : ''}.`;
                    }

                    const resultsText = result.results.map((r, i) => {
                        const parts = [`${i + 1}. ${r.label}`];
                        if (r.description) {
                            parts.push(`   ${r.description}`);
                        }
                        if (r.metadata) {
                            const metaParts: string[] = [];
                            if (r.metadata.channelType) metaParts.push(`Type: ${r.metadata.channelType}`);
                            if (r.metadata.private !== undefined) metaParts.push(`Private: ${r.metadata.private}`);
                            if (r.metadata.email) metaParts.push(`Email: ${r.metadata.email}`);
                            if (metaParts.length > 0) {
                                parts.push(`   (${metaParts.join(', ')})`);
                            }
                        }
                        parts.push(`   ID: ${r.id}`);
                        return parts.join('\n');
                    }).join('\n\n');

                    const hasMoreText = result.hasMore ? `\n\n... and ${result.totalCount ? result.totalCount - result.results.length : 'more'} more results. Use page ${(page || 1) + 1} to see more.` : '';

                    return `Found ${result.results.length} result(s)${searchQuery ? ` for "${searchQuery}"` : ''}:\n\n${resultsText}${hasMoreText}`;
                } catch (error: any) {
                    logger.error('Error searching config options', { error, configType, integrationId });
                    return `Error searching options: ${error.message || 'Unknown error'}`;
                }
            },
        }),
        tool({
            name: 'validateConfigValue',
            description: 'Validate a specific config value provided by the user (e.g., check if a Slack channel ID exists, if a Figma URL is valid, if a GitHub repo name is accessible). Use this to verify user inputs before using them.',
            parameters: z.object({
                configType: z.nativeEnum(ConfigType).describe('The config type'),
                integrationId: z.string().describe('The integration ID'),
                field: z.string().describe('The field name to validate (e.g., "channelId", "fileKey", "repositoryIds", "pageId")'),
                value: z.union([
                    z.string(),
                    z.number(),
                    z.array(z.string()),
                    z.array(z.number()),
                    z.null(),
                ]).nullish().describe('The value to validate (can be a string, number, array of strings/numbers, or null)'),
            }),
            execute: async ({ configType, integrationId, field, value }: { configType: ConfigType; integrationId: string; field: string; value?: string | number | string[] | number[] | null }, runContext?: RunContext<void>): Promise<string> => {
                if (value === undefined || value === null) {
                    return '❌ No value provided for validation';
                }
                try {
                    const provider = getConfigSearchProvider(configType, integrationId);
                    if (!provider) {
                        return `No validation provider available for ${configType}. This config type may not support validation.`;
                    }

                    const result = await provider.validateConfigValue({
                        configType,
                        integrationId,
                        field,
                        value,
                    });

                    if (result.valid) {
                        const normalizedText = result.normalizedValue !== undefined && result.normalizedValue !== value
                            ? ` (normalized to: ${JSON.stringify(result.normalizedValue)})`
                            : '';
                        const metadataText = result.metadata
                            ? `\nAdditional info: ${JSON.stringify(result.metadata, null, 2)}`
                            : '';
                        return `✅ Valid${normalizedText}.${metadataText}`;
                    } else {
                        return `❌ Invalid: ${result.error || 'Validation failed'}`;
                    }
                } catch (error: any) {
                    logger.error('Error validating config value', { error, configType, integrationId, field });
                    return `Error validating value: ${error.message || 'Unknown error'}`;
                }
            },
        }),
        tool({
            name: 'createChannel',
            description: 'Create a new automation (channel) after all configuration is complete. Use this only after you have collected all required inputs, output, knowledge bases, and prompt, and the user has confirmed the preview looks good.',
            parameters: z.object({
                channel: z.string().describe('The complete channel/automation object as JSON string. Must include: name, inputs (array), output, prompt (with text), and optionally knowledgeBases, isActive, requireApproval'),
            }),
            execute: async ({ channel }: { channel: string }, runContext?: RunContext<void>): Promise<string> => {
                try {
                    const channelObj = parseChannel(channel);
                    return await chatInterface.createChannel(channelObj);
                } catch (error: any) {
                    logger.error('Error creating channel', { error });
                    return `Error creating channel: ${error.message || 'Unknown error'}`;
                }
            },
        }),
    ];
}

function parseChannel(draft: string): Channel {
    return JSON.parse(draft) as Channel;
}
