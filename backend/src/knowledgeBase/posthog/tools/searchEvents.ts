import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger.js";
import { IntegrationType } from "../../../shared/Integrations.js";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner.js";
import { Session } from "../../../types/session";
import { getPosthogApiKeyByIntegrationId } from "../posthogApiClient.js";
import { ToolName } from "../../../tools/ToolNames.js";

/**
 * Tool for querying PostHog analytics events (custom events tracked via posthog.capture()).
 * This is similar to the "Explore Events" feature in the PostHog UI.
 */
export const searchEventsTool = tool({
    name: ToolName.POSTHOG_SEARCH_EVENTS,
    description: 'Query PostHog analytics events (custom events tracked via posthog.capture()). Returns events data and a link to view events in PostHog. You can filter by event name, user email/distinct ID, date range, and properties. Use this to investigate user behavior, track feature usage, or analyze custom events. This is different from logs - these are product analytics events like "user_signed_up", "button_clicked", "feature_used", etc.',
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the PostHog knowledge base to use.'),
        projectId: z.string().describe('The PostHog project ID.'),
        canReadEvents: z.boolean().default(false).describe('Whether events access is enabled for this knowledge base.'),
        eventName: z.union([z.string(), z.null()]).optional().describe('Optional: Filter by specific event name (e.g., "user_signed_up", "$pageview", "button_clicked"). If not provided, returns all events.'),
        distinctId: z.union([z.string(), z.null()]).optional().describe('Optional: Filter by user distinct ID (usually user ID or anonymous ID).'),
        personEmail: z.union([z.string(), z.null()]).optional().describe('Optional: Filter by person email (if person properties include email).'),
        properties: z.union([z.record(z.any()), z.null()]).optional().describe('Optional: Filter by event properties (e.g., {"$browser": "Chrome", "plan": "pro"}).'),
        limit: z.number().default(50).describe('Maximum number of events to return (default: 50, max: 100)'),
        offset: z.number().default(0).describe('Offset for pagination (default: 0).'),
        last7Days: z.boolean().default(true).describe('If true (default), filters events from the last 7 days. Set to false to use dateFrom/dateTo for custom range.'),
        dateFrom: z.union([z.string(), z.null()]).optional().describe('Start date for filtering (ISO format like "2024-01-01" or relative like "-7d", "-30d"). Overrides last7Days if provided.'),
        dateTo: z.union([z.string(), z.null()]).optional().describe('End date for filtering (ISO format or "now"). Defaults to now.'),
    }),
    execute: async ({ integrationId, projectId, canReadEvents, eventName, distinctId, personEmail, properties, limit = 50, offset = 0, last7Days = true, dateFrom, dateTo }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        if (canReadEvents !== true) {
            throw new Error("PostHog events access is not enabled for this knowledge base.");
        }

        const posthogApiKey = await getPosthogApiKeyByIntegrationId(integrationId, runContext.context.user.id);
        if (!posthogApiKey) {
            throw new Error(`PostHog integration not found or access denied for integrationId: ${integrationId}`);
        }

        const posthogHost = 'https://us.posthog.com';

        try {
            // Calculate date filters
            let dateFromValue: string | null = dateFrom ?? null;
            if (last7Days && !dateFromValue) {
                dateFromValue = '-7d';
            }

            logger.info('Querying PostHog events', {
                eventName,
                distinctId,
                personEmail,
                projectId,
                limit,
                offset,
                dateFrom: dateFromValue
            });

            // Build HogQL query for events
            // PostHog's events query API uses HogQL
            const eventsQueryUrl = `${posthogHost}/api/projects/${projectId}/query/`;

            // Build WHERE clauses
            const whereConditions: string[] = [];

            if (eventName) {
                whereConditions.push(`event = '${eventName.replace(/'/g, "''")}'`);
            }

            if (distinctId) {
                whereConditions.push(`distinct_id = '${distinctId.replace(/'/g, "''")}'`);
            }

            if (personEmail) {
                // Person email is stored in person properties
                whereConditions.push(`person.properties.email = '${personEmail.replace(/'/g, "''")}'`);
            }

            // Add property filters
            if (properties && typeof properties === 'object') {
                for (const [key, value] of Object.entries(properties)) {
                    if (typeof value === 'string') {
                        whereConditions.push(`properties.${key} = '${value.replace(/'/g, "''")}'`);
                    } else if (typeof value === 'number' || typeof value === 'boolean') {
                        whereConditions.push(`properties.${key} = ${value}`);
                    }
                }
            }

            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            // Build HogQL query
            const hogqlQuery = `
                SELECT
                    uuid,
                    event,
                    distinct_id,
                    timestamp,
                    properties,
                    person.properties as person_properties
                FROM events
                ${whereClause}
                ORDER BY timestamp DESC
                LIMIT ${Math.min(limit, 100)}
                OFFSET ${offset}
            `;

            const requestBody = {
                query: {
                    kind: 'HogQLQuery',
                    query: hogqlQuery,
                    filters: {
                        dateRange: {
                            date_from: dateFromValue,
                            date_to: dateTo ?? null,
                        },
                    },
                },
            };

            const fetchResponse = await fetch(eventsQueryUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${posthogApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text();
                logger.error('PostHog events API error', {
                    status: fetchResponse.status,
                    error: errorText,
                    eventName,
                    distinctId,
                    projectId
                });

                if (fetchResponse.status === 401) {
                    throw new Error('PostHog API key is invalid or expired. Please update your PostHog integration.');
                } else if (fetchResponse.status === 403) {
                    throw new Error('PostHog API key does not have events access permission.');
                } else if (fetchResponse.status === 404) {
                    throw new Error(`PostHog project ${projectId} not found. Please verify the project ID in your configuration.`);
                }

                throw new Error(`Failed to query PostHog events: ${errorText}`);
            }

            const responseData = await fetchResponse.json();

            // Parse HogQL response
            // HogQL responses have columns and results arrays
            const columns = responseData.columns || [];
            const results = responseData.results || [];

            // Map column names to indices
            const columnIndices: Record<string, number> = {};
            columns.forEach((col: string, index: number) => {
                columnIndices[col] = index;
            });

            // Format events
            const formattedEvents = results.map((row: any[]) => {
                const event: Record<string, any> = {
                    id: row[columnIndices['uuid']],
                    event: row[columnIndices['event']],
                    distinctId: row[columnIndices['distinct_id']],
                    timestamp: row[columnIndices['timestamp']],
                    properties: row[columnIndices['properties']] || {},
                    personProperties: row[columnIndices['person_properties']] || {},
                };
                return event;
            });

            // Build link to events UI
            const eventsLink = eventName
                ? `${posthogHost}/project/${projectId}/events?eventType=${encodeURIComponent(eventName)}`
                : `${posthogHost}/project/${projectId}/events`;

            // Determine if there are more results available
            const hasMore = formattedEvents.length === Math.min(limit, 100);
            const nextOffset = hasMore ? offset + formattedEvents.length : null;

            // Build filter description for the response message
            const filterDescriptions: string[] = [];
            if (eventName) {
                filterDescriptions.push(`event="${eventName}"`);
            }
            if (distinctId) {
                filterDescriptions.push(`distinctId="${distinctId}"`);
            }
            if (personEmail) {
                filterDescriptions.push(`personEmail="${personEmail}"`);
            }
            if (properties && Object.keys(properties).length > 0) {
                filterDescriptions.push(`properties=${JSON.stringify(properties)}`);
            }
            const filterDescription = filterDescriptions.length > 0
                ? filterDescriptions.join(', ')
                : 'no filters (all events)';

            // Count events by type for summary
            const eventsByName: Record<string, number> = {};
            formattedEvents.forEach((event: any) => {
                const name = event.event || 'unknown';
                eventsByName[name] = (eventsByName[name] || 0) + 1;
            });
            const eventSummary = Object.entries(eventsByName)
                .map(([name, count]) => `${count} ${name}`)
                .join(', ');

            const response = {
                success: true,
                eventName: eventName || null,
                distinctId: distinctId || null,
                personEmail: personEmail || null,
                projectId,
                totalEvents: formattedEvents.length,
                events: formattedEvents,
                eventsByName,
                eventsLink,
                pagination: {
                    limit: Math.min(limit, 100),
                    offset,
                    hasMore,
                    nextOffset,
                    showing: `${offset + 1}-${offset + formattedEvents.length}`,
                },
                message: `Found ${formattedEvents.length} event${formattedEvents.length !== 1 ? 's' : ''} (${eventSummary || 'none'}) filtered by ${filterDescription} (showing ${offset + 1}-${offset + formattedEvents.length}${hasMore ? ', more available' : ''}). View events: ${eventsLink}`
            };

            // Return action as part of the result
            const action = {
                action: 'Searched PostHog events',
                integration: IntegrationType.POSTHOG,
                target: projectId,
                details: `Searched analytics events: Found ${formattedEvents.length} event(s)${eventName ? ` of type "${eventName}"` : ''}${dateFromValue ? ` from ${dateFromValue}` : ''}`,
                url: eventsLink,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            };

            return {
                ...response,
                actions: [action],
            };
        } catch (error: any) {
            logger.error('Error querying PostHog events', { error, eventName, distinctId, projectId });
            throw new Error(`Failed to query PostHog events: ${error.message || 'Unknown error'}`);
        }
    },
});
