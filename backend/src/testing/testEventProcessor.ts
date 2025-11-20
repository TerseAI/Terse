/**
 * Event Processor Test CLI
 * 
 * Sample invocations:
 * 
 * 1. Run the test CLI:
 *    npm run test:event-processor
 *    # or
 *    ts-node backend/src/testing/testEventProcessor.ts
 * 
 * 2. Quick test with CRM emails:
 *    - Select option 1 (CRM Sales Pipeline)
 *    - Then choose email 1-5 (New Lead, Meeting Scheduled, etc.)
 * 
 * 3. Quick test with Architecture emails:
 *    - Select option 2 (Architecture Discussions)
 *    - Then choose email 1-5 (Initial Proposal, Design Pattern, etc.)
 * 
 * 4. Test custom email:
 *    - Select any email set (CRM or Architecture)
 *    - Then choose option 6 (Custom email)
 *    - Enter your custom email details
 */

import { EventProcessor } from '../agent/AutomationAgent/EventProcessor';
import { GmailEvent, GmailEventData } from '../integrations/GmailIntegration';
import { db } from '../prismaClient';
import { User } from '../types/prisma';
import * as readline from 'readline';
import chalk from 'chalk';
import { PendingApprovalState, promptForApprovalDecision, resumeApprovalFlow } from './helpers/ApprovalTestHelper';
import { 
    MOCK_CRM_SALES_PIPELINE_EMAILS, 
    MOCK_ARCHITECTURE_DISCUSSION_EMAILS,
    DEFAULT_USER_EMAIL 
} from './helpers/MockArchitectureEmails';

// In-memory storage for pending approval state
let pendingApprovalState: PendingApprovalState | null = null;

// Create a custom GmailEventData
function createCustomEmail(
    subject: string,
    from: string,
    to: string,
    body: string
): GmailEventData {
    return {
        id: `msg_${Date.now()}`,
        threadId: `thread_${Date.now()}`,
        subject,
        from,
        to,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: `<${Date.now()}@custom.com>`,
        body,
        snippet: body.substring(0, 100),
        labelIds: ['INBOX']
    };
}

// Get user from database
async function getUser(): Promise<User> {
    const user = await db().users.findFirst({
        where: { email: DEFAULT_USER_EMAIL }
    });

    if (!user) {
        throw new Error(
            `User not found with email: ${DEFAULT_USER_EMAIL}\n` +
            'Please ensure the user exists in the database first.'
        );
    }

    console.log(chalk.green(`✓ Found user: ${user.email} (ID: ${user.id})`));
    return user;
}

// Type for email set configurations
type EmailSetConfig = {
    name: string;
    emails: Record<string, GmailEventData>;
    labels: string[];
};

// Available email sets
const EMAIL_SETS: Record<string, EmailSetConfig> = {
    'crm': {
        name: 'CRM Sales Pipeline',
        emails: MOCK_CRM_SALES_PIPELINE_EMAILS,
        labels: [
            'New Lead Inquiry (Cold inbound)',
            'Meeting Scheduled (Warm lead)',
            'Qualified Opportunity (Hot prospect)',
            'Negotiation Stage (Final terms)',
            'Closed Won (Deal signed!)'
        ]
    },
    'architecture': {
        name: 'Architecture Discussions',
        emails: MOCK_ARCHITECTURE_DISCUSSION_EMAILS,
        labels: [
            'Initial Proposal (Microservices Migration)',
            'Design Pattern Discussion (CQRS vs CRUD)',
            'Scalability Concerns (Database Sharding)',
            'Refactoring Discussion (Legacy Service)',
            'Architecture Review (Event-Driven Architecture)'
        ]
    }
};

// Email set keys in order
const EMAIL_SET_KEYS = Object.keys(EMAIL_SETS);

