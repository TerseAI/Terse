import { Namespace } from "@turbopuffer/turbopuffer/resources/namespaces.mjs";
import { settings } from "../config/settings";
import { EmbeddingProvider, Search, SearchItem, SearchError, EmbeddingError, RankingFunction, DistanceMetric, SearchOptions } from "./searchTypes";
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { getHydrator } from "./HydratorRegistry";
import { RAGNamespace, NamespaceToHydratorType } from "../types/rag";

const tpuf = new Turbopuffer({
    apiKey: settings.turbopuffer.apiKey,
    region: settings.turbopuffer.region
});

export class TurboPufferSearch<
    T extends NamespaceToHydratorType[N],
    M,
    N extends RAGNamespace = RAGNamespace
> implements Search<T, M> {
    private readonly embeddingClient: EmbeddingProvider;
    private readonly namespace: Namespace;
    private readonly distanceMetric: DistanceMetric;

    constructor(
        embeddingClient: EmbeddingProvider, 
        namespace: N, 
        distanceMetric: DistanceMetric = "cosine_distance"
    ) {
        this.embeddingClient = embeddingClient;
        this.namespace = tpuf.namespace(namespace);
        this.distanceMetric = distanceMetric;
    }

    async search(query: string, options?: SearchOptions): Promise<T[]> {
        const {
            rankingColumn = "vector",
            rankingFunction = RankingFunction.ANN,
            filters,
            includeAttributes,
            topK
        } = options || {};

        try {
            const queryEmbedding = await this.embeddingClient.embed(query);
            const res = await this.namespace.query({
                rank_by: [rankingColumn, rankingFunction, queryEmbedding],
                top_k: topK,
                filters,
                include_attributes: includeAttributes,
            });

            const rows = res.rows ?? [];
            if (rows.length === 0) {
                return [];
            }

            // Convert TurboPuffer rows to SearchItems and group by entityType in one pass
            const groupedByType = new Map<string, SearchItem<any>[]>();
            for (const row of rows) {
                const attrs = (row.attributes ?? {}) as Record<string, any>;
                const entityType = (attrs.entityType as string) ?? '';
                const searchItem: SearchItem<any> = {
                    id: String(row.id),
                    entityType,
                    entityId: (attrs.entityId as string) ?? '',
                    content: '', // Not needed for hydration
                    metadata: {}, // Not needed for hydration
                };

                const group = groupedByType.get(entityType);
                if (group) {
                    group.push(searchItem);
                } else {
                    groupedByType.set(entityType, [searchItem]);
                }
            }

            // Hydrate all groups in parallel for better performance
            const hydrationPromises = Array.from(groupedByType.entries()).map(async ([entityType, items]) => {
                const hydrator = getHydrator(entityType);
                if (!hydrator) {
                    console.warn(`No hydrator found for entityType: ${entityType}. Skipping ${items.length} items.`);
                    return [];
                }

                try {
                    return await hydrator.hydrateBulk(items);
                } catch (error) {
                    console.error(`Error hydrating items of type ${entityType}:`, error);
                    throw new SearchError(`Failed to hydrate ${entityType} items`, error as Error);
                }
            });

            const hydratedGroups = await Promise.all(hydrationPromises);
            return hydratedGroups.flat();
        } catch (error) {
            if (error instanceof SearchError || error instanceof EmbeddingError) {
                throw error;
            }
            throw new SearchError('Search failed', error as Error);
        }
    }

    async embed(text: string): Promise<number[]> {
        try {
            return await this.embeddingClient.embed(text);
        } catch (error) {
            throw new EmbeddingError('Embedding failed', error as Error);
        }
    }

    async insert(item: SearchItem<M>): Promise<void> {
        await this.bulkInsert([item]);
    }

    async bulkInsert(items: SearchItem<M>[]): Promise<void> {
        if (items.length === 0) {
            return;
        }

        // Validate all items have required fields (fail fast)
        const invalidItem = items.find(item => !item.content || !item.metadata);
        if (invalidItem) {
            const missingField = !invalidItem.content ? 'content' : 'metadata';
            throw new SearchError(
                `SearchItem with id ${invalidItem.id} must have ${missingField} field for bulkInsert operation`
            );
        }

        try {
            // Generate embeddings in batch if possible, otherwise in parallel
            const contents = items.map(item => item.content!);
            const embeddings = this.embeddingClient.embedBatch
                ? await this.embeddingClient.embedBatch(contents)
                : await Promise.all(contents.map(content => this.embed(content)));

            // Prepare upsert rows
            const upsertRows = items.map((item, i) => ({
                id: item.id,
                vector: embeddings[i],
                entityType: item.entityType,
                entityId: item.entityId,
                ...item.metadata,
            }));

            await this.namespace.write({
                upsert_rows: upsertRows,
                distance_metric: this.distanceMetric as any,
            });
        } catch (error) {
            if (error instanceof EmbeddingError || error instanceof SearchError) {
                throw error;
            }
            throw new SearchError('Bulk insert failed', error as Error);
        }
    }

    async delete(entityId: string): Promise<void> {
        try {
            // Note: TurboPuffer deletes by ID. If entityId is not the same as the TurboPuffer ID,
            // we may need to query first to find the ID. For now, assuming entityId is the ID.
            await this.namespace.write({
                deletes: [entityId],
            });
        } catch (error) {
            throw new SearchError('Delete failed', error as Error);
        }
    }

    async update(item: SearchItem<M>): Promise<void> {
        // TurboPuffer uses upsert semantics, so update is the same as insert
        await this.insert(item);
    }
}