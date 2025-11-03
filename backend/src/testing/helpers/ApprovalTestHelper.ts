import * as readline from 'readline';
import chalk from 'chalk';
import { ApprovalResult } from '../../agent/AutomationAgent/AutomationAgent';
import { AutomationAgentFactory } from '../../agent/AutomationAgentFactory';
import { NotionDatabaseSession } from '../../Updater/Outputs/NotionDatabaseOutput';
import { Agent, AgentOutputType, RunToolApprovalItem } from '@openai/agents';
import { AutomationAgent } from '../../agent/AutomationAgent/AutomationAgent';

/**
 * Type for pending approval state in test scripts
 */
export type PendingApprovalState = {
  automationId: string;
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
 * Resume an automation from saved approval state
 */
export async function resumeApprovalFlow(state: PendingApprovalState | null): Promise<void> {
  if (!state) return;

  try {
    console.log(chalk.yellow('\n🔄 Resuming automation...\n'));

    // Get the first interruption to approve/reject
    const interruption: RunToolApprovalItem = state.interruptions[0];
    if (!interruption) {
      console.error(chalk.red('No interruption found to process'));
      return;
    }

    // Reconstruct the automation agent
    const automationAgent: AutomationAgent<NotionDatabaseSession> = await AutomationAgentFactory.createFromAutomationId(state.automationId);
    await automationAgent.initializeAgent();

    // Call resume on the AutomationAgent
    const resumed: ApprovalResult<NotionDatabaseSession, Agent<NotionDatabaseSession, AgentOutputType>> = await automationAgent.resume(
      state.serializedState,
      'approve',
      interruption
    );

    if (resumed.status === 'completed') {
      console.log(chalk.green('✓ Automation completed successfully!'));
      console.log(chalk.gray('Final output:'), resumed.result.finalOutput);
    } else {
      console.log(chalk.yellow('⏸️  Another approval is needed'));
      console.log(chalk.gray(`Pending interruptions: ${resumed.interruptions.length}`));
    }
  } catch (error) {
    console.error(chalk.red('Error resuming automation:'), error);
  }
}