// Main CLI interface
async function main() {
    console.log(chalk.bold.cyan('\n=== Event Processor Test CLI ===\n'));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query: string): Promise<string> => {
        return new Promise(resolve => {
            rl.question(query, resolve);
        });
    };

    try {
        // Get user
        const user = await getUser();

        let continueProcessing = true;
        let currentEmailSetKey: string = 'crm'; // Default to CRM

        while (continueProcessing) {
            // Select email set
            console.log(chalk.bold.yellow('\n--- Select Email Set ---'));
            EMAIL_SET_KEYS.forEach((key, index) => {
                const marker = key === currentEmailSetKey ? '✓ ' : '  ';
                console.log(`${marker}${index + 1}. ${EMAIL_SETS[key].name}`);
            });
            console.log(`${EMAIL_SET_KEYS.length + 1}. Exit`);

            const setChoice = await question(`\nEnter your choice (1-${EMAIL_SET_KEYS.length + 1}): `);
            const setChoiceNum = parseInt(setChoice.trim());

            // Handle exit
            if (setChoiceNum === EMAIL_SET_KEYS.length + 1) {
                continueProcessing = false;
                continue;
            }

            // If valid set selected, show email options
            if (setChoiceNum >= 1 && setChoiceNum <= EMAIL_SET_KEYS.length) {
                currentEmailSetKey = EMAIL_SET_KEYS[setChoiceNum - 1];
            } else {
                console.log(chalk.red('Invalid choice. Please try again.'));
                continue;
            }

            const currentEmailSet = EMAIL_SETS[currentEmailSetKey];
            const emailKeys = Object.keys(currentEmailSet.emails);

            // Show email selection menu
            let emailSelected = false;
            while (!emailSelected) {
                console.log(chalk.bold.yellow(`\n--- ${currentEmailSet.name} - Choose an email to process ---`));
                currentEmailSet.labels.forEach((label, index) => {
                    console.log(`${index + 1}. ${label}`);
                });
                console.log(`${emailKeys.length + 1}. Custom email`);
                console.log(`${emailKeys.length + 2}. Switch Email Set`);
                console.log(`${emailKeys.length + 3}. Exit`);

                const emailChoice = await question(`\nEnter your choice (1-${emailKeys.length + 3}): `);
                const emailChoiceNum = parseInt(emailChoice.trim());

                let emailData: GmailEventData | null = null;

                // Handle switch email set
                if (emailChoiceNum === emailKeys.length + 2) {
                    emailSelected = true; // Break inner loop to go back to set selection
                    continue;
                }

                // Handle exit
                if (emailChoiceNum === emailKeys.length + 3) {
                    continueProcessing = false;
                    emailSelected = true;
                    break;
                }

                // Handle custom email
                if (emailChoiceNum === emailKeys.length + 1) {
                    console.log(chalk.cyan('\n--- Create Custom Email ---'));
                    const subject = await question('Subject: ');
                    const from = await question('From: ');
                    const to = await question(`To (${DEFAULT_USER_EMAIL}): `) || DEFAULT_USER_EMAIL;
                    const body = await question('Body: ');
                    emailData = createCustomEmail(subject, from, to, body);
                } 
                // Handle email selection
                else if (emailChoiceNum >= 1 && emailChoiceNum <= emailKeys.length) {
                    const selectedEmailKey = emailKeys[emailChoiceNum - 1];
                    emailData = currentEmailSet.emails[selectedEmailKey];
                } else {
                    console.log(chalk.red('Invalid choice. Please try again.'));
                    continue;
                }

                if (emailData) {
                    emailSelected = true; // Will break inner loop after processing

                    console.log(chalk.bold.cyan('\n--- Processing Email ---'));
                    console.log(chalk.gray('Subject:'), emailData.subject);
                    console.log(chalk.gray('From:'), emailData.from);
                    console.log(chalk.gray('To:'), emailData.to);
                    console.log(chalk.gray('Snippet:'), emailData.snippet);

                    // Create GmailEvent and process it
                    // Use a test integration ID for testing purposes
                    const gmailEvent = new GmailEvent(emailData, 'test_integration_id');
                    const processor = new EventProcessor(gmailEvent, user);

                    console.log(chalk.yellow('\n🔄 Processing event...'));
                    const startTime = Date.now();

                    const results = await processor.process();

                    const duration = Date.now() - startTime;

                    console.log(chalk.bold.cyan('\n--- Results ---'));
                    if (results.length === 0) {
                        console.log(chalk.yellow('No results returned'));
                    } else {
                        for (const result of results) {
                            if (result.success) {
                                console.log(chalk.green('✓ Success'));
                                console.log(chalk.gray('Message:'), result.message);
                                if (result.automation) {
                                    console.log(chalk.gray('Automation:'), result.automation.name);
                                }
                            } else {
                                console.log(chalk.red('✗ Failed'));
                                console.log(chalk.gray('Message:'), result.message);
                                if (result.automation) {
                                    console.log(chalk.gray('Automation:'), result.automation.name);
                                }
                            }
                        }
                    }
                    console.log(chalk.gray('Duration:'), `${duration}ms`);

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

                            const approved = await promptForApprovalDecision(rl);

                            if (approved) {
                                console.log(chalk.green('\n✓ Approved! Resuming automation...\n'));
                                await resumeApprovalFlow(pendingApprovalState);
                            } else {
                                console.log(chalk.yellow('\n✗ Rejected. Automation cancelled.\n'));
                            }
                        }
                    }
                }
            }
        }

        console.log(chalk.cyan('\nGoodbye!\n'));
        rl.close();

    } catch (error) {
        console.error(chalk.red('\nError:'), error);
        rl.close();
        process.exit(1);
    }
}

// Run the CLI
main();
