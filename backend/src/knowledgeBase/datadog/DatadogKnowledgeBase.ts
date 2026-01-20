import { Session } from "../../server";
import { ChannelKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { DatadogConfig } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { ToolboxEntry } from "../../outputs/abstract/Output";
import { KnowledgeBase } from "../abstract/KnowledgeBase";
import { Tool } from "@openai/agents";
import { searchDatadogLogsTool } from "./tools/searchLogs";
import { searchRumEventsTool } from "./tools/searchRumEvents";
import { listRumEventsTool } from "./tools/listRumEvents";
import { aggregateRumEventsTool } from "./tools/aggregateRumEvents";
import { db } from "../../prismaClient";
import logger from "../../logger";


/**
 * Datadog Knowledge Base implementation.
 * Provides tools for querying Datadog logs and RUM events.
 */
export class DatadogKnowledgeBase extends KnowledgeBase<DatadogConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: searchDatadogLogsTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.DATADOG
            },
            {
                tool: listRumEventsTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.DATADOG
            },
            {
                tool: searchRumEventsTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.DATADOG
            },
            {
                tool: aggregateRumEventsTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.DATADOG
            }
        ];

        super(KnowledgeBaseConfigType.DATADOG, toolbox);
    }


    async addKnowledgeBaseToChannel(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: DatadogConfig): Promise<void> {
        // Use unchecked input to bypass relation checks
        await tx.automation_datadog_configs.create({
            data: {
                automation_knowledge_base_id: channelKnowledgeBaseId,
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
    getSystemInstructions(configs: ChannelKnowledgeBaseWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error('No Datadog KB configs provided');
        }
        
        const sections: string[] = [];

        // Header
        sections.push('=== DATADOG KNOWLEDGE BASE ===');
        
        // List all available configurations
        const configList: string[] = [];
        for (const config of configs) {
            if (!config.datadog_config) {
                throw new Error('Datadog config not found');
            }
            const defaultIndexes = config.datadog_config.default_indexes || ["main"];
            configList.push(`  • Integration ID: ${config.integration_id} - Default indexes: ${defaultIndexes.join(', ')}`);
        }
        sections.push('Available configurations:');
        sections.push(configList.join('\n'));
        sections.push('\nWhen calling Datadog tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.');

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
