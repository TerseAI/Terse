import * as readline from 'readline';
import chalk from 'chalk';
import { ApprovalResult } from '../../agent/ChannelAgent/ChannelAgent';
import { ChannelAgentFactory } from '../../agent/ChannelAgentFactory';
import { NotionDatabaseSession } from '../../outputs/notion/NotionDatabaseOutput';
import { Agent, AgentOutputType, RunToolApprovalItem } from '@openai/agents';
import { ChannelAgent } from '../../agent/ChannelAgent/ChannelAgent';
import { NotionConfig } from '../../shared/Configs';

/**
 * Type for pending approval state in test scripts
 */
export type PendingApprovalState = {
  channelId: string;
  serializedState: string;
  interruptions: RunToolApprovalItem[];
};

/**
 * Prompt user for approval decision via CLI
 */
export function promptForApprovalDecision(rl: readline.Interface): Promise<boolean> {
  return new Promise(resolve => {
    rl.question(chalk.yellow('Do you approve this action? (yes/no): '), (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Resume an channel from saved approval state
 */
export async function resumeApprovalFlow(state: PendingApprovalState | null): Promise<void> {
  if (!state) return;

  try {
    console.log(chalk.yellow('\n🔄 Resuming channel...\n'));

    // Get the first interruption to approve/reject
    const interruption: RunToolApprovalItem = state.interruptions[0];
    if (!interruption) {
      console.error(chalk.red('No interruption found to process'));
      return;
    }

    // Reconstruct the channel agent
    const channelAgent: ChannelAgent<NotionDatabaseSession, NotionConfig> = await ChannelAgentFactory.createFromChannelId(state.channelId);
    await channelAgent.initializeAgent();

    // Call resume on the ChannelAgent
    const resumed: ApprovalResult<NotionDatabaseSession, Agent<NotionDatabaseSession, AgentOutputType>> = await channelAgent.resume(
      state.serializedState,
      'approve',
      interruption
    );

    if (resumed.status === 'completed') {
      console.log(chalk.green('✓ Channel completed successfully!'));
      console.log(chalk.gray('Final output:'), resumed.result.finalOutput);
    } else {
      console.log(chalk.yellow('⏸️  Another approval is needed'));
      console.log(chalk.gray(`Pending interruptions: ${resumed.interruptions.length}`));
    }
  } catch (error) {
    console.error(chalk.red('Error resuming channel:'), error);
  }
}
