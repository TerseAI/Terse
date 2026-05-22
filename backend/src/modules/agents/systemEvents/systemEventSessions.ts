import type { AgentInputItem } from "@openai/agents-core"

import { RunHistoryChatMemorySession } from "../CustomMemorySession"

export async function appendRunHistoryItems(runId: string, items: AgentInputItem[]): Promise<void> {
    const session = new RunHistoryChatMemorySession({ sessionId: runId })
    await session.addItems(items)
}

export async function appendSystemEventToRunHistory(runId: string, item: AgentInputItem): Promise<void> {
    await appendRunHistoryItems(runId, [item])
}
