import chalk from 'chalk';
import { db } from '../../prismaClient';
import { Automation, AutomationWithRelations, AutomationOutput, GmailIntegration, NotionIntegration, User } from '../../types/prisma';
import { GmailEvent, InputEvent } from '../../Updater/InputEvents';
import { NotionOutput, NotionSession } from '../../Updater/Outputs/NotionOutput';
import { AutomationAgent } from './AutomationAgent';
import { filterEvent } from './EventFilter';

// The job of this class is to take an Input Event, and check if it's a match for an Automation.
// It will then create a Session, and summon the Automation Agent with the create user data.

export class ProcessorResult {
    success: boolean;
    message: string;
    automation: Automation | null;

    constructor(success: boolean, message: string, automation: Automation | null) {
        this.success = success;
        this.message = message;
        this.automation = automation;
    }
}

export class EventProcessor {
    private inputEvent: InputEvent;
    private user: User;

    constructor(inputEvent: InputEvent, user: User) {
        this.inputEvent = inputEvent;
        this.user = user;
    }

    async process(): Promise<ProcessorResult[]> {
        console.log(chalk.gray(`Processing input event: ${this.inputEvent.debugLog()}`));

        const results: ProcessorResult[] = [];

        // Only have Gmail right now, EZPZ
        let gmailEvent: GmailEvent | undefined = this.inputEvent as GmailEvent;
        if (!gmailEvent) {
            return [new ProcessorResult(false, "Event is not a Gmail event", null)];
        }

        // See if we have a Gmail integration for this event.
        const gmailIntegration: GmailIntegration | null = await db().gmail_integrations.findFirst({
            where: {
                user_id: this.user.id,
                is_active: true,
            }
        });

        if (!gmailIntegration) {
            return [new ProcessorResult(false, "No Gmail integration found for this user", null)];
        }

        // Find all active automations for this user that have Gmail as an input
        const automations = await db().automations.findMany({
            where: {
                user_id: this.user.id,
                is_active: true,
            },
            include: {
                prompt: true,
                inputs: true,
            }
        });

        if (automations.length === 0) {
            return [new ProcessorResult(false, "No automations found for this user", null)];
        }

        // Filter automations that have Gmail as an input
        const gmailAutomations = automations.filter(automation =>
            automation.inputs.some(input => input.integration_type === 'GMAIL')
        );

        if (gmailAutomations.length === 0) {
            return [new ProcessorResult(false, "No automations with Gmail input found for this user", null)];
        }

        console.log(chalk.cyan(`Found ${gmailAutomations.length} automation(s) with Gmail input`));

        // Process each matching automation
        for (const automation of gmailAutomations) {
            try {
                const result = await this.processAutomation(automation);
                results.push(result);
            } catch (error) {
                console.error(chalk.red(`Error processing automation ${automation.id}:`), error);
                results.push(new ProcessorResult(
                    false,
                    `Error processing automation: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    automation
                ));
            }
        }

        return results;
    }

    private async processAutomation(automation: AutomationWithRelations): Promise<ProcessorResult> {
        console.log(chalk.cyan(`Processing automation: ${automation.name} (${automation.id})`));

        if (!automation.prompt) {
            return new ProcessorResult(false, "No prompt found for this automation", automation);
        }

        // Filter the event using AI to see if it's relevant to this automation
        const filterResult = await filterEvent(this.inputEvent, automation.prompt);
        if (!filterResult.isRelevant) {
            console.log(chalk.gray(`Event is not relevant to automation "${automation.name}": ${filterResult.reason}`));
            return new ProcessorResult(false, `Not relevant: ${filterResult.reason}`, automation);
        }

        console.log(chalk.green(`Event is relevant to automation "${automation.name}"`));

        // Get the output integration
        const outputIntegration: AutomationOutput | null = await db().automation_outputs.findFirst({
            where: {
                automation_id: automation.id,
            }
        });

        if (!outputIntegration) {
            return new ProcessorResult(false, "No output integration found for this automation", automation);
        }

        // Currently only support Notion output
        const notionIntegration: NotionIntegration | null = await db().notion_integrations.findFirst({
            where: {
                id: outputIntegration.integration_id,
            }
        });

        if (!notionIntegration) {
            return new ProcessorResult(false, "No notion integration found for this output integration", automation);
        }

        const notionOutput = new NotionOutput();

        // Create a new Session
        const session: NotionSession = {
            notionIntegration: notionIntegration,
            user: this.user,
            isUserInitiated: true,
        };

        const automationAgent = new AutomationAgent<NotionSession>(session, notionOutput, automation.prompt, automation.inputs, outputIntegration);
        automationAgent.setInputEvent(this.inputEvent);

        const result = await automationAgent.run();
        console.log(chalk.green(`Automation "${automation.name}" completed:`), result.finalOutput);

        return new ProcessorResult(
            result.finalOutput ? true : false,
            result.finalOutput as string,
            automation
        );
    }
}