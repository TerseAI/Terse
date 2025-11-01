import { EventProcessor } from '../agent/AutomationAgent/EventProcessor';
import { GmailEvent } from '../Updater/InputEvents';
import { GmailEventData } from '../routes/gmail';
import { db } from '../prismaClient';
import chalk from 'chalk';
import * as readline from 'readline';
import { ApprovalInterceptor, ApprovalResult, Decision } from '../agent/approval/ApprovalInterceptor';
import { AutomationAgent } from '../agent/AutomationAgent/AutomationAgent';
import { NotionOutput, NotionSession } from '../Updater/Outputs/NotionOutput';
import { Agent, AgentOutputType, RunToolApprovalItem } from '@openai/agents';
import { AutomationAgentFactory } from 'src/agent/AutomationAgentFactory';

/**
 * Quick test script for EventProcessor
 * Edit the mockEmail object below to test different scenarios
 */

// Get user email from command line argument or environment variable
// Usage: npm run test:processor:quick -- user@example.com
// Or: TEST_USER_EMAIL=user@example.com npm run test:processor:quick
const getUserEmail = (): string => {
    const cliEmail = process.argv[2];
    const envEmail = process.env.TEST_USER_EMAIL;
    const defaultEmail = 'thomas@useterse.ai';

    return cliEmail || envEmail || defaultEmail;
};

const USER_EMAIL = getUserEmail();

// In-memory storage for pending approval state (for test script only)
let pendingApprovalState: {
    automationId: string;
    serializedState: string;
    interruptions: RunToolApprovalItem[];
} | null = null;

/**
 * Prompt user for approval decision
 */
function promptForApproval(): Promise<boolean> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(chalk.yellow('Do you approve this action? (yes/no): '), (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

/**
 * Resume an automation from saved approval state
 */
async function resumeApproval(state: typeof pendingApprovalState, decision: Decision): Promise<void> {
    if (!state) return;

    try {
        console.log(chalk.yellow('\n🔄 Resuming automation...\n'));

        // Get the first interruption to approve/reject
        const interruption: RunToolApprovalItem = state.interruptions[0];
        if (!interruption) {
            console.error(chalk.red('No interruption found to process'));
            return;
        }

        const automationAgent: AutomationAgent<NotionSession> = await AutomationAgentFactory.createFromAutomationId(state.automationId);
        await automationAgent.initializeAgent();

        // Call resume on the ApprovalInterceptor
        const resumed: ApprovalResult<NotionSession, Agent<NotionSession, AgentOutputType>> = await ApprovalInterceptor.resume(
            automationAgent.getAgent(),
            state.serializedState,
            decision,
            interruption
        );

        if (resumed.status === 'completed') {
            console.log(chalk.green('✓ Automation completed successfully!'));
            console.log(chalk.gray('Final output:'), resumed.result.finalOutput);
        } else {
            console.log(chalk.yellow('⏸️  Another approval is needed'));
            console.log(chalk.gray(`Pending interruptions: ${resumed.interruptions.length}`));
            // Could loop here to handle multiple approvals, but for MVP just show it
        }
    } catch (error) {
        console.error(chalk.red('Error resuming automation:'), error);
    }
}

// EDIT THIS to test different emails
// This email should trigger a CRM update in Notion
const mockEmail: GmailEventData = {
    id: 'msg_crm_update_001',
    threadId: 'thread_crm_001',
    subject: 'Re: Demo Follow-up - Moving Forward with Enterprise Plan',
    from: 'sarah.johnson@acmecorp.com',
    to: USER_EMAIL,
    date: new Date().toISOString(),
    internalDate: new Date().getTime().toString(),
    messageId: '<crm_update_001@acmecorp.com>',
    body: `Hi,

Great speaking with you yesterday! After our demo call, the team is excited to move forward.

Here's where we're at:

DEAL STATUS: Ready to proceed with Enterprise plan
COMPANY: Acme Corporation
CONTACT: Sarah Johnson, VP of Engineering
EMAIL: sarah.johnson@acmecorp.com
PHONE: +1 (555) 123-4567
DEAL SIZE: $85,000 annually
CLOSE DATE: December 15, 2025

Best,
Sarah Johnson
VP of Engineering, Acme Corp`,
    snippet: 'Deal update: Acme Corp moving forward with $85K Enterprise plan. Close date Dec 15. Technical evaluation scheduled...'
};

async function runQuickTest() {
    console.log(chalk.bold.cyan('\n=== Quick Event Processor Test ===\n'));

    try {
        console.log(chalk.gray(`Using email: ${USER_EMAIL}\n`));

        // Get user
        const user = await db().users.findFirst({
            where: { email: USER_EMAIL }
        });

        if (!user) {
            console.error(chalk.red(`\nError: User not found with email: ${USER_EMAIL}`));
            console.log(chalk.yellow('Please ensure the user exists in the database first.\n'));
            console.log(chalk.yellow('Tip: Pass a different email as argument: npm run test:processor:quick -- user@example.com\n'));
            process.exit(1);
        }

        console.log(chalk.green(`✓ User: ${user.email}\n`));

        // Display email info
        console.log(chalk.bold('Email Details:'));
        console.log(chalk.gray('  Subject:'), mockEmail.subject);
        console.log(chalk.gray('  From:'), mockEmail.from);
        console.log(chalk.gray('  To:'), mockEmail.to);
        console.log(chalk.gray('  Snippet:'), mockEmail.snippet);
        console.log();

        // Process the event
        const gmailEvent = new GmailEvent(mockEmail);
        const processor = new EventProcessor(gmailEvent, user);

        console.log(chalk.yellow('🔄 Processing event...\n'));
        const startTime = Date.now();

        const results = await processor.process();

        const duration = Date.now() - startTime;

        // Display results
        console.log(chalk.bold('Results:'));
        if (results.length === 0) {
            console.log(chalk.yellow('  No results returned'));
        } else {
            for (const result of results) {
                if (result.success) {
                    console.log(chalk.green('  ✓ Success'));
                    console.log(chalk.gray('  Message:'), result.message);
                    if (result.automation) {
                        console.log(chalk.gray('  Automation:'), result.automation.name);
                    }
                } else {
                    console.log(chalk.red('  ✗ Failed'));
                    console.log(chalk.gray('  Message:'), result.message);
                    if (result.automation) {
                        console.log(chalk.gray('  Automation:'), result.automation.name);
                    }
                }
            }
        }
        console.log(chalk.gray('  Duration:'), `${duration}ms`);
        console.log();

        // Check if any result has a pending approval
        for (const result of results) {
            if (result.approvalResult && result.approvalResult.status === 'awaiting_approval' && result.automation) {
                pendingApprovalState = {
                    automationId: result.automation.id,
                    serializedState: JSON.stringify(result.approvalResult.state),
                    interruptions: result.approvalResult.interruptions,
                };

                console.log(chalk.cyan('\n⏸️  Automation paused awaiting approval'));
                console.log(chalk.gray(`Automation: ${result.automation.name}`));
                console.log(chalk.gray(`Pending interruptions: ${pendingApprovalState.interruptions.length}`));
                console.log();

                const approved = await promptForApproval();

                if (approved) {
                    console.log(chalk.green('\n✓ Approved! Resuming automation...\n'));
                    await resumeApproval(pendingApprovalState, 'approve');
                } else {
                    console.log(chalk.yellow('\n✗ Rejected. Automation cancelled.\n'));
                }
            }
        }

    } catch (error) {
        console.error(chalk.red('\nError:'), error);
        process.exit(1);
    }
}

runQuickTest();
