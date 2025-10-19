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

// Mock email templates - Interview process progression
const mockEmails = {
    'application-received': {
        id: 'msg_001',
        threadId: 'thread_001',
        subject: 'Application Received - Senior Software Engineer at Google',
        from: 'sarah.johnson@google.com',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        messageId: '<app001@google.com>',
        body: 'Hi,\n\nThank you for applying to the Senior Software Engineer position at Google! We have received your application and our team is currently reviewing it.\n\nWe typically respond within 5-7 business days. If your qualifications match what we\'re looking for, we\'ll reach out to schedule an initial conversation.\n\nBest regards,\nSarah Johnson\nTechnical Recruiter\nGoogle',
        snippet: 'Thank you for applying to the Senior Software Engineer position at Google!'
    },
    'recruiter-call': {
        id: 'msg_002',
        threadId: 'thread_001',
        subject: 'Re: Application Received - Senior Software Engineer at Google',
        from: 'sarah.johnson@google.com',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        messageId: '<call002@google.com>',
        body: 'Hi,\n\nGreat news! We\'ve reviewed your application and we\'re very impressed with your background. We\'d love to schedule a 30-minute call to discuss the role in more detail and learn more about your experience.\n\nCould you let me know your availability for next week? I\'m generally free:\n- Tuesday 2-4pm EST\n- Wednesday 10am-12pm EST\n- Thursday 1-3pm EST\n\nLooking forward to speaking with you!\n\nBest,\nSarah Johnson\nTechnical Recruiter\nGoogle',
        snippet: 'Great news! We\'ve reviewed your application and we\'re very impressed with your background...'
    },
    'technical-interview': {
        id: 'msg_003',
        threadId: 'thread_001',
        subject: 'Re: Application Received - Technical Interview Scheduled',
        from: 'sarah.johnson@google.com',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        messageId: '<tech003@google.com>',
        body: 'Hi,\n\nIt was great speaking with you yesterday! I\'m excited to move you forward to the technical interview stage.\n\nI\'ve scheduled your technical interview with Alex Chen, our Engineering Manager, for next Tuesday at 2pm EST. The interview will be 90 minutes and will cover:\n- System design (45 min)\n- Coding challenge (45 min)\n\nYou\'ll receive a Google Meet link 24 hours before the interview. Please have a code editor ready and be prepared to share your screen.\n\nLet me know if you have any questions!\n\nBest,\nSarah Johnson\nTechnical Recruiter\nGoogle',
        snippet: 'It was great speaking with you yesterday! I\'m excited to move you forward to the technical interview...'
    },
    'final-round': {
        id: 'msg_004',
        threadId: 'thread_001',
        subject: 'Re: Application Received - Final Round Interview',
        from: 'sarah.johnson@google.com',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        messageId: '<final004@google.com>',
        body: 'Hi,\n\nFantastic job on the technical interview! Alex was really impressed with your problem-solving approach and technical depth.\n\nWe\'d like to invite you to our final round interview, which will consist of:\n1. Team fit interview with 2 senior engineers (45 min)\n2. Leadership interview with our VP of Engineering (30 min)\n3. Culture fit conversation with our Director of People Ops (30 min)\n\nThis will take place next Thursday from 10am-12pm EST via Google Meet. Calendar invites are being sent separately.\n\nWe\'re really excited about your candidacy!\n\nBest,\nSarah Johnson\nTechnical Recruiter\nGoogle',
        snippet: 'Fantastic job on the technical interview! Alex was really impressed with your problem-solving approach...'
    },
    'offer-received': {
        id: 'msg_005',
        threadId: 'thread_001',
        subject: 'Offer - Senior Software Engineer at Google',
        from: 'sarah.johnson@google.com',
        to: DEFAULT_USER_EMAIL,
        date: new Date().toISOString(),
        messageId: '<offer005@google.com>',
        body: 'Hi,\n\nI\'m thrilled to share that we\'d like to extend you an offer for the Senior Software Engineer position at Google!\n\nThe team was unanimously impressed with your technical skills, problem-solving ability, and cultural fit. We believe you\'d be a great addition to the team.\n\nYour formal offer letter is attached and includes:\n- Base Salary: $180,000\n- Equity: GSUs valued at $200,000 over 4 years\n- Annual Bonus: Up to 15% of base\n- Benefits: Full health/dental/vision, 401k matching, generous PTO\n- Start Date: Flexible, but ideally within the next 4-6 weeks\n\nI\'ll give you a call tomorrow to discuss the details and answer any questions you might have. We\'re hoping to hear back from you within a week.\n\nCongratulations, and we hope you\'ll join us!\n\nBest,\nSarah Johnson\nTechnical Recruiter\nGoogle',
        snippet: 'I\'m thrilled to share that we\'d like to extend you an offer for the Senior Software Engineer position...'
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
            console.log('1. Application Received (Google Recruiter)');
            console.log('2. Recruiter Call Request (Google Recruiter)');
            console.log('3. Technical Interview Scheduled (Google Recruiter)');
            console.log('4. Final Round Interview (Google Recruiter)');
            console.log('5. Offer Received (Google Recruiter)');
            console.log('6. Custom email');
            console.log('7. Exit');

            const choice = await question('\nEnter your choice (1-7): ');

            let emailData: GmailEventData | null = null;

            switch (choice.trim()) {
                case '1':
                    emailData = mockEmails['application-received'];
                    break;
                case '2':
                    emailData = mockEmails['recruiter-call'];
                    break;
                case '3':
                    emailData = mockEmails['technical-interview'];
                    break;
                case '4':
                    emailData = mockEmails['final-round'];
                    break;
                case '5':
                    emailData = mockEmails['offer-received'];
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
