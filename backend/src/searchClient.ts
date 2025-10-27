import { Pool } from "pg";
import { EmbeddingSystem } from "./search/EmbeddingSystem";
import { PostgreSQLSearch } from "./search/SearchProvider";
import { Search } from "./search/search";

let searchClient: Search | undefined;

export function search(): Search {
  const pool = new Pool({
    connectionString: process.env.SEARCH_DATABASE_URL,
  });
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (!searchClient) {
    searchClient = new PostgreSQLSearch(pool, new EmbeddingSystem(openaiApiKey));
  }
  return searchClient;
}

export type { Search };
