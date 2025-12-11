import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { Client } from '@notionhq/client';
import { NotionDatabaseSession } from "../NotionDatabaseOutput";
import { IntegrationType } from "../../../shared/Integrations";
import { SessionWithTracking } from "../../../agent/ChannelAgent/ChannelAgent";
import { formatError } from "../../../tools/errors";

// Helper function to extract readable values from Notion property objects
function extractPropertyValue(property: any): any {
    switch (property.type) {
        case 'title':
            return property.title.map((t: any) => t.plain_text).join('');
        case 'rich_text':
            return property.rich_text.map((t: any) => t.plain_text).join('');
        case 'number':
            return property.number;
        case 'select':
            return property.select?.name || null;
        case 'multi_select':
            return property.multi_select.map((s: any) => s.name);
        case 'date':
            return property.date;
        case 'checkbox':
            return property.checkbox;
        case 'url':
            return property.url;
        case 'email':
            return property.email;
        case 'phone_number':
            return property.phone_number;
        case 'status':
            return property.status?.name || null;
        case 'people':
            return property.people.map((p: any) => p.name || p.id);
        case 'files':
            return property.files.map((f: any) => f.name);
        case 'relation':
            return property.relation.map((r: any) => r.id);
        default:
            return null;
    }
}



const sortSchema = z.object({
    property: z.string().nullable().optional(),
    timestamp: z.enum(['created_time', 'last_edited_time']).nullable().optional(),
    direction: z.enum(['ascending', 'descending']),
}).refine(
    (data) => (data.property !== undefined && data.property !== null) !== (data.timestamp !== undefined && data.timestamp !== null),
    {
        message: "Either 'property' or 'timestamp' must be provided, but not both",
    }
);

