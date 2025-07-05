#!/bin/bash
# setup_vector_tables.sh

echo "Setting up vector search tables..."

psql $DATABASE_URL << 'EOF'
-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the semantic search index table
CREATE TABLE semantic_search_index (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_semantic_search_team_id ON semantic_search_index(team_id);
CREATE INDEX idx_semantic_search_entity_type ON semantic_search_index(entity_type);
CREATE INDEX idx_semantic_search_team_entity ON semantic_search_index(team_id, entity_type);
CREATE INDEX idx_semantic_search_entity_id ON semantic_search_index(team_id, entity_type, entity_id);

-- Create vector similarity index using HNSW (Hierarchical Navigable Small World)
-- This is crucial for fast vector similarity searches
CREATE INDEX idx_semantic_search_embedding ON semantic_search_index 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Create partial indexes for common queries
CREATE INDEX idx_semantic_search_tickets ON semantic_search_index(team_id, updated_at) 
    WHERE entity_type = 'ticket';

CREATE INDEX idx_semantic_search_comments ON semantic_search_index(team_id, updated_at) 
    WHERE entity_type = 'comment';

-- Add constraint to ensure team_id matches expected entities
-- (You might want to add foreign key constraints here if your schema supports it)
ALTER TABLE semantic_search_index 
    ADD CONSTRAINT check_entity_type 
    CHECK (entity_type IN ('ticket', 'comment', 'user', 'project', 'document'));

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_semantic_search_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update timestamp on row updates
CREATE TRIGGER trigger_semantic_search_updated_at
    BEFORE UPDATE ON semantic_search_index
    FOR EACH ROW
    EXECUTE FUNCTION update_semantic_search_updated_at();

EOF

echo "Vector tables created successfully!"