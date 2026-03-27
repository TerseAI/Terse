import type { AgentInputItem } from "@openai/agents-core"

import { ChatMemorySession, RunHistoryChatMemorySession } from "../CustomMemorySession"

export async function appendRunHistoryItems(runId: string, items: AgentInputItem[]): Promise<void> {
    const session = new RunHistoryChatMemorySession({ sessionId: runId })
    await session.addItems(items)
}

export async function appendBuilderSessionItems(sessionId: string, items: AgentInputItem[]): Promise<void> {
    const session = new ChatMemorySession({ sessionId })
    await session.addItems(items)
}

export async function appendSystemEventToRunHistory(runId: string, item: AgentInputItem): Promise<void> {
    await appendRunHistoryItems(runId, [item])
}

export async function appendSystemEventToBuilderSession(sessionId: string, item: AgentInputItem): Promise<void> {
    await appendBuilderSessionItems(sessionId, [item])
}
