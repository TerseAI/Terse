import type { AgentInputItem, Session } from '@openai/agents-core/';
import { db } from '../../prismaClient';
import chalk from 'chalk';

/**
 * Inspired by the CustomMemorySession in the OpenAI agents library
 * https://openai.github.io/openai-agents-js/guides/sessions/#bring-your-own-storage
 */
export class RunHistoryChatMemorySession implements Session {
  private readonly sessionId: string;

  constructor(
    options: {
      sessionId: string;
    },
  ) {
    this.sessionId = options.sessionId
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
    return filteredEvents.map(cloneAgentItem);
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
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
      data: eventRecords
    });
  }

  async popItem(): Promise<AgentInputItem | undefined> {
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
      if (hasFollowingMessage) {
        // Include the reasoning item - it has its required following message
        filteredEvents.push(item);
      } else {
        // Skip this reasoning item as it doesn't have a required following item
        console.log(chalk.yellow(`[ChannelAgent] Skipping reasoning item at index ${i} - no following message item`));
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

function isUserMessage(item: AgentInputItem): boolean {
  return item.type === 'message' && item.role === 'user';
}


export function trimToLastTurns(items: AgentInputItem[], maxTurns: number): AgentInputItem[] {
  if(items.length === 0) return items;
  maxTurns = Math.max(1, maxTurns)

  let userCount = 0;
  let startIndex = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (isUserMessage(item)) {
      userCount++;
    }
    if (userCount >= maxTurns) {
      startIndex = i;
      break;
    }
  }
  return items.slice(startIndex);
}

function cloneAgentItem<T extends AgentInputItem>(item: T): T {
  return structuredClone(item);
}