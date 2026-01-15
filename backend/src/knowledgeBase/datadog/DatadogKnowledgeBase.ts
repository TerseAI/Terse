import { Session } from "../../server";
import { ChannelKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { ConfigInstance, DatadogConfig } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { ToolboxEntry } from "../../outputs/abstract/Output";
import { KnowledgeBase } from "../abstract/KnowledgeBase";
import { searchDatadogLogsTool } from "./tools/searchLogs";
import { searchRumEventsTool } from "./tools/searchRumEvents";
import { db } from "../../prismaClient";
import logger from "../../logger";

/**
 * Session type for Datadog knowledge base.
 * Extends the base Session with Datadog-specific configuration.
 */
export interface DatadogKnowledgeBaseSession extends Session {
    datadogConfig: DatadogConfig;
}

/**
 * Datadog Knowledge Base implementation.
 * Provides tools for querying Datadog logs and RUM events.
 */
export class DatadogKnowledgeBase extends KnowledgeBase<DatadogKnowledgeBaseSession, DatadogConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: searchDatadogLogsTool,
                isReadOnly: true,
                integration: IntegrationType.DATADOG
            },
            {
                tool: searchRumEventsTool,
                isReadOnly: true,
                integration: IntegrationType.DATADOG
            }
        ];

        super(KnowledgeBaseConfigType.DATADOG, toolbox);
    }

    /**
     * Creates a Datadog knowledge base session from the configuration.
     * Loads the Datadog integration and configures the session with credentials.
     */
    async createSessionFromConfig(
        integrationId: string,
        channelKnowledgeBase: ChannelKnowledgeBaseWithConfigs,
        user: User
    ): Promise<DatadogKnowledgeBaseSession> {
        // Load the Datadog integration
        const integration = await db().datadog_integrations.findUnique({
            where: { id: integrationId },
        });

        if (!integration) {
            throw new Error(`Datadog integration not found: ${integrationId}`);
        }

        // Load the Datadog config from the channel knowledge base
        if (!channelKnowledgeBase.datadog_config) {
            throw new Error('Datadog config not found in channel knowledge base');
        }

        const datadogConfig = channelKnowledgeBase.datadog_config;

        // Create the Datadog config instance
        const config = new DatadogConfig(
            integrationId,
            datadogConfig.default_indexes && datadogConfig.default_indexes.length > 0 
                ? datadogConfig.default_indexes 
                : ["main"]
        );

        if (!datadogConfig.can_read_logs) {
            logger.warn('Datadog knowledge base configured but logs read permission is disabled', {
                integrationId
            });
        }

        // Create the session with Datadog config
        const session: DatadogKnowledgeBaseSession = {
            user,
            isUserInitiated: true,
            datadogConfig: config,
        };

        return session;
    }

    async addKnowledgeBaseToChannel(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: DatadogConfig): Promise<void> {
        // Use unchecked input to bypass relation checks
        await tx.automation_datadog_configs.create({
            data: {
                automation_knowledge_base_id: channelKnowledgeBaseId,
                default_indexes: knowledgeBase.defaultIndexes && knowledgeBase.defaultIndexes.length > 0 
                    ? knowledgeBase.defaultIndexes 
                    : ["main"],
                can_read_logs: true,
            }
        });
    }

    /**
     * Returns system instructions for Datadog knowledge base.
     * Provides guidance on when and how to use Datadog tools.
     */
    getSystemInstructions(session: DatadogKnowledgeBaseSession): string {
        const { datadogConfig } = session;
        const sections: string[] = [];

        // Header
        sections.push('=== DATADOG KNOWLEDGE BASE ===');
        sections.push(`Default indexes: ${datadogConfig.defaultIndexes.join(', ')}`);

        // Available tools section
        sections.push(`
AVAILABLE TOOLS:
• searchDatadogLogs: Query Datadog logs with flexible filtering options. 
  Can filter by query string (Datadog log search syntax), indexes, time range, or combinations. 
  Returns log entries with timestamps, status, messages, hosts, services, tags, and custom attributes. 
  Supports pagination (cursor parameter) and sorting.
  USE FOR: Backend/server-side logs, infrastructure logs, application logs, service-level events.

• searchRumEvents: Query Datadog RUM (Real User Monitoring) events with flexible filtering.
  Can filter by query string (Datadog RUM search syntax), time range, or combinations.
  Returns RUM events including sessions, views, actions, errors, resources, and long tasks.
  Supports pagination (cursor parameter) and sorting.
  USE FOR: Frontend/user behavior, browser/mobile app errors, user sessions, page views, 
  user actions (clicks, inputs), frontend performance issues, client-side errors.

WHEN TO USE WHICH TOOL:
- Use searchDatadogLogs for backend issues: API errors, server crashes, database problems, 
  service-to-service communication issues, infrastructure problems.
- Use searchRumEvents for frontend issues: Browser errors, user-reported UI problems, 
  page load issues, frontend performance problems, user journey analysis, client-side crashes.
- Use BOTH when investigating end-to-end issues: Start with RUM events to see what the user 
  experienced, then check logs to find corresponding backend issues. Match timestamps to correlate.

INVESTIGATION STRATEGY:
Investigate like a human engineer would - be thorough and iterative, not superficial.

1. START WITH BROAD QUERIES:
   - Use default indexes for logs unless you know a specific index is needed
   - Start with broader time ranges to capture full context (e.g., "now-1h" or "now-15m")
   - Use simple queries first, then narrow down
   - For RUM events, start with recent time windows (e.g., "now-15m") to see current user activity

2. PAGINATE THROUGH RESULTS:
   - If the first batch doesn't show relevant data, use the cursor to get more
   - Continue until you find relevant evidence OR have reviewed sufficient data
   - The API returns pagination cursors in the response
   - For RUM events, paginate through sessions and views to find patterns

3. USE DATADOG LOG SEARCH SYNTAX (for logs):
   - Exact match: service:web AND @status:error
   - Wildcards: host:web*
   - Negation: -@http.status_code:200
   - Comparison: @duration:>500
   - Multiple values: @http.status_code:(200 OR 404)
   - Grouping: (service:api AND @http.method:GET) OR service:worker

4. USE DATADOG RUM SEARCH SYNTAX (for RUM events):
   - Event types: @type:session, @type:view, @type:action, @type:error, @type:resource, @type:long_task
   - Session filters: @type:session AND @session.type:user
   - View filters: @type:view AND @view.name:/dashboard
   - Error filters: @type:error AND @error.source:network
   - User filters: @usr.email:user@example.com
   - Multiple conditions: @type:error AND @error.source:(console OR network)
   - Example: @type:view AND @view.url:*checkout* AND @view.loading_time:>3000

5. FILTER BY TIME RANGES:
   - Use ISO8601 format for precise time filtering
   - Example: from="2020-09-17T11:48:36+01:00", to="2020-09-17T12:48:36+01:00"
   - Or use relative times like "now-1h" or "now-15m" for the from parameter
   - For RUM events, relative times are often more useful for recent user activity

6. CROSS-REFERENCE DATA:
   - Look for patterns across multiple log entries or RUM events
   - Match timestamps between RUM events and logs to find correlations
   - If a RUM error occurred at time T, check logs around time T for backend issues
   - If logs show an API error, check RUM events around that time to see user impact
   - Check tags and custom attributes for context

7. UNDERSTAND RUM EVENT TYPES:
   - session: User session data (session ID, type, duration, replay availability)
   - view: Page/view information (view name, URL, load time, time spent)
   - action: User actions (clicks, inputs, custom actions)
   - error: Frontend errors (JavaScript errors, network errors, source, stack traces)
   - resource: Network resources (API calls, images, scripts, status codes, durations)
   - long_task: Long-running tasks that block the main thread (performance issues)

8. KNOW WHEN TO STOP:
   - You've reviewed data across the relevant timeframe
   - You've checked multiple indexes (for logs) or event types (for RUM)
   - You've cross-referenced between RUM events and logs if investigating end-to-end issues
   - If still no smoking gun, report what you searched and what you ruled out

CITING EVIDENCE:
Every claim MUST be backed by specific, verifiable references.

When citing LOG evidence:
- Include the exact timestamp (e.g., "At 2020-05-26T13:36:14Z...")
- Quote the relevant log message
- Include the log ID if available
- Reference the service, host, and tags for context
- Include a link to Datadog logs UI if available

When citing RUM EVENT evidence:
- Include the exact timestamp (e.g., "At 2020-05-26T13:36:14Z...")
- Include the event type (session, view, action, error, resource, long_task)
- Include the event ID and session ID if available
- For errors: Include error message, source, and stack trace if available
- For views: Include view name, URL, and load time
- For actions: Include action type and target
- Include a link to Datadog RUM Explorer if available

Example of GOOD report with RUM events:
"Found RUM error at 2020-05-26T13:36:14Z in session 'abc123': 
TypeError: Cannot read property 'name' of undefined (Error ID: err-xyz789). 
The error occurred on view '/dashboard' (View ID: view-456) when the user clicked 
a button (Action ID: action-789). Corresponding backend logs at 2020-05-26T13:36:15Z 
show API returned 500 error for /api/dashboard endpoint (Log ID: log-abc123)."

REPORTING:
Always summarize your investigation with citations:
- List specific log entries OR RUM events found with timestamps and IDs
- Include service names, hosts, and relevant tags (for logs)
- Include event types, session IDs, view names (for RUM events)
- Correlate RUM events with logs when investigating end-to-end issues
- Any patterns or anomalies observed (with evidence)
- What you ruled out and why
- Suggested next steps if inconclusive`);

        return sections.join('\n');
    }
}
