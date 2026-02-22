import type { AgentInputItem } from "@openai/agents-core"

import { ChatMemorySession, RunHistoryChatMemorySession } from "../CustomMemorySession"

export async function appendSystemEventToRunHistory(runId: string, item: AgentInputItem): Promise<void> {
    const session = new RunHistoryChatMemorySession({ sessionId: runId })
    await session.addItems([item])
}

export async function appendSystemEventToBuilderSession(sessionId: string, item: AgentInputItem): Promise<void> {
    const session = new ChatMemorySession({ sessionId })
    await session.addItems([item])
}
