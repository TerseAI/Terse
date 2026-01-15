import { Session } from "../../server";
import { ChannelKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { ConfigInstance, DatadogConfig } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { ToolboxEntry } from "../../outputs/abstract/Output";
import { KnowledgeBase } from "../abstract/KnowledgeBase";
import { searchDatadogLogsTool } from "./tools/searchLogs";
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
 * Provides tools for querying Datadog logs.
 */
export class DatadogKnowledgeBase extends KnowledgeBase<DatadogKnowledgeBaseSession, DatadogConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: searchDatadogLogsTool,
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

INVESTIGATION STRATEGY:
Investigate like a human engineer would - be thorough and iterative, not superficial.

1. START WITH BROAD QUERIES:
   - Use default indexes unless you know a specific index is needed
   - Start with broader time ranges to capture full context
   - Use simple queries first, then narrow down

2. PAGINATE THROUGH RESULTS:
   - If the first batch doesn't show relevant logs, use the cursor to get more
   - Continue until you find relevant evidence OR have reviewed sufficient logs
   - The API returns pagination cursors in the response

3. USE DATADOG LOG SEARCH SYNTAX:
   - Exact match: service:web AND @status:error
   - Wildcards: host:web*
   - Negation: -@http.status_code:200
   - Comparison: @duration:>500
   - Multiple values: @http.status_code:(200 OR 404)
   - Grouping: (service:api AND @http.method:GET) OR service:worker

4. FILTER BY TIME RANGES:
   - Use ISO8601 format for precise time filtering
   - Example: from="2020-09-17T11:48:36+01:00", to="2020-09-17T12:48:36+01:00"
   - Or use relative times like "now-1h" for the from parameter

5. CROSS-REFERENCE DATA:
   - Look for patterns across multiple log entries
   - Match timestamps with other events
   - Check tags and custom attributes for context

6. KNOW WHEN TO STOP:
   - You've reviewed logs across the relevant timeframe
   - You've checked multiple indexes if applicable
   - You've cross-referenced with other data sources
   - If still no smoking gun, report what you searched and what you ruled out

CITING EVIDENCE:
Every claim MUST be backed by specific, verifiable references.

When citing LOG evidence:
- Include the exact timestamp (e.g., "At 2020-05-26T13:36:14Z...")
- Quote the relevant log message
- Include the log ID if available
- Reference the service, host, and tags for context
- Include a link to Datadog logs UI if available

Example of GOOD report:
"Found error logs at 2020-05-26T13:36:14Z from service 'agent' on host 'i-0123': 
'Host connected to remote' (Log ID: AAAAAWgN8Xwgr1vKDQAAAABBV2dOOFh3ZzZobm1mWXJFYTR0OA). 
Tags indicate this is from team:A. The error occurred during a connection attempt."

REPORTING:
Always summarize your investigation with citations:
- List specific log entries found with timestamps and IDs
- Include service names, hosts, and relevant tags
- Any patterns or anomalies observed (with evidence)
- What you ruled out and why
- Suggested next steps if inconclusive`);

        return sections.join('\n');
    }
}
