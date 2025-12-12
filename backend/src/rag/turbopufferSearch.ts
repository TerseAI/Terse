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

        const finalIncludeAttributes = [
            'entityType', 
            'entityId', 
            ...(includeAttributes || [])
        ];

        try {
            const queryEmbedding = await this.embeddingClient.embed(query);
            const res = await this.namespace.query({
                rank_by: [rankingColumn, rankingFunction, queryEmbedding],
                top_k: topK,
                filters,
                include_attributes: finalIncludeAttributes,
            });

            const rows = res.rows ?? [];
            if (rows.length === 0) {
                return [];
            }
            
            // Convert TurboPuffer rows to SearchItems with their distance scores
            // TurboPuffer provides $dist (distance score) - lower distance = higher similarity
            // Create a map from entityId to distance for O(1) lookup
            const distanceMap = new Map<string, number>();
            const groupedByType = new Map<string, SearchItem<M>[]>();
            
            for (const row of rows) {
                const entityType = (row.entityType as string) ?? '';
                const distance = (row.$dist as number) ?? Infinity; // Use Infinity as fallback if $dist missing
                
                const searchItem: SearchItem<M> = {
                    id: row.id as string,
                    entityType: row.entityType as string,
                    entityId: row.entityId as string,
                    content: '', // Not needed for hydration
                    metadata: {} as M // Not needed for hydration
                };

                distanceMap.set(searchItem.entityId, distance);

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
                    const hydrated = await hydrator.hydrateBulk(items);
                    // Map hydrated results back to their distance scores
                    return hydrated.map(h => ({
                        hydrated: h,
                        distance: distanceMap.get(h.entityId) ?? Infinity
                    }));
                } catch (error) {
                    console.error(`Error hydrating items of type ${entityType}:`, error);
                    throw new SearchError(`Failed to hydrate ${entityType} items`, error as Error);
                }
            });

            const hydratedGroups = await Promise.all(hydrationPromises);
            const allHydratedWithScores = hydratedGroups.flat();
            
            // Sort by distance (ascending - lower distance = higher similarity)
            // This preserves TurboPuffer's ranking order
            allHydratedWithScores.sort((a, b) => a.distance - b.distance);
            
            // Extract just the hydrated items in sorted order
            return allHydratedWithScores.map(result => result.hydrated);
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