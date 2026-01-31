import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner";
import { AttributionStore } from "../../../rag/AttributionStore";
import logger from "../../../logger";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { Session } from "../../../server";
import { ToolName } from "../../../tools/ToolNames";

/**
 * Fetches events that are related to a specific Notion block.
 * This provides context about what source events caused this block to be created/modified.
 *
 * IMPORTANT: This tool should be called BEFORE modifying a block to understand
 * the context and avoid recency bias.
 */
export const fetchRelatedEventsTool = tool({
    name: ToolName.NOTION_FETCH_RELATED_EVENTS,
    description: `Fetch source events that are related to a specific Notion block. This provides important context about what caused the block to be created or modified.

CRITICAL: You MUST call this tool before calling notion_modify_blocks to understand the context and avoid recency bias. The events returned will help you make informed decisions about how to modify the block.

Use this when:
- Before updating an existing block to understand what information it contains
- Before deleting a block to know what events it represents
- Before moving a block to understand its relationship to source events

The tool returns the source events (e.g., Slack messages, emails) that led to this block's creation or modification.`,
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the Notion workspace to use.'),
        pageId: z.string().describe('The Notion page ID (not used directly, but required for consistency).'),
        block_id: z.string().describe('The Notion block ID to fetch related events for'),
    }),
    execute: async ({ integrationId, pageId, block_id }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.info('Fetching related events for block and user', { block_id, userId: runContext?.context?.user.displayName });

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const userId = runContext.context.user.id;

        try {
            // Use AttributionStore to fetch and hydrate related events
            const attributionStore = new AttributionStore({ userId });
            const hydratedEvents = await attributionStore.fetchAttributionsForOutputItem(block_id);

            if (hydratedEvents.length === 0) {
                logger.info('No related events found for this block', { block_id, userId: runContext?.context?.user.displayName });
                return {
                    success: true,
                    events_count: 0,
                    message: 'No related events found for this block. It may have been created manually or the attributions were not tracked.',
                };
            }

            logger.info('Found related events', { block_id, userId: runContext?.context?.user.displayName, events_count: hydratedEvents.length });

            const formattedEvents = hydratedEvents.map((event, index) => {
                if ('formatForAgentRunner' in event && typeof event.formatForAgentRunner === 'function') {
                    return `Event ${index + 1}:\n${event.formatForAgentRunner()}`;
                }

                return `Event ${index + 1}:\n${JSON.stringify(event, null, 2)}`;
            });

            const eventsText = formattedEvents.join('\n\n---\n\n');

            logger.info('Successfully fetched and formatted events', { block_id, userId: runContext?.context?.user.displayName, events_count: hydratedEvents.length });

            // Return action as part of the result
            const action = {
                action: 'Fetched related events',
                integration: IntegrationType.NOTION,
                target: block_id,
                details: `Retrieved ${hydratedEvents.length} related event(s) for Notion block${hydratedEvents.length === 0 ? ' (no events found)' : ''}`,
                url: undefined,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            };

            return {
                success: true,
                events_count: hydratedEvents.length,
                actions: [action],
                events: eventsText,
                message: `Found ${hydratedEvents.length} related event(s). These events provide context about why this block was created or modified. Use this information to make informed decisions about modifications.`,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Error fetching related events', { block_id, userId: runContext?.context?.user.displayName, error });
            return {
                success: false,
                error: errorMessage,
                hint: 'Failed to fetch related events. The block may still be modified, but without historical context.',
            };
        }
    }
});

