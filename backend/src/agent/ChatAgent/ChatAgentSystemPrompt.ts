import { Channel } from "../../shared/types";

export async function buildChatAgentSystemPrompt(): Promise<string> {
    return `
    You are a chat agent that can help the user with their questions.
    You can use the following tools to help the user:
    `;
}   