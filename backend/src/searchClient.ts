import { Pool } from "pg";
import { EmbeddingSystem } from "./search/EmbeddingSystem";
import { PostgreSQLSearch } from "./search/SearchProvider";
import { Search } from "./search/search";
import { database, openai } from "./config/settings";

let searchClient: Search | undefined;

export function search(): Search {
    const pool = new Pool({
        connectionString: database.searchUrl,
    });

    if (!searchClient) {
        searchClient = new PostgreSQLSearch(pool, new EmbeddingSystem(openai.apiKey));
    }
    return searchClient;
  }
  
  export type { Search }; 