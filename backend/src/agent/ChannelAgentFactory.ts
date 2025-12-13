import { db } from '../prismaClient';
import logger from '../logger';
import { ChannelAgent } from './ChannelAgent/ChannelAgent';
import { RunContext } from './ChannelAgent/SystemPromptBuilder';
import { NotionDatabaseOutput, NotionDatabaseSession } from '../outputs/notion/NotionDatabaseOutput';
import { ChannelWithRelations, User } from '../types/prisma';
import { NotionConfig } from '../shared/Configs';
import { getInputConfigInclude, getOutputConfigInclude } from '../utility/prismaIncludes';

/**
 * Factory for creating ChannelAgent instances from channel configurations.
 * Handles loading all required data from the database and reconstructing the agent.
 */
export class ChannelAgentFactory {
  static async createFromChannelId(
    channelId: string,
    runId?: string,
    isUserInitiated: boolean = true
  ): Promise<ChannelAgent<NotionDatabaseSession, NotionConfig>> {
    try {
      // Load channel with all relationships
      const channel: ChannelWithRelations | null = await db().automations.findUnique({
        where: { id: channelId },
        include: {
          prompt: true,
          inputs: {
            include: getInputConfigInclude(),
          },
          output: {
            include: getOutputConfigInclude(),
          },
        },
      });

      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      // Load user
      const user: User | null = await db().users.findUnique({
        where: { id: channel.user_id },
      });

      if (!user) {
        throw new Error(`User not found: ${channel.user_id}`);
      }

      // Load output integration
      const outputIntegration = await db().automation_outputs.findFirst({
        where: { automation_id: channelId },
      });

      if (!outputIntegration) {
        throw new Error(`Output integration not found for channel: ${channelId}`);
      }

      // Load Notion integration
      const notionIntegration = await db().notion_integrations.findFirst({
        where: { id: outputIntegration.integration_id },
      });

      if (!notionIntegration) {
        throw new Error(`Notion integration not found: ${outputIntegration.integration_id}`);
      }

      const notionOutput = new NotionDatabaseOutput();
      const session = await notionOutput.createSessionFromConfig(
        notionIntegration.id,
        outputIntegration,
        user
      );

      // Create fresh ChannelAgent
      const runContext: RunContext = { runId: runId ?? '' };
      const channelAgent = new ChannelAgent<NotionDatabaseSession, NotionConfig>(
        session,
        notionOutput,
        channel,
        runContext
      );

      return channelAgent;
    } catch (error) {
      logger.error('Error creating channel agent', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, channelId, runId });
      throw error;
    }
  }
}
