import { EventProcessor } from '../agent/AutomationAgent/EventProcessor';
import { GmailEvent } from '../Updater/InputEvents';
import { GmailEventData } from '../routes/gmail';
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
    const defaultEmail = 'thomas.karatzas@mail.mcgill.ca';

    return cliEmail || envEmail || defaultEmail;
};

const USER_EMAIL = getUserEmail();

// EDIT THIS to test different emails
const mockEmail: GmailEventData = {
    id: 'msg_google_001',
    threadId: 'thread_google_001',
    subject: 'Your Google Job Application Has Been Received',
    from: 'noreply-jobs@google.com',
    to: USER_EMAIL,
    date: new Date().toISOString(),
    internalDate: new Date().getTime().toString(),
    messageId: '<application001@google.com>',
    body: `Dear Applicant,

Thank you for applying to Google.

We have received your application for the Software Engineer position. Our team will review your qualifications and contact you if your skills and experience match our requirements.

We appreciate your interest in joining Google.

Best regards,
Google Recruiting Team`,
    snippet: 'Thank you for applying to Google. We have received your application for the Software Engineer position...'
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

    } catch (error) {
        console.error(chalk.red('\nError:'), error);
        process.exit(1);
    }
}

runQuickTest();
