import { AutomationAgent } from "../agent/AutomationAgent/AutomationAgent";
import { Session } from "../server";
import chalk from "chalk";
import { InputEvent } from "./InputEvents";
import { Output } from "./Outputs/Output";
import { AutomationPrompt } from "src/types/prisma";

// Main class from procescing Input Events for the Automation Agent.
// Lot's do do here, but keeping it simple for now.
export class Updater {
    private events: InputEvent[];
    private automationAgent: AutomationAgent;

    constructor(events: InputEvent[], session: Session, output: Output, automationPrompt: AutomationPrompt) {
        this.events = events;
        this.automationAgent = new AutomationAgent(session, output, automationPrompt);
    }

    async run() {
        console.log(chalk.bgBlue.white.bold(`🚀 Running Updater for ${this.events.length} event${this.events.length !== 1 ? 's' : ''}`));

        for (const event of this.events) {
            this.automationAgent.setInputEvent(event);
            const result = await this.automationAgent.run();
            console.log(result);
        }
    }
}