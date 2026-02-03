import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import logger from "../../../logger";
import { IntegrationType } from "../../../shared/Integrations";
import { RunHistoryActionType } from "@prisma/client";
import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner";
import { Session } from "../../../types/session";
import { getPosthogApiKeyByIntegrationId } from "../posthogApiClient";
import { ToolName } from "../../../tools/ToolNames";

/**
 * Tool for querying PostHog analytics events.
 * This tool queries tracked events like pageviews, custom events, identifies, etc.
 */
export const searchEventsTool = tool({
    name: ToolName.POSTHOG_SEARCH_EVENTS,
    description: 'Query PostHog analytics events (pageviews, custom events, identifies, etc.). Use this to investigate user behavior, track feature usage, analyze funnels, or find specific events. Can filter by event name (e.g., "$pageview", "$identify", or custom event names), user email, and date range. Returns events with their properties and timestamps.',
    parameters: z.object({
        integrationId: z.string().describe('The integration ID of the PostHog knowledge base to use.'),
        projectId: z.string().describe('The PostHog project ID.'),
        eventName: z.union([z.string(), z.null()]).optional().describe('Optional: Filter by event name (e.g., "$pageview", "$identify", "user_signed_up", or any custom event name). If not provided, returns all event types.'),
        userEmail: z.union([z.string(), z.null()]).optional().describe('Optional: Filter events by user email address.'),
        propertyFilters: z.union([z.array(z.object({
            key: z.string().describe('The property key to filter on (e.g., "$current_url", "$browser", or custom property)'),
            value: z.union([z.string(), z.number(), z.boolean()]).describe('The value to match'),
            operator: z.enum(['exact', 'is_not', 'icontains', 'not_icontains', 'regex', 'not_regex', 'gt', 'lt', 'gte', 'lte']).optional().describe('Comparison operator (default: "exact")')
        })), z.null()]).optional().describe('Optional: Array of property filters to narrow down results.'),
        limit: z.number().default(50).describe('Maximum number of events to return (default: 50, max: 100)'),
        offset: z.number().default(0).describe('Offset for pagination (default: 0). Use with limit to page through results.'),
        last7Days: z.boolean().default(true).describe('If true, filters events from the last 7 days only (default: true).'),
        dateFrom: z.union([z.string(), z.null()]).optional().describe('Start date for filtering (ISO format like "2024-01-15" or relative like "-7d"). If not provided and last7Days is true, defaults to 7 days ago.'),
        dateTo: z.union([z.string(), z.null()]).optional().describe('End date for filtering (ISO format or relative like "now"). If not provided, defaults to now.'),
    }),
    execute: async ({ integrationId, projectId, eventName, userEmail, propertyFilters, limit = 50, offset = 0, last7Days = true, dateFrom, dateTo }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const posthogApiKey = await getPosthogApiKeyByIntegrationId(integrationId, runContext.context.user.id);
        if (!posthogApiKey) {
            throw new Error(`PostHog integration not found or access denied for integrationId: ${integrationId}`);
        }

        const posthogHost = 'https://us.posthog.com';

        // Normalize null to undefined
        const normalizedEventName = eventName ?? undefined;
        const normalizedUserEmail = userEmail ?? undefined;
        const normalizedPropertyFilters = propertyFilters ?? undefined;

        try {
            // Calculate date filters
            let dateFromValue = dateFrom ?? undefined;
            let dateToValue = dateTo ?? undefined;

            // Default to last 7 days if last7Days is true and dateFrom is not provided
            if (last7Days && !dateFromValue) {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                dateFromValue = sevenDaysAgo.toISOString().split('T')[0];
            }

            logger.info('Querying PostHog events', {
                eventName: normalizedEventName,
                userEmail: normalizedUserEmail,
                projectId,
                limit,
                offset,
                dateFrom: dateFromValue,
                dateTo: dateToValue
            });

            // If user email is provided, first find the person
            let personId: string | undefined;
            let distinctId: string | undefined;

            if (normalizedUserEmail) {
                const personsUrl = `${posthogHost}/api/projects/${projectId}/persons/?email=${encodeURIComponent(normalizedUserEmail)}`;

                const personsResponse = await fetch(personsUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${posthogApiKey}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (personsResponse.ok) {
                    const personsData = await personsResponse.json();
                    const persons = Array.isArray(personsData) ? personsData : (personsData.results || []);

                    if (persons.length > 0) {
                        const person = persons[0];
                        personId = person.id || person.uuid;
                        distinctId = person.distinct_ids?.[0] || normalizedUserEmail;
                    }
                }
            }

            // Build query parameters for events endpoint
            const params = new URLSearchParams({
                limit: Math.min(limit, 100).toString(),
                offset: offset.toString(),
                orderBy: JSON.stringify(['-timestamp']),
            });

            // Add event name filter
            if (normalizedEventName) {
                params.append('event', normalizedEventName);
            }

            // Add person filter if found
            if (distinctId) {
                params.append('distinct_id', distinctId);
            }

            // Add date filters
            if (dateFromValue) {
                params.append('after', dateFromValue);
            }
            if (dateToValue) {
                params.append('before', dateToValue);
            }

            // Add property filters
            if (normalizedPropertyFilters && normalizedPropertyFilters.length > 0) {
                const properties = normalizedPropertyFilters.map(filter => ({
                    key: filter.key,
                    value: filter.value,
                    operator: filter.operator || 'exact',
                    type: 'event'
                }));
                params.append('properties', JSON.stringify(properties));
            }

            const eventsUrl = `${posthogHost}/api/projects/${projectId}/events/?${params.toString()}`;

            const eventsResponse = await fetch(eventsUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${posthogApiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!eventsResponse.ok) {
                const errorText = await eventsResponse.text();
                logger.error('PostHog events API error', {
                    status: eventsResponse.status,
                    error: errorText,
                    eventName: normalizedEventName,
                    userEmail: normalizedUserEmail,
                    projectId
                });

                if (eventsResponse.status === 401) {
                    throw new Error('PostHog API key is invalid or expired. Please update your PostHog integration.');
                } else if (eventsResponse.status === 403) {
                    throw new Error('PostHog API key does not have events:read permission. Please ensure your API key has the correct scope.');
                } else if (eventsResponse.status === 404) {
                    throw new Error(`PostHog project ${projectId} not found. Please verify the project ID in your configuration.`);
                }

                throw new Error(`Failed to query PostHog events: ${errorText}`);
            }

            const eventsData = await eventsResponse.json();

            // Extract events from response
            const events = Array.isArray(eventsData)
                ? eventsData
                : (eventsData.results || eventsData.data || eventsData.events || []);

            // Get pagination metadata
            const totalCount = eventsData.count || events.length;
            const hasNext = eventsData.next ? true : events.length === Math.min(limit, 100);

            // Format results
            const formattedEvents = events.map((event: any) => ({
                id: event.id || event.uuid,
                event: event.event,
                timestamp: event.timestamp || event.created_at,
                distinctId: event.distinct_id,
                properties: event.properties || {},
                personId: event.person?.id || event.person_id,
                url: event.properties?.$current_url || event.properties?.url,
            }));

            // Build link to events UI
            const eventsLink = normalizedEventName
                ? `${posthogHost}/project/${projectId}/events?eventFilter=${encodeURIComponent(normalizedEventName)}`
                : `${posthogHost}/project/${projectId}/events`;

            // Build filter description for the response message
            const filterDescriptions: string[] = [];
            if (normalizedEventName) {
                filterDescriptions.push(`event="${normalizedEventName}"`);
            }
            if (normalizedUserEmail) {
                filterDescriptions.push(`user="${normalizedUserEmail}"`);
            }
            if (normalizedPropertyFilters && normalizedPropertyFilters.length > 0) {
                filterDescriptions.push(`${normalizedPropertyFilters.length} property filter(s)`);
            }
            const filterDescription = filterDescriptions.length > 0
                ? filterDescriptions.join(', ')
                : 'all events';

            const response = {
                success: true,
                eventName: normalizedEventName || null,
                userEmail: normalizedUserEmail || null,
                projectId,
                totalEvents: totalCount,
                events: formattedEvents,
                eventsLink,
                pagination: {
                    limit: Math.min(limit, 100),
                    offset,
                    hasMore: hasNext,
                    nextOffset: hasNext ? offset + formattedEvents.length : null,
                    showing: `${offset + 1}-${offset + formattedEvents.length}`,
                },
                message: `Found ${formattedEvents.length} event(s) for ${filterDescription} (showing ${offset + 1}-${offset + formattedEvents.length}${hasNext ? ', more available' : ''}). View events: ${eventsLink}`
            };

            // Return action as part of the result
            const eventDesc = normalizedEventName ? ` matching "${normalizedEventName}"` : '';
            const userDesc = normalizedUserEmail ? ` for ${normalizedUserEmail}` : '';
            const action = {
                action: 'Searched PostHog events',
                integration: IntegrationType.POSTHOG,
                target: projectId,
                details: `Searched analytics events${eventDesc}${userDesc}: Found ${formattedEvents.length} event(s)${dateFromValue ? ` from ${dateFromValue}` : ''}`,
                url: eventsLink,
                type: RunHistoryActionType.read,
                isReadOnly: true,
            };

            return {
                ...response,
                actions: [action],
            };
        } catch (error: any) {
            logger.error('Error querying PostHog events', { error, eventName: normalizedEventName, userEmail: normalizedUserEmail, projectId });
            throw new Error(`Failed to query PostHog events: ${error.message || 'Unknown error'}`);
        }
    },
});
