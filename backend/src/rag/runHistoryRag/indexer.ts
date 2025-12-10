import { TurboPufferSearch } from '../turbopufferSearch';
import { SearchItem } from '../searchTypes';
import { EmbeddingSystem } from '../../search/EmbeddingSystem';
import { openai } from '../../config/settings';
import { extractConversationContent } from './conversationExtractor';
import { RunHistoryRawEventWithRelations } from '../../types/prisma';
import { HydratorType, RAGNamespace } from '../../types/rag';
import { Indexer } from '../indexer';
import { Filter } from '@turbopuffer/turbopuffer/resources/index';


export interface RunHistoryMetadata {
    run_history_record_id: string;
    channel_id: string;
    sequence_order: number;
    created_at: string;
}

export class RunHistoryMemory implements Indexer<RunHistoryRawEventWithRelations> {
    private search: TurboPufferSearch<RunHistoryRawEventWithRelations, RunHistoryMetadata, RAGNamespace.RUN_HISTORY_MEMORY>;
    private embeddingProvider: EmbeddingSystem;

    constructor(namespace: RAGNamespace = RAGNamespace.RUN_HISTORY_MEMORY) {
        this.embeddingProvider = new EmbeddingSystem(openai.apiKey);
        this.search = new TurboPufferSearch<RunHistoryRawEventWithRelations, RunHistoryMetadata, RAGNamespace.RUN_HISTORY_MEMORY>(
            this.embeddingProvider, 
            namespace
        );
    }

    async remember(event: RunHistoryRawEventWithRelations): Promise<void> {
        await this.rememberBulk([event]);
    }

    async rememberBulk(events: RunHistoryRawEventWithRelations[]): Promise<void> {
        if (events.length === 0) return;

        const searchItems: SearchItem<RunHistoryMetadata>[] = events.map(event => {
            const rawEvent = event.raw_event_json as any;
            const conversationContent = extractConversationContent(rawEvent);

            // Extract channel_id from the automation relation
            const channelId = event.run_history_record?.automation?.id;
            if (!channelId) {
                throw new Error(`Channel ID not found for run history raw event: ${event.id}`);
            }

            return {
                id: event.id,
                entityType: HydratorType.RUN_HISTORY_RAW_EVENT,
                entityId: event.id,
                content: conversationContent,
                metadata: {
                    run_history_record_id: event.run_history_record_id,
                    channel_id: channelId,
                    sequence_order: event.sequence_order,
                    created_at: event.created_at.toISOString()
                }
            };
        });

        await this.search.bulkInsert(searchItems);
    }

    async findSimilarInputEvents(
        query: string,
        channelId: string,
        topK: number = 10
    ): Promise<RunHistoryRawEventWithRelations[]> {
        const filters: Filter[] = [
            ["sequence_order", "Eq", 0],
            ["channel_id", "Eq", channelId]
        ];

        const results = await this.search.search(query, {
            topK,
            filters: filters.length > 1 ? ["And", filters] : filters[0]
        }) as RunHistoryRawEventWithRelations[];

        return results;
    }
}