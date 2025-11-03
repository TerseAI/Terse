import chalk from 'chalk';
import { db } from '../prismaClient';
import { AutomationAgent } from './AutomationAgent/AutomationAgent';
import { NotionDatabaseOutput, NotionDatabaseSession } from '../Updater/Outputs/NotionDatabaseOutput';
import { AutomationWithRelations, User } from 'src/types/prisma';

/**
 * Factory for creating AutomationAgent instances from automation configurations.
 * Handles loading all required data from the database and reconstructing the agent.
 */
export class AutomationAgentFactory {
  static async createFromAutomationId(
    automationId: string,
    isUserInitiated: boolean = true
  ): Promise<AutomationAgent<NotionDatabaseSession>> {
    try {
      // Load automation with all relationships
      const automation: AutomationWithRelations | null = await db().automations.findUnique({
        where: { id: automationId },
        include: {
          prompt: true,
          inputs: {
            include: {
              slack_config: true,
              notion_config: true,
              linear_config: true,
              jira_config: true,
              github_config: true,
              gmail_config: true,
            },
          },
          output: {
            include: {
              slack_config: true,
              notion_config: true,
              linear_config: true,
              jira_config: true,
              github_config: true,
              gmail_config: true,
            },
          },
        },
      });

      if (!automation) {
        throw new Error(`Automation not found: ${automationId}`);
      }

      // Load user
      const user: User | null = await db().users.findUnique({
        where: { id: automation.user_id },
      });

      if (!user) {
        throw new Error(`User not found: ${automation.user_id}`);
      }

      // Load output integration
      const outputIntegration = await db().automation_outputs.findFirst({
        where: { automation_id: automationId },
      });

      if (!outputIntegration) {
        throw new Error(`Output integration not found for automation: ${automationId}`);
      }

      // Load Notion integration
      const notionIntegration = await db().notion_integrations.findFirst({
        where: { id: outputIntegration.integration_id },
      });

      if (!notionIntegration) {
        throw new Error(`Notion integration not found: ${outputIntegration.integration_id}`);
      }

      // Reconstruct session
      const session: NotionDatabaseSession = {
        notionIntegration,
        user,
        isUserInitiated,
        runActions: [],
      };

      // Create fresh AutomationAgent
      const notionOutput = new NotionDatabaseOutput();
      const automationAgent = new AutomationAgent<NotionDatabaseSession>(
        session,
        notionOutput,
        automation.prompt!,
        automation.inputs,
        outputIntegration
      );

      return automationAgent;
    } catch (error) {
      console.error(chalk.red('Error creating automation agent:'), error);
      throw error;
    }
  }
}
