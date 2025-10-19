import { db } from 'src/prismaClient';
import { Automation, AutomationOutput, GmailIntegration, User } from 'src/types/prisma';
import { GmailEvent, InputEvent, InputEventType } from 'src/Updater/InputEvents';
import { NotionOutput } from 'src/Updater/Outputs/NotionOutput';

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

    async process(): Promise<ProcessorResult> {
        console.log("Processing input event");

        // Only gave Gmail right now, EZPZ
        let gmailEvent: GmailEvent | undefined = this.inputEvent as GmailEvent;
        if (!gmailEvent) {
            return new ProcessorResult(false, "Event is not a Gmail event", null);
        }

        // See if we have a Gmail integration for this event.
        const gmailIntegration: GmailIntegration | null = await db().gmail_integrations.findFirst({
            where: {
                user_id: this.user.id,
                is_active: true,
            }
        });

        if (!gmailIntegration) {
            return new ProcessorResult(false, "No Gmail integration found for this user", null);
        }

        // Check if the event is a match for an Automation.
        // In future, may need find many, but not important right now.
        const automation = await db().automations.findFirst({
            where: {
                user_id: this.user.id,
                is_active: true,
            }
        });

        if (!automation) {
            return new ProcessorResult(false, "No automation found for this user", null);
        }

        // get the output integration!
        const outputIntegration: AutomationOutput | null = await db().automation_outputs.findFirst({
            where: {
                automation_id: automation.id,
            }
        });

        if (!outputIntegration) {
            return new ProcessorResult(false, "No output integration found for this automation", null);
        }

        // Again, we know this is notion for now, so we can just create a new NotionOutput with the integration_id.
       // TODO: Add Notion Integration!!!

       console.log("Treat this as a Success! Just gotta build the output integration!");

        return new ProcessorResult(true, "Event processed successfully", null);
    }
}