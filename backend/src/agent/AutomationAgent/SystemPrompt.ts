import { AutomationPrompt } from "src/types/prisma";
import { Session } from "../../server";

export async function systemPrompt(session: Session, automationPrompt: AutomationPrompt): Promise<string> {
    return `

    Here are the instructions provided by the user:
    ${automationPrompt.content || 'No instructions provided'}

    You will need to decide what to do based on the instructions.

    You will need to use the tools provided to help you automate the task.
    `;
}