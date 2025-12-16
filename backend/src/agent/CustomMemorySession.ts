import type { AgentInputItem, Session } from '@openai/agents-core';
import { db } from '../prismaClient';
import chalk from 'chalk';
import { RunHistoryRawEventWithRelations } from '../types/prisma';
import { RunHistoryMemory } from '../rag/runHistoryRag/indexer';
import { RAGNamespace } from '../types/rag';
import logger from '../logger';


interface RunHistoryChatMemorySessionOptions {
  sessionId: string;
  skipSave?: boolean;
}

/**
 * Inspired by the CustomMemorySession in the OpenAI agents library
 * https://openai.github.io/openai-agents-js/guides/sessions/#bring-your-own-storage
 */
export class RunHistoryChatMemorySession implements Session {
  private readonly sessionId: string;
  private readonly skipSave: boolean;

  constructor(
      options: RunHistoryChatMemorySessionOptions
  ) {
    this.sessionId = options.sessionId
    this.skipSave = options.skipSave ?? false;
  }

  async getSessionId(): Promise<string> {
    return this.sessionId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    const primsa = db()
    const items = await primsa.run_history_raw_events.findMany({
      where: {
        run_history_record_id: this.sessionId
      },
      orderBy: [
        { sequence_order: 'asc' },
        { created_at: 'asc' }, // Fallback for items without sequence_order (backward compatibility)
      ],
      take: limit,
      select: {
        raw_event_json: true
      }
    })
    const rawEvents = items.map(item => item.raw_event_json as AgentInputItem);
    const filteredEvents = filterReasoningItems(rawEvents);
    const deduplicatedEvents = deduplicateItemsById(filteredEvents);
    return deduplicatedEvents.map(cloneAgentItem);
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    if (this.skipSave) return;
    if (items.length === 0) return;
    const prisma = db()

    // Get the current max sequence_order for this session to continue from there
    const maxSequence = await prisma.run_history_raw_events.findFirst({
      where: {
        run_history_record_id: this.sessionId
      },
      orderBy: {
        sequence_order: 'desc'
      },
      select: {
        sequence_order: true
      }
    });

    const startSequence = maxSequence?.sequence_order ?? -1;

    const eventRecords = items.map((item, index) => {
      return {
        run_history_record_id: this.sessionId,
        raw_event_json: item as any,
        sequence_order: startSequence + index + 1,
      }
    });

    await prisma.run_history_raw_events.createMany({
      data: eventRecords,
    });
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    if (this.skipSave) return undefined;
    const prisma = db()
    const lastEvent = await prisma.run_history_raw_events.findFirst({
      where: {
        run_history_record_id: this.sessionId
      },
      orderBy: [
        { sequence_order: 'desc' },
        { created_at: 'desc' }, // Fallback for items without sequence_order (backward compatibility)
      ]
    })
    if (!lastEvent) {
      return undefined;
    }
    const rawEvent = lastEvent.raw_event_json as AgentInputItem;
    const cloned = cloneAgentItem(rawEvent);
    await prisma.run_history_raw_events.delete({
      where: {
        id: lastEvent.id
      }
    })
    return cloned;
  }

  async clearSession(): Promise<void> {
    if (this.skipSave) return;
    const prisma = db()
    await prisma.run_history_raw_events.deleteMany({
      where: {
        run_history_record_id: this.sessionId
      }
    })
  }
}


function filterReasoningItems(rawEvents: AgentInputItem[]): AgentInputItem[] {
  const filteredEvents: AgentInputItem[] = [];
  for (let i = 0; i < rawEvents.length; i++) {
    const item = rawEvents[i];
    const isReasoningItemVariable = isReasoningItem(item);

    if (isReasoningItemVariable) {
      // Check if there's a following message item
      const hasFollowingMessage = i < rawEvents.length - 1 && isMessageItem(rawEvents[i + 1]);
      const hasFollowingWebSearchCall = i < rawEvents.length - 1 && isWebSearchCallItem(rawEvents[i + 1]);
      if (hasFollowingMessage || hasFollowingWebSearchCall) {
        // Include the reasoning item - it has its required following message
        filteredEvents.push(item);
      } else {
        // Skip this reasoning item as it doesn't have a required following item
        logger.info(`[ChannelAgent] Skipping reasoning item at index ${i} - no following message item`);
      }
    } else {
      // Not a reasoning item, include it normally
      filteredEvents.push(item);
    }
  }
  return filteredEvents;
}


