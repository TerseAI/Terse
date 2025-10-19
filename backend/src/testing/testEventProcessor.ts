import { EventProcessor } from '../agent/AutomationAgent/EventProcessor';
import { GmailEvent } from '../Updater/InputEvents';
import { GmailEventData } from '../routes/gmail';
import { db } from '../prismaClient';
import { User } from '../types/prisma';
import * as readline from 'readline';
import chalk from 'chalk';

// Default user info
const DEFAULT_USER_EMAIL = 'thomas.karatzas@mail.mcgill.ca';
const DEFAULT_USER_ID = 'thomas.karatzas@mail.mcgill.ca';

// Mock email templates
const mockEmails = {
    'newsletter': {
        id: 'msg_001',
        threadId: 'thread_001',
        subject: 'Weekly Newsletter - Tech Updates',
        from: 'newsletter@techcompany.com',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        messageId: '<newsletter001@techcompany.com>',
        body: 'This is the weekly newsletter with the latest tech updates...',
        snippet: 'This is the weekly newsletter with the latest tech updates...'
    },
    'customer-inquiry': {
        id: 'msg_002',
        threadId: 'thread_002',
        subject: 'Question about your product',
        from: 'customer@gmail.com',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        messageId: '<inquiry002@gmail.com>',
        body: 'Hi, I have a question about pricing for your enterprise plan. Can you help?',
        snippet: 'Hi, I have a question about pricing for your enterprise plan...'
    },
    'bug-report': {
        id: 'msg_003',
        threadId: 'thread_003',
        subject: 'Bug: App crashes on startup',
        from: 'user@customer.com',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        messageId: '<bug003@customer.com>',
        body: 'The application crashes immediately after startup. Steps to reproduce:\n1. Open app\n2. App crashes\n\nError message: "Unable to connect to database"',
        snippet: 'The application crashes immediately after startup...'
    },
    'sales-lead': {
        id: 'msg_004',
        threadId: 'thread_004',
        subject: 'Interested in your services',
        from: 'cto@bigcompany.com',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        messageId: '<sales004@bigcompany.com>',
        body: 'Hello, we are interested in implementing your solution for our team of 500 people. Could we schedule a demo?',
        snippet: 'Hello, we are interested in implementing your solution...'
    }
};

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
        messageId: `<${Date.now()}@custom.com>`,
        body,
        snippet: body.substring(0, 100)
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

        while (continueProcessing) {
            console.log(chalk.bold.yellow('\n--- Choose an email to process ---'));
            console.log('1. Newsletter (techcompany.com)');
            console.log('2. Customer Inquiry (customer@gmail.com)');
            console.log('3. Bug Report (user@customer.com)');
            console.log('4. Sales Lead (cto@bigcompany.com)');
            console.log('5. Custom email');
            console.log('6. Exit');

            const choice = await question('\nEnter your choice (1-6): ');

            let emailData: GmailEventData | null = null;

            switch (choice.trim()) {
                case '1':
                    emailData = mockEmails['newsletter'];
                    break;
                case '2':
                    emailData = mockEmails['customer-inquiry'];
                    break;
                case '3':
                    emailData = mockEmails['bug-report'];
                    break;
                case '4':
                    emailData = mockEmails['sales-lead'];
                    break;
                case '5':
                    console.log(chalk.cyan('\n--- Create Custom Email ---'));
                    const subject = await question('Subject: ');
                    const from = await question('From: ');
                    const to = await question(`To (${DEFAULT_USER_EMAIL}): `) || DEFAULT_USER_EMAIL;
                    const body = await question('Body: ');
                    emailData = createCustomEmail(subject, from, to, body);
                    break;
                case '6':
                    continueProcessing = false;
                    continue;
                default:
                    console.log(chalk.red('Invalid choice. Please try again.'));
                    continue;
            }

            if (emailData) {
                console.log(chalk.bold.cyan('\n--- Processing Email ---'));
                console.log(chalk.gray('Subject:'), emailData.subject);
                console.log(chalk.gray('From:'), emailData.from);
                console.log(chalk.gray('To:'), emailData.to);
                console.log(chalk.gray('Snippet:'), emailData.snippet);

                // Create GmailEvent and process it
                const gmailEvent = new GmailEvent(emailData);
                const processor = new EventProcessor(gmailEvent, user);

                console.log(chalk.yellow('\n🔄 Processing event...'));
                const startTime = Date.now();

                const result = await processor.process();

                const duration = Date.now() - startTime;

                console.log(chalk.bold.cyan('\n--- Result ---'));
                if (result.success) {
                    console.log(chalk.green('✓ Success'));
                    console.log(chalk.gray('Message:'), result.message);
                    if (result.automation) {
                        console.log(chalk.gray('Automation:'), result.automation.name);
                    }
                } else {
                    console.log(chalk.red('✗ Failed'));
                    console.log(chalk.gray('Message:'), result.message);
                }
                console.log(chalk.gray('Duration:'), `${duration}ms`);
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
