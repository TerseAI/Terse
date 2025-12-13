import { Namespace } from "@turbopuffer/turbopuffer/resources/namespaces.mjs";
import { settings } from "../config/settings";
import { EmbeddingProvider, Search, SearchItem, SearchError, EmbeddingError, RankingFunction, DistanceMetric, SearchOptions } from "./searchTypes";
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { getHydratorForNamespace } from "./HydratorRegistry";
import { RAGNamespace, NamespaceToHydratorType, requireHydratorType } from "../types/rag";
import { Identifiable } from "./Hydrator";

const tpuf = new Turbopuffer({
    apiKey: settings.turbopuffer.apiKey,
    region: settings.turbopuffer.region
});

export class TurboPufferSearch<
    M,
    N extends RAGNamespace = RAGNamespace
> implements Search<NamespaceToHydratorType[N], M> {
    private readonly embeddingClient: EmbeddingProvider;
    private readonly tpufNamespace: Namespace;
    private readonly ragNamespace: N;
    private readonly distanceMetric: DistanceMetric;

    constructor(
        embeddingClient: EmbeddingProvider, 
        namespace: N, 
        distanceMetric: DistanceMetric = "cosine_distance"
    ) {
        this.embeddingClient = embeddingClient;
        this.tpufNamespace = tpuf.namespace(namespace);
        this.ragNamespace = namespace;
        this.distanceMetric = distanceMetric;
    }

    async search(query: string, options?: SearchOptions): Promise<NamespaceToHydratorType[N][]> {
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
            const res = await this.tpufNamespace.query({
                rank_by: [rankingColumn, rankingFunction, queryEmbedding],
                top_k: topK,
                filters,
                include_attributes: finalIncludeAttributes,
            });

            const rows = res.rows ?? [];
            if (rows.length === 0) {
                return [];
            }
            
            // Build refs and track distances for sorting
            const distanceMap = new Map<string, number>();
            const refs: Identifiable[] = rows.map(row => {
                const entityId = row.entityId as string;
                const distance = (row.$dist as number) ?? Infinity;
                distanceMap.set(entityId, distance);
                
                return {
                    entityType: requireHydratorType(row.entityType as string),
                    entityId
                };
            });

            // Use the pre-composed hydrator for this namespace
            const hydrator = getHydratorForNamespace(this.ragNamespace);
            const hydrated = await hydrator.hydrateBulk(refs);
            
            // Sort by distance (ascending - lower distance = higher similarity)
            const withScores = hydrated.map(h => ({
                hydrated: h,
                distance: distanceMap.get(h.entityId) ?? Infinity
            }));
            withScores.sort((a, b) => a.distance - b.distance);
            
            return withScores.map(result => result.hydrated) as NamespaceToHydratorType[N][];
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

            await this.tpufNamespace.write({
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
            await this.tpufNamespace.write({
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