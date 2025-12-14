import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import chalk from "chalk";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { NotionPageSession } from "../NotionPageOutput";
import { db } from "../../../prismaClient";
import { requireHydrator } from "../../../rag/HydratorRegistry";
import { HydratorType, HydratorTypeMap, requireHydratorType } from "../../../types/rag";
import { Identifiable } from "../../../rag/Hydrator";

/**
 * Union type of all possible hydrated events
 */
type HydratedEvent = HydratorTypeMap[HydratorType];

/**
 * Fetches events that are related to a specific Notion block.
 * This provides context about what source events caused this block to be created/modified.
 *
 * IMPORTANT: This tool should be called BEFORE modifying a block to understand
 * the context and avoid recency bias.
 */
export const fetchRelatedEventsTool = tool({
    name: 'notion_fetch_related_events',
    description: `Fetch source events that are related to a specific Notion block. This provides important context about what caused the block to be created or modified.

CRITICAL: You MUST call this tool before calling notion_modify_blocks to understand the context and avoid recency bias. The events returned will help you make informed decisions about how to modify the block.

Use this when:
- Before updating an existing block to understand what information it contains
- Before deleting a block to know what events it represents
- Before moving a block to understand its relationship to source events

The tool returns the source events (e.g., Slack messages, emails) that led to this block's creation or modification.`,
    parameters: z.object({
        block_id: z.string().describe('The Notion block ID to fetch related events for'),
    }),
    execute: async ({ block_id }, runContext?: RunContext<SessionWithTracking<NotionPageSession>>) => {
        console.log(chalk.bgCyan.white.bold('🔍 Fetching related events for block'));
        console.log(chalk.cyan('  Block ID: '), chalk.greenBright(block_id));

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const userId = runContext.context.user.id;

        try {
            // Query output_change_attributions to find source events for this block
            const attributions = await db().output_change_attributions.findMany({
                where: {
                    output_item_id: block_id,
                },
                include: {
                    source_item_ref: true,
                },
            });

            if (attributions.length === 0) {
                console.log(chalk.yellow('  No related events found for this block'));
                return {
                    success: true,
                    events_count: 0,
                    message: 'No related events found for this block. It may have been created manually or the attributions were not tracked.',
                };
            }

            console.log(chalk.cyan(`  Found ${attributions.length} attribution(s)`));

            // Extract unique identifiable references (using included relation)
            const identifiableRefs: Identifiable[] = attributions
                .map(attr => {
                    const identifiableRef = attr.source_item_ref;
                    if (!identifiableRef) {
                        return null;
                    }
                    return {
                        entityType: requireHydratorType(identifiableRef.entity_type),
                        entityId: identifiableRef.entity_id
                    };
                })
                .filter((ref): ref is Identifiable => ref !== null);

            // Group by entity type to hydrate efficiently
            const groupedByType = identifiableRefs.reduce((acc, ref) => {
                if (!acc[ref.entityType]) {
                    acc[ref.entityType] = [];
                }
                acc[ref.entityType].push(ref);
                return acc;
            }, {} as Record<HydratorType, Identifiable[]>);

            // Hydrate all events
            const hydratedEvents: HydratedEvent[] = [];
            for (const [entityType, refs] of Object.entries(groupedByType)) {
                try {
                    const hydrator = requireHydrator(requireHydratorType(entityType), { userId });
                    const events = await hydrator.hydrateBulk(refs);
                    hydratedEvents.push(...events);
                } catch (error) {
                    console.error(chalk.yellow(`  Failed to hydrate ${entityType}:`), error);
                    // Continue with other types
                }
            }

            const formattedEvents = hydratedEvents.map((event, index) => {
                if ('formatForChannelAgent' in event && typeof event.formatForChannelAgent === 'function') {
                    return `Event ${index + 1}:\n${event.formatForChannelAgent()}`;
                }

                return `Event ${index + 1}:\n${JSON.stringify(event, null, 2)}`;
            });

            const eventsText = formattedEvents.join('\n\n---\n\n');

            console.log(chalk.green(`  ✓ Successfully fetched and formatted ${hydratedEvents.length} event(s)`));

            return {
                success: true,
                events_count: hydratedEvents.length,
                events: eventsText,
                message: `Found ${hydratedEvents.length} related event(s). These events provide context about why this block was created or modified. Use this information to make informed decisions about modifications.`,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(chalk.red('  ✗ Error fetching related events:'), error);
            return {
                success: false,
                error: errorMessage,
                hint: 'Failed to fetch related events. The block may still be modified, but without historical context.',
            };
        }
    }
});

