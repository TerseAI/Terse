import { EventProcessor } from '../agent/ChannelAgent/EventProcessor';
import { GmailEvent, GmailEventData } from '../integrations/GmailIntegration';
import { db } from '../prismaClient';
import chalk from 'chalk';

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
    snippet: 'Deal update: Acme Corp moving forward with $85K Enterprise plan. Close date Dec 15. Technical evaluation scheduled...',
    labelIds: ['INBOX']
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
        const gmailEvent = new GmailEvent(mockEmail, 'gmail_integration_1');
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
                    if (result.agent) {
                        console.log(chalk.gray('  Agent:'), result.agent.name);
                    }
                } else {
                    console.log(chalk.red('  ✗ Failed'));
                    console.log(chalk.gray('  Message:'), result.message);
                    if (result.agent) {
                        console.log(chalk.gray('  Agent:'), result.agent.name);
                    }
                }
            }
        }
        console.log(chalk.gray('  Duration:'), `${duration}ms`);
        console.log();

    } catch (error) {
        console.error(chalk.red('\nError:'), error);
        process.exit(1);
    }
}

runQuickTest();
