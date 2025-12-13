import chalk from 'chalk';
import { Search, SearchError, EmbeddingError, EmbeddingProvider } from './search';
import logger from '../logger';
import { SearchItem, SearchResult, SearchOptions } from './SearchItem';
import { Pool } from 'pg';
import { toSql } from 'pgvector';

export class PostgreSQLSearch implements Search {
    private pool: Pool;
    private embeddingClient: EmbeddingProvider;

    constructor(pool: Pool, embeddingClient: EmbeddingProvider) {
        this.pool = pool;
        this.embeddingClient = embeddingClient;
    }

    async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
        const embedding = await this.embed(query);
        const embeddingVector = toSql(embedding);

        const limit = Math.min(options.limit || 20, 100);

        logger.debug('🔍 Search options', { options });

        try {
            const results = await this.pool.query(
                `SELECT id, entity_type, entity_id, content, metadata,
                        (1 - (embedding <=> $1)) as similarity
                 FROM semantic_search_index 
                 WHERE team_id = $2 
                   AND ($3::text[] IS NULL OR entity_type = ANY($3))
                   AND (1 - (embedding <=> $1)) > $4
                 ORDER BY embedding <=> $1 
                 LIMIT $5`,
                [
                    embeddingVector,
                    options.teamId,
                    options.entityTypes || null,
                    options.minSimilarity || 0.0,
                    limit
                ]
            );

            logger.debug(`Search results count`, { count: results.rows.length, query: query.substring(0, 100) });

            return results.rows.map(row => ({
                id: row.id,
                entityType: row.entity_type,
                entityId: row.entity_id,
                content: row.content,
                similarity: (row.similarity || 0.0) as number,
                metadata: row.metadata || {}
            }));
        } catch (error) {
            logger.error('Search database error', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
            throw new SearchError('Database error', error as Error);
        }
    }

    async embed(text: string): Promise<number[]> {
        try {
            return await this.embeddingClient.embed(text);
        } catch (error) {
            throw new EmbeddingError('Invalid response', error as Error);
        }
    }

    async insert(item: SearchItem): Promise<void> {
        const content = item.content;
        const embedding = await this.embed(content);
        const embeddingVector = toSql(embedding);

        try {
            await this.pool.query(
                `INSERT INTO semantic_search_index 
                 (id, team_id, entity_type, entity_id, content, embedding, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO UPDATE SET
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()`,
                [
                    item.id,
                    item.teamId,
                    item.entityType,
                    item.entityId,
                    item.content,
                    embeddingVector,
                    item.metadata
                ]
            );
        } catch (error) {
            logger.error('Error inserting search content', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, itemId: item.id, entityType: item.entityType, entityId: item.entityId });
            throw new SearchError('Database error', error as Error);
        }
    }

    async delete(entityId: string, entityType: string, teamId: string): Promise<void> {
        try {
            await this.pool.query(
                `DELETE FROM semantic_search_index 
                 WHERE entity_id = $1 AND entity_type = $2 AND team_id = $3`,
                [entityId, entityType, teamId]
            );
        } catch (error) {
            throw new SearchError('Database error', error as Error);
        }
    }

    async bulkInsert(items: SearchItem[]): Promise<void> {
        if (items.length === 0) {
            return;
        }

        // Batch embed all items
        const embeddings: number[][] = [];
        for (const item of items) {
            const embedding = await this.embed(item.content);
            embeddings.push(embedding);
        }

        logger.info(`Bulk inserting search items`, { count: items.length });

        // Use proper parameterized queries for each item
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const embeddingVector = toSql(embeddings[i]);

                logger.debug(`Inserting search item`, { itemId: item.id, entityType: item.entityType, entityId: item.entityId, teamId: item.teamId, contentLength: item.content?.length });

                try {
                    await client.query(
                        `INSERT INTO semantic_search_index 
                         (id, team_id, entity_type, entity_id, content, embedding, metadata)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT (id) DO UPDATE SET 
                            content = EXCLUDED.content, 
                            embedding = EXCLUDED.embedding, 
                            metadata = EXCLUDED.metadata, 
                            updated_at = NOW()`,
                        [
                            item.id,
                            item.teamId,
                            item.entityType,
                            item.entityId,
                            item.content,
                            embeddingVector,
                            item.metadata
                        ]
                    );
                    logger.debug(`✅ Successfully inserted search item`, { itemIndex: i + 1, totalItems: items.length, itemId: item.id });
                } catch (insertError) {
                    logger.error(`❌ Failed to insert search item`, { 
                        error: insertError instanceof Error ? insertError.message : String(insertError), 
                        stack: insertError instanceof Error ? insertError.stack : undefined,
                        itemIndex: i + 1, 
                        totalItems: items.length,
                        itemId: item.id,
                        teamId: item.teamId,
                        entityType: item.entityType,
                        entityId: item.entityId,
                        contentLength: item.content?.length,
                        metadata: item.metadata
                    });
                    throw insertError;
                }
            }

            await client.query('COMMIT');
            logger.info(`✅ Successfully committed all search items`, { count: items.length });
        } catch (error) {
            logger.error('❌ Transaction failed, rolling back', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, itemCount: items.length });
            await client.query('ROLLBACK');
            throw new SearchError('Database error', error as Error);
        } finally {
            client.release();
        }
    }

    async update(item: SearchItem): Promise<void> {
        // For PostgreSQL, update is the same as insert due to ON CONFLICT
        await this.insert(item);
    }
}

interface SearchResultRow {
    id: string;
    entity_type: string;
    entity_id: number;
    content: string;
    metadata: any;
    similarity: number | null;
}