export const notionQueryDatabaseTool = tool({
    name: 'notion_query_database',
    description: `Query a Notion data source (database) to retrieve pages that match specific criteria. This tool efficiently filters, sorts, and paginates results at the database layer for optimal performance.

WHEN TO USE THIS TOOL:
- Verify if the database contains any existing records and avoid creating duplicates.
- When you need to find specific pages matching certain criteria (e.g., status, date ranges, property values)
- When you need to retrieve a subset of pages rather than all pages in the database
- When you need sorted results (e.g., newest first, alphabetical order)
- When working with large databases and need pagination to retrieve results in batches
- When you only need specific properties from pages (use filter_properties for efficiency)

WHAT THIS TOOL DOES:
1. Filters pages at the Notion API level (not client-side) for maximum efficiency
2. Supports complex filtering with AND/OR logic, property filters, and timestamp filters
3. Supports sorting by properties or timestamps (created_time, last_edited_time)
4. Supports pagination - use start_cursor from previous responses to get next page
5. Supports filter_properties to only fetch needed fields, reducing response size and improving speed

FILTERING:
- Property filters: Filter by any database property (title, number, date, select, status, checkbox, etc.)
- Timestamp filters: Filter by created_time or last_edited_time
- Compound filters: Combine filters with AND/OR logic
- All filtering happens server-side at Notion for efficiency

PAGINATION:
- Use page_size to control how many results per page (default: all results)
- Use start_cursor from the response to fetch the next page
- The response includes has_more and next_cursor when more pages are available

FILTER_PROPERTIES:
- Specify only the properties you need to reduce response size and improve performance
- Especially important for databases with many properties or complex formulas/rollups
- You can fetch additional properties later using Retrieve page property item API

SORTING:
- Sort by any property or by created_time/last_edited_time
- Multiple sorts are supported (earlier sorts take precedence)
- Useful for getting newest items, alphabetical lists, or priority-ordered results

NOTE: This tool does NOT return the database schema. Use notion_get_schema if you need schema information.`,
    parameters: z.object({
        filter_properties: z.array(z.string()).nullable().optional().describe('Array of property names or IDs to include in results. Only these properties will be returned, improving performance. Use property names from the database schema.'),
        filter: z.string().nullable().optional().describe(`JSON string with filter object to query pages matching specific criteria. Supports complex filtering with AND/OR logic, property filters, and timestamp filters.

BASIC STRUCTURE:
- Property filter: { "property": "Property Name", "type": { "condition": value } }
- Timestamp filter: { "timestamp": "created_time" | "last_edited_time", "created_time" | "last_edited_time": { "condition": value } }
- Compound filter: { "and": [...] } or { "or": [...] } to combine multiple filters (nesting supported up to 2 levels)

PROPERTY FILTER TYPES AND CONDITIONS:

1. CHECKBOX: { "property": "Name", "checkbox": { "equals": true|false } | { "does_not_equal": true|false } }

2. DATE: { "property": "Name", "date": { 
  "after": "2021-05-10" | "2021-05-10T12:00:00" | "2021-10-15T12:00:00-07:00",
  "before": "2021-05-10",
  "equals": "2021-05-10",
  "on_or_after": "2021-05-10",
  "on_or_before": "2021-05-10",
  "is_empty": true,
  "is_not_empty": true,
  "past_week": {},
  "past_month": {},
  "past_year": {},
  "next_week": {},
  "next_month": {},
  "next_year": {},
  "this_week": {}
} }

3. FILES: { "property": "Name", "files": { "is_empty": true } | { "is_not_empty": true } }

4. FORMULA: { "property": "Name", "formula": { 
  "checkbox": { checkbox conditions },
  "date": { date conditions },
  "number": { number conditions },
  "string": { rich_text conditions }
} }

5. MULTI_SELECT: { "property": "Name", "multi_select": { 
  "contains": "Value",
  "does_not_contain": "Value",
  "is_empty": true,
  "is_not_empty": true
} }

6. NUMBER: { "property": "Name", "number": { 
  "equals": 42,
  "does_not_equal": 42,
  "greater_than": 42,
  "less_than": 42,
  "greater_than_or_equal_to": 42,
  "less_than_or_equal_to": 42,
  "is_empty": true,
  "is_not_empty": true
} }

7. PEOPLE (also for created_by, last_edited_by): { "property": "Name", "people": { 
  "contains": "uuid-v4",
  "does_not_contain": "uuid-v4",
  "is_empty": true,
  "is_not_empty": true
} }

8. RELATION: { "property": "Name", "relation": { 
  "contains": "uuid-v4",
  "does_not_contain": "uuid-v4",
  "is_empty": true,
  "is_not_empty": true
} }

9. RICH_TEXT (also title): { "property": "Name", "rich_text": { 
  "contains": "string",
  "does_not_contain": "string",
  "does_not_equal": "string",
  "ends_with": "string",
  "equals": "string",
  "is_empty": true,
  "is_not_empty": true,
  "starts_with": "string"
} }

10. ROLLUP: { "property": "Name", "rollup": { 
  "any": { filter condition },
  "every": { filter condition },
  "none": { filter condition },
  "date": { date conditions },
  "number": { number conditions }
} }

11. SELECT: { "property": "Name", "select": { 
  "equals": "Value",
  "does_not_equal": "Value",
  "is_empty": true,
  "is_not_empty": true
} }

12. STATUS: { "property": "Name", "status": { 
  "equals": "Value",
  "does_not_equal": "Value",
  "is_empty": true,
  "is_not_empty": true
} }

13. TIMESTAMP: { "timestamp": "created_time" | "last_edited_time", "created_time" | "last_edited_time": { 
  same conditions as DATE filter (after, before, equals, on_or_after, on_or_before, is_empty, is_not_empty, past_week, past_month, past_year, next_week, next_month, next_year, this_week)
} }
NOTE: Do NOT include "property" field for timestamp filters.

14. VERIFICATION: { "property": "Name", "verification": { "status": "verified" | "expired" | "none" } }

15. UNIQUE_ID: { "property": "Name", "unique_id": { 
  "equals": 42,
  "does_not_equal": 42,
  "greater_than": 42,
  "less_than": 42,
  "greater_than_or_equal_to": 42,
  "less_than_or_equal_to": 42
} }

COMPOUND FILTERS:
- AND: { "and": [filter1, filter2, ...] } - all conditions must match
- OR: { "or": [filter1, filter2, ...] } - any condition can match
- Nesting: Can nest AND/OR up to 2 levels deep

EXAMPLES:
- Simple: "{\\"property\\": \\"Task completed\\", \\"checkbox\\": {\\"equals\\": true}}"
- Compound: "{\\"and\\": [{\\"property\\": \\"Done\\", \\"checkbox\\": {\\"equals\\": true}}, {\\"or\\": [{\\"property\\": \\"Tags\\", \\"multi_select\\": {\\"contains\\": \\"A\\"}}, {\\"property\\": \\"Tags\\", \\"multi_select\\": {\\"contains\\": \\"B\\"}}]}]}"
- Timestamp: "{\\"timestamp\\": \\"created_time\\", \\"created_time\\": {\\"on_or_after\\": \\"2023-02-08\\"}}"`),
        sorts: z.array(sortSchema).nullable().optional().describe(`Array of sort objects. Earlier sorts take precedence. Each sort must use ONE of two formats:

1. PROPERTY VALUE SORT - Sort by any database property:
   { "property": "Property Name", "direction": "ascending" | "descending" }
   Example: { "property": "Name", "direction": "ascending" }

2. ENTRY TIMESTAMP SORT - Sort by entry creation or edit time:
   { "timestamp": "created_time" | "last_edited_time", "direction": "ascending" | "descending" }
   Example: { "timestamp": "last_edited_time", "direction": "descending" }

NESTED SORT EXAMPLE (multiple sorts):
[
  { "property": "Category", "direction": "ascending" },
  { "property": "Name", "direction": "ascending" }
]
First sorts by Category, then by Name within each category.`),
        page_size: z.number().int().min(1).max(100).nullable().optional().describe('Number of results per page (1-100). Default returns all results. Use pagination for large databases.'),
        start_cursor: z.string().nullable().optional().describe('Cursor from previous response to fetch next page. Use next_cursor from response when has_more is true.'),
        result_type: z.enum(['page', 'data_source']).nullable().optional().describe('Filter results to only pages or data sources. Only relevant for wiki databases.'),
    }),
    execute: async ({ filter_properties, filter, sorts, page_size, start_cursor, result_type }, runContext?: RunContext<SessionWithTracking<NotionDatabaseSession>>) => {
        console.log("Executing notion_query_database tool with filters:", { filter_properties, filter, sorts, page_size, start_cursor });
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const notion = new Client({
            auth: runContext.context.notionIntegration.integration_token,
        });


        // Build query parameters
        const queryParams: any = {
            data_source_id: runContext.context.notionConfig.database_id,
        };

        if (filter_properties && filter_properties.length > 0) {
            queryParams.filter_properties = filter_properties;
        }

        if (filter) {
            // Parse the JSON string
            let parsedFilter: Record<string, any>;
            try {
                parsedFilter = JSON.parse(filter);
            } catch (error) {
                return {
                    pages: [],
                    total_returned: 0,
                    has_more: false,
                    next_cursor: null,
                    error: 'Invalid JSON in filter parameter',
                    hint: 'Ensure filter is a valid JSON string'
                };
            }
            // Filter is validated by Notion API at runtime, so we can safely pass it through
            queryParams.filter = parsedFilter;
        }

        if (sorts && sorts.length > 0) {
            queryParams.sorts = sorts;
        }
        
        if (page_size) {
            queryParams.page_size = page_size;
        }

        if (start_cursor) {
            queryParams.start_cursor = start_cursor;
        }
        
        if (result_type) {
            queryParams.result_type = result_type;
        }

        // Fetch pages using data source query with filters
        const response = await notion.dataSources.query(queryParams);

        // Retrieve data source info to get the database URL
        const dataSourceInfo = await notion.dataSources.retrieve({
            data_source_id: runContext.context.notionConfig.database_id,
        });
        const databaseUrl = 'url' in dataSourceInfo ? dataSourceInfo.url : undefined;

        // Convert to readable format
        const pages = response.results.map((page: any) => {
            if (!page.properties) return null;

            // Extract all properties as simple key-value pairs
            const properties: Record<string, any> = {};
            for (const [key, value] of Object.entries(page.properties)) {
                properties[key] = extractPropertyValue(value);
            }

            return {
                page_id: page.id,
                properties: properties,
                url: page.url,
                created_time: page.created_time,
                last_edited_time: page.last_edited_time,
            };
        }).filter(Boolean);

        // Push run action to track the API call
        const databaseName = runContext.context.notionConfig.database_name || 'Unknown Database';
        const filterDescription = filter ? 'with filters' : 'without filters';
        runContext.context.trackAction({
            action: 'Queried database',
            integration: IntegrationType.NOTION,
            target: databaseName,
            details: `Queried database ${filterDescription} and retrieved ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`,
            url: databaseUrl,
            type: 'read',
        });

        console.log("Notion query database tool response: ", { 
            pages_count: pages.length, 
            has_more: response.has_more,
            next_cursor: response.next_cursor 
        });

        return {
            pages: pages,
            total_returned: pages.length,
            has_more: response.has_more || false,
            next_cursor: response.next_cursor || null,
        };
    },
    errorFunction: formatError
});

