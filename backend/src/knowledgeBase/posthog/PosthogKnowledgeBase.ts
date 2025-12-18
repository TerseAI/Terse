import { Session } from "../../server";
import { ChannelKnowledgeBaseWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { KnowledgeBaseConfigType } from "@prisma/client";
import { ConfigInstance, PosthogConfig } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { ToolboxEntry } from "../../outputs/abstract/Output";
import { KnowledgeBase } from "../abstract/KnowledgeBase";
import { searchLogsTool } from "./tools/searchLogs";
import { searchSessionsTool } from "./tools/searchSessions";
import { db } from "../../prismaClient";
import logger from "../../logger";

/**
 * Session type for PostHog knowledge base.
 * Extends the base Session with PostHog-specific configuration.
 */
export interface PosthogKnowledgeBaseSession extends Session {
    posthogConfig: PosthogConfig;
}

/**
 * PostHog Knowledge Base implementation.
 * Provides tools for querying PostHog logs and session recordings.
 */
export class PosthogKnowledgeBase extends KnowledgeBase<PosthogKnowledgeBaseSession, PosthogConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: searchLogsTool,
                isReadOnly: true,
                integration: IntegrationType.POSTHOG
            },
            {
                tool: searchSessionsTool,
                isReadOnly: true,
                integration: IntegrationType.POSTHOG
            }
        ];

        super(KnowledgeBaseConfigType.POSTHOG, toolbox);
    }

    /**
     * Creates a PostHog knowledge base session from the configuration.
     * Loads the PostHog integration and configures the session with credentials.
     */
    async createSessionFromConfig(
        integrationId: string,
        channelKnowledgeBase: ChannelKnowledgeBaseWithConfigs,
        user: User
    ): Promise<PosthogKnowledgeBaseSession> {
        // Load the PostHog integration
        const integration = await db().posthog_integrations.findUnique({
            where: { id: integrationId },
        });

        if (!integration) {
            throw new Error(`PostHog integration not found: ${integrationId}`);
        }

        // Load the PostHog config from the channel knowledge base
        if (!channelKnowledgeBase.posthog_config) {
            throw new Error('PostHog config not found in channel knowledge base');
        }

        const posthogConfig = channelKnowledgeBase.posthog_config;

        // Create the PostHog config instance
        const config = new PosthogConfig(
            integrationId,
            posthogConfig.project_id,
            posthogConfig.project_name || undefined,
            posthogConfig.can_read_logs || false,
            posthogConfig.can_read_session_recordings || false
        );

        // Verify that the required permissions are enabled
        if (!config.canReadLogs && !config.canReadSessionRecordings) {
            logger.warn('PostHog knowledge base configured but no read permissions enabled', {
                integrationId,
                projectId: config.projectId
            });
        }

        // Create the session with PostHog config
        const session: PosthogKnowledgeBaseSession = {
            user,
            isUserInitiated: true,
            posthogConfig: config,
        };

        return session;
    }

    async addKnowledgeBaseToChannel(tx: PrismaTransaction, channelKnowledgeBaseId: string, knowledgeBase: PosthogConfig): Promise<void> {
        if (!knowledgeBase.projectId) {
            throw new Error('Posthog config requires projectId');
        }
        // Use unchecked input to bypass relation checks
        await tx.automation_posthog_configs.create({
            data: {
                automation_knowledge_base_id: channelKnowledgeBaseId,
                project_id: knowledgeBase.projectId,
                project_name: knowledgeBase.projectName || null,
                can_read_logs: knowledgeBase.canReadLogs ?? false,
                can_read_session_recordings: knowledgeBase.canReadSessionRecordings ?? false,
            }
        });
    }

    /**
     * Returns system instructions for PostHog knowledge base.
     * Provides guidance on when and how to use PostHog tools.
     */
    getSystemInstructions(session: PosthogKnowledgeBaseSession): string {
        const { posthogConfig } = session;
        const instructions: string[] = [];

        instructions.push('PostHog Knowledge Base is available for querying user activity data.');

        if (posthogConfig.canReadLogs) {
            instructions.push(
                '- Use searchPosthogLogs tool to query logs for a user by email. ' +
                'This is useful for investigating errors, debugging issues, or understanding user activity patterns.'
            );
        }

        if (posthogConfig.canReadSessionRecordings) {
            instructions.push(
                '- Use searchPosthogSessions tool to query session recordings for a user by email. ' +
                'This is useful for replaying user sessions, understanding user behavior, or investigating UX issues.'
            );
        }

        if (posthogConfig.projectName) {
            instructions.push(`- PostHog project: ${posthogConfig.projectName} (ID: ${posthogConfig.projectId})`);
        } else {
            instructions.push(`- PostHog project ID: ${posthogConfig.projectId}`);
        }

        return instructions.join('\n');
    }
}

