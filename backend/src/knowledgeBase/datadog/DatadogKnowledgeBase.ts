import { Session } from "../../server";
import { AgentKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { DatadogConfig } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { ToolboxEntry } from "../../outputs/abstract/Output";
import { KnowledgeBase } from "../abstract/KnowledgeBase";
import { searchDatadogLogsTool } from "./tools/searchLogs";
import { searchRumEventsTool } from "./tools/searchRumEvents";
import { listRumEventsTool } from "./tools/listRumEvents";
import { aggregateRumEventsTool } from "./tools/aggregateRumEvents";
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
                tool: listRumEventsTool,
                isReadOnly: true,
                integration: IntegrationType.DATADOG
            },
            {
                tool: searchRumEventsTool,
                isReadOnly: true,
                integration: IntegrationType.DATADOG
            },
            {
                tool: aggregateRumEventsTool,
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
        agentKnowledgeBase: AgentKnowledgeBaseWithConfigs,
        user: User
    ): Promise<DatadogKnowledgeBaseSession> {
        // Load the Datadog integration
        const integration = await db().datadog_integrations.findUnique({
            where: { id: integrationId },
        });

        if (!integration) {
            throw new Error(`Datadog integration not found: ${integrationId}`);
        }

        // Load the Datadog config from the agent knowledge base
        if (!agentKnowledgeBase.datadog_config) {
            throw new Error('Datadog config not found in agent knowledge base');
        }

        const datadogConfig = agentKnowledgeBase.datadog_config;

        // Create the Datadog config instance
        const config = new DatadogConfig(
            integrationId,
            datadogConfig.default_indexes && datadogConfig.default_indexes.length > 0 
                ? datadogConfig.default_indexes 
                : ["main"]
        );

        // Create the session with Datadog config
        const session: DatadogKnowledgeBaseSession = {
            user,
            isUserInitiated: true,
            datadogConfig: config,
        };

        return session;
    }

    async addKnowledgeBaseToAgent(tx: PrismaTransaction, agentKnowledgeBaseId: string, knowledgeBase: DatadogConfig): Promise<void> {
        // Use unchecked input to bypass relation checks
        await tx.automation_datadog_configs.create({
            data: {
                automation_knowledge_base_id: agentKnowledgeBaseId,
                default_indexes: knowledgeBase.defaultIndexes && knowledgeBase.defaultIndexes.length > 0 
                    ? knowledgeBase.defaultIndexes 
                    : ["main"],
            }
        });
    }

    async validateConfig(knowledgeBase: DatadogConfig, userId: string): Promise<void> {
        // Check that the config is complete
        if (!knowledgeBase.isComplete()) {
            throw new Error('Datadog config is incomplete: integrationId is required');
        }

        // Check that the integration exists
        const integration = await db().datadog_integrations.findUnique({
            where: { id: knowledgeBase.integrationId },
        });

        if (!integration) {
            throw new Error(`Datadog integration not found: ${knowledgeBase.integrationId}`);
        }

        // Validate that the integration belongs to the user
        if (integration.user_id !== userId) {
            throw new Error(`Datadog integration does not belong to user: ${userId}`);
        }

        // Validate that defaultIndexes is a valid array
        if (knowledgeBase.defaultIndexes && !Array.isArray(knowledgeBase.defaultIndexes)) {
            throw new Error('Datadog config defaultIndexes must be an array');
        }
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
TOOLS:
- searchDatadogLogs: Backend/server logs. Filter by query, indexes, time range.
- listRumEvents: Discover RUM events. Use for exploration when unsure what to query.
- searchRumEvents: Query RUM events. Frontend/user behavior, errors, sessions.
- aggregateRumEvents: Compute metrics (percentiles, averages). Performance trends, error rates.

WHEN TO USE:
- Backend issues → searchDatadogLogs
- Discovery/exploration → listRumEvents first
- Frontend issues → searchRumEvents
- Analytics/trends → aggregateRumEvents
- End-to-end → Use both RUM and logs, match timestamps

INVESTIGATION:
1. Start broad: default indexes, wider time ranges (now-1h), simple queries
2. Paginate: Use cursors to review multiple pages until finding evidence
3. Search syntax: service:web AND @status:error, @type:error AND @error.source:network, @view.loading_time:>3000
4. Aggregations: pc95(@view.loading_time) grouped by @view.name, count() grouped by @type
5. Cross-reference: Match RUM timestamps with logs, check tags/attributes
6. Stop when: Reviewed relevant timeframe, checked multiple sources, found evidence or ruled out

CITING:
- Logs: timestamp, message, service/host, log ID, link
- RUM: timestamp, event type, ID/session ID, error details or view info, link
- Aggregations: function/metric, grouping, values, time range, link

REPORTING:
Summarize with citations: specific entries/events with timestamps and IDs, patterns observed, what was ruled out, next steps.`);

        return sections.join('\n');
    }
}
