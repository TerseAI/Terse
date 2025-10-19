import { EventProcessor } from '../agent/AutomationAgent/EventProcessor';
import { GmailEvent } from '../Updater/InputEvents';
import { GmailEventData } from '../routes/gmail';
import { db } from '../prismaClient';
import chalk from 'chalk';

/**
 * Quick test script for EventProcessor
 * Edit the mockEmail object below to test different scenarios
 */

const DEFAULT_USER_EMAIL = 'thomas.karatzas@mail.mcgill.ca';
const DEFAULT_USER_ID = 'thomas.karatzas@mail.mcgill.ca';

// EDIT THIS to test different emails
const mockEmail: GmailEventData = {
    id: 'msg_test_001',
    threadId: 'thread_test_001',
    subject: 'Urgent: Server Down',
    from: 'alerts@monitoring.com',
    to: DEFAULT_USER_EMAIL,
    date: new Date().toISOString(),
    messageId: '<test001@monitoring.com>',
    body: 'Alert: Production server has been down for 5 minutes. HTTP 500 errors reported.',
    snippet: 'Alert: Production server has been down for 5 minutes...'
};

async function runQuickTest() {
    console.log(chalk.bold.cyan('\n=== Quick Event Processor Test ===\n'));

    try {
        // Get user
        const user = await db().users.findFirst({
            where: { email: DEFAULT_USER_EMAIL }
        });

        if (!user) {
            console.error(chalk.red(`\nError: User not found with email: ${DEFAULT_USER_EMAIL}`));
            console.log(chalk.yellow('Please ensure the user exists in the database first.\n'));
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

        const result = await processor.process();

        const duration = Date.now() - startTime;

        // Display result
        console.log(chalk.bold('Result:'));
        if (result.success) {
            console.log(chalk.green('  ✓ Success'));
            console.log(chalk.gray('  Message:'), result.message);
            if (result.automation) {
                console.log(chalk.gray('  Automation:'), result.automation.name);
            }
        } else {
            console.log(chalk.red('  ✗ Failed'));
            console.log(chalk.gray('  Message:'), result.message);
        }
        console.log(chalk.gray('  Duration:'), `${duration}ms`);
        console.log();

    } catch (error) {
        console.error(chalk.red('\nError:'), error);
        process.exit(1);
    }
}

runQuickTest();
