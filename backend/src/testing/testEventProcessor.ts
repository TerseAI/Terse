import { EventProcessor } from '../agent/AutomationAgent/EventProcessor';
import { GmailEvent } from '../Updater/InputEvents';
import { GmailEventData } from '../routes/gmail';
import { db } from '../prismaClient';
import { User } from '../types/prisma';
import * as readline from 'readline';
import chalk from 'chalk';
import { PendingApprovalState, promptForApprovalDecision, resumeApprovalFlow } from './helpers/ApprovalTestHelper';

// Default user info
const DEFAULT_USER_EMAIL = 'thomas@useterse.ai';

// In-memory storage for pending approval state
let pendingApprovalState: PendingApprovalState | null = null;

// Mock email templates - CRM Sales Pipeline progression
const mockEmails = {
    'new-lead': {
        id: 'msg_001',
        threadId: 'thread_001',
        subject: 'Re: Demo Follow-up - Moving Forward with Enterprise Plan',
        from: 'jennifer.martinez@techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<lead001@techstartup.io>',
        body: 'Would like to chat about your product. I am a potential customer.',
        snippet: 'Would like to chat about your product. I am a potential customer.'
    },
    'meeting-scheduled': {
        id: 'msg_002',
        threadId: 'thread_001',
        subject: 'Re: Looking for AI automation solutions for our team',
        from: 'jennifer.martinez@techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<meeting002@techstartup.io>',
        body: 'Hi,\n\nThanks for getting back to me so quickly! I\'d love to jump on a call to discuss this further.\n\nI\'ve added a 45-minute meeting to both our calendars for Tuesday at 2pm EST. I\'ll have our Head of Product, Alex Chen, join as well since he\'ll be working closely with whatever solution we implement.\n\nBefore the call, it would be helpful to know:\n- Your typical engagement timeline\n- Case studies or examples of similar work\n- Your team structure and who we\'d be working with\n\nLooking forward to the conversation!\n\nBest,\nJennifer Martinez\nCOO, TechStartup Inc.',
        snippet: 'Thanks for getting back to me so quickly! I\'d love to jump on a call...'
    },
    'qualified-opportunity': {
        id: 'msg_003',
        threadId: 'thread_001',
        subject: 'Re: Looking for AI automation solutions - Next steps',
        from: 'jennifer.martinez@techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<qualified003@techstartup.io>',
        body: 'Hi,\n\nGreat call yesterday! Alex and I are both really excited about working together. Your approach to automation aligns perfectly with what we\'re trying to achieve.\n\nWe\'ve discussed internally and we\'d like to move forward with a pilot project. Specifically:\n\n1. Phase 1: Automate our customer onboarding workflow (weeks 1-3)\n2. Phase 2: Build Notion-Slack integration for our sales team (weeks 4-6)\n3. Phase 3: Implement AI-powered email routing for support (weeks 7-9)\n\nBudget-wise, we\'re comfortable with the $8K/month retainer you mentioned. Can you send over:\n- A formal proposal with timeline and deliverables\n- Your standard contract terms\n- References from 2-3 similar clients\n\nWe\'re hoping to have everything signed by end of next week so we can start on the 1st.\n\nBest,\nJennifer Martinez\nCOO, TechStartup Inc.',
        snippet: 'Great call yesterday! Alex and I are both really excited about working together...'
    },
    'negotiation': {
        id: 'msg_004',
        threadId: 'thread_001',
        subject: 'Re: Proposal Review - A few questions',
        from: 'jennifer.martinez@techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<negotiation004@techstartup.io>',
        body: 'Hi,\n\nThanks for the detailed proposal! Our leadership team reviewed it over the weekend. We\'re really close to signing, but have a few items to discuss:\n\n1. Payment terms: Can we do monthly billing instead of quarterly? Our CFO prefers it for cash flow management.\n\n2. Scope adjustment: We\'d like to prioritize Phase 2 (Notion-Slack integration) over Phase 3, and potentially defer Phase 3 to month 2.\n\n3. Support SLA: Can you guarantee 24-hour response time for critical issues? We operate 24/7.\n\n4. IP/Ownership: The contract mentions joint ownership of custom code - can we get full ownership of any custom integrations built specifically for us?\n\nIf we can align on these points, we\'re ready to sign. The references you provided were excellent - we spoke to DataCorp and they had nothing but positive things to say.\n\nCan we hop on a quick call Thursday morning to finalize?\n\nBest,\nJennifer Martinez\nCOO, TechStartup Inc.',
        snippet: 'Thanks for the detailed proposal! Our leadership team reviewed it over the weekend...'
    },
    'closed-won': {
        id: 'msg_005',
        threadId: 'thread_001',
        subject: 'Contract signed! Ready to kick off 🎉',
        from: 'jennifer.martinez@techstartup.io',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        internalDate: new Date().getTime().toString(),
        messageId: '<won005@techstartup.io>',
        body: 'Hi,\n\nExcellent news - I just signed and returned the contract! Our team is really excited to get started.\n\nOur first invoice payment will process this Friday. In the meantime, here\'s what we\'ve prepared on our end:\n\n- Alex Chen will be your main point of contact for technical implementation\n- We\'ve created a shared Notion workspace and added you as a collaborator\n- Our engineering team is ready to provide API access and documentation\n- We\'ve blocked off time for the kickoff meeting on Monday at 10am EST\n\nI\'ll send calendar invites for the kickoff and our weekly check-ins. Also attaching our current process docs so you can familiarize yourself with our workflows before Monday.\n\nThis is going to be a game-changer for our operations. Really looking forward to the partnership!\n\nBest,\nJennifer Martinez\nCOO, TechStartup Inc.\n\nP.S. - Our CEO wants to say hi on the kickoff call. She\'s pumped about this! 🚀',
        snippet: 'Excellent news - I just signed and returned the contract! Our team is really excited...'
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
        internalDate: new Date().getTime().toString(),
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
            console.log('1. New Lead Inquiry (Cold inbound)');
            console.log('2. Meeting Scheduled (Warm lead)');
            console.log('3. Qualified Opportunity (Hot prospect)');
            console.log('4. Negotiation Stage (Final terms)');
            console.log('5. Closed Won (Deal signed!)');
            console.log('6. Custom email');
            console.log('7. Exit');

            const choice = await question('\nEnter your choice (1-7): ');

            let emailData: GmailEventData | null = null;

            switch (choice.trim()) {
                case '1':
                    emailData = mockEmails['new-lead'];
                    break;
                case '2':
                    emailData = mockEmails['meeting-scheduled'];
                    break;
                case '3':
                    emailData = mockEmails['qualified-opportunity'];
                    break;
                case '4':
                    emailData = mockEmails['negotiation'];
                    break;
                case '5':
                    emailData = mockEmails['closed-won'];
                    break;
                case '6':
                    console.log(chalk.cyan('\n--- Create Custom Email ---'));
                    const subject = await question('Subject: ');
                    const from = await question('From: ');
                    const to = await question(`To (${DEFAULT_USER_EMAIL}): `) || DEFAULT_USER_EMAIL;
                    const body = await question('Body: ');
                    emailData = createCustomEmail(subject, from, to, body);
                    break;
                case '7':
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