function isReasoningItem(item: AgentInputItem): boolean {
  // Reasoning items typically have a type property set to 'reasoning' or an id starting with 'rs_'
  if (typeof item === 'object' && item !== null) {
    const itemAny = item as any;
    // Check for reasoning item indicators
    if (itemAny.type === 'reasoning') {
      return true;
    }
    if (itemAny.id && typeof itemAny.id === 'string' && itemAny.id.startsWith('rs_')) {
      return true;
    }
  }
  return false;
}

function isMessageItem(item: AgentInputItem): boolean {
  // Message items have a 'role' property (user, assistant, system)
  if (typeof item === 'object' && item !== null) {
    const itemAny = item as any;
    return itemAny.role === 'user' || itemAny.role === 'assistant' || itemAny.role === 'system';
  }
  return false;
}

function isWebSearchCallItem(item: AgentInputItem): boolean {
  // Web search call items have type 'web_search_call' or id starting with 'ws_'
  if (typeof item === 'object' && item !== null) {
    const itemAny = item as any;
    if (itemAny.type === 'web_search_call') {
      return true;
    }
    if (itemAny.id && typeof itemAny.id === 'string' && itemAny.id.startsWith('ws_')) {
      return true;
    }
  }
  return false;
}

function isUserMessage(item: AgentInputItem): boolean {
  return item.type === 'message' && item.role === 'user';
}


export function trimToLastTurns(items: AgentInputItem[], maxTurns: number): AgentInputItem[] {
  if (items.length === 0) return items;
  maxTurns = Math.max(1, maxTurns);
  
  let count = 0;
  let startIdx = 0; 

  for (let i = items.length - 1; i >= 0; i--) {
    if (isUserMessage(items[i])) {
      count++;
      if (count === maxTurns) {
        startIdx = i;
        break;
      }
    }
  }

  return items.slice(startIdx);
}

function cloneAgentItem<T extends AgentInputItem>(item: T): T {
  return structuredClone(item);
}

/**
 * Deduplicates items by their ID, keeping only the last occurrence of each ID.
 * This prevents duplicate item errors when sending items to the OpenAI API.
 */
function deduplicateItemsById(items: AgentInputItem[]): AgentInputItem[] {
  // Track the last index where each ID appears
  const idToLastIndex = new Map<string, number>();
  
  for (let i = 0; i < items.length; i++) {
    const itemAny = items[i] as any;
    if (itemAny?.id && typeof itemAny.id === 'string') {
      idToLastIndex.set(itemAny.id, i);
    }
  }
  
  // If no IDs found, no duplicates possible
  if (idToLastIndex.size === 0) {
    return items;
  }
  
  // Filter to keep only items that are either:
  // 1. The last occurrence of their ID, or
  // 2. Don't have an ID
  const result: AgentInputItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemAny = item as any;
    const id = itemAny?.id;
    
    if (!id || typeof id !== 'string') {
      // Items without IDs are always included
      result.push(item);
    } else if (idToLastIndex.get(id) === i) {
      // This is the last occurrence of this ID
      result.push(item);
    }
    // Otherwise, skip this duplicate
  }
  
  return result;
}


export const recentHistoryCallback = (history: AgentInputItem[], newItems: AgentInputItem[]): AgentInputItem[] => {
  const trimmedHistory = trimToLastTurns(history, 10)
  return [...trimmedHistory, ...newItems];
}

export const identityHistoryCallback = (history: AgentInputItem[], newItems: AgentInputItem[]): AgentInputItem[] => {
  return [...history, ...newItems];
}

/**
 * Keeping around for now, but not using it. We will want to test this in depth before
 * introducing this additional complexity.
 */
async function persistLongTermMemory(events: RunHistoryRawEventWithRelations[]): Promise<void> {
  const longTermMemory = new RunHistoryMemory(RAGNamespace.RUN_HISTORY_MEMORY)
  await longTermMemory.rememberBulk(events)
}
