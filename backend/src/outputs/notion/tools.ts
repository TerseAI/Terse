import { RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { Client } from '@notionhq/client';
import chalk from "chalk";
import { IntegrationType } from "../../shared/Integrations";
import { NotionDatabaseSession } from "./NotionDatabaseOutput";

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

// Helper function to build property filters based on property type
function buildPropertyFilter(propertyName: string, propertyType: string, filterData: any): any {
    const filter: any = { property: propertyName };

    switch (propertyType) {
        case 'title':
        case 'rich_text':
            filter[propertyType] = {};
            if (filterData.equals !== undefined) filter[propertyType].equals = filterData.equals;
            if (filterData.does_not_equal !== undefined) filter[propertyType].does_not_equal = filterData.does_not_equal;
            if (filterData.contains !== undefined) filter[propertyType].contains = filterData.contains;
            if (filterData.does_not_contain !== undefined) filter[propertyType].does_not_contain = filterData.does_not_contain;
            if (filterData.starts_with !== undefined) filter[propertyType].starts_with = filterData.starts_with;
            if (filterData.ends_with !== undefined) filter[propertyType].ends_with = filterData.ends_with;
            if (filterData.is_empty !== undefined) filter[propertyType].is_empty = filterData.is_empty;
            if (filterData.is_not_empty !== undefined) filter[propertyType].is_not_empty = filterData.is_not_empty;
            break;

        case 'number':
            filter.number = {};
            if (filterData.equals !== undefined) filter.number.equals = filterData.equals;
            if (filterData.does_not_equal !== undefined) filter.number.does_not_equal = filterData.does_not_equal;
            if (filterData.greater_than !== undefined) filter.number.greater_than = filterData.greater_than;
            if (filterData.less_than !== undefined) filter.number.less_than = filterData.less_than;
            if (filterData.greater_than_or_equal_to !== undefined) filter.number.greater_than_or_equal_to = filterData.greater_than_or_equal_to;
            if (filterData.less_than_or_equal_to !== undefined) filter.number.less_than_or_equal_to = filterData.less_than_or_equal_to;
            if (filterData.is_empty !== undefined) filter.number.is_empty = filterData.is_empty;
            if (filterData.is_not_empty !== undefined) filter.number.is_not_empty = filterData.is_not_empty;
            break;

        case 'checkbox':
            filter.checkbox = {};
            if (filterData.equals !== undefined) filter.checkbox.equals = filterData.equals;
            if (filterData.does_not_equal !== undefined) filter.checkbox.does_not_equal = filterData.does_not_equal;
            break;

        case 'select':
        case 'status':
            filter[propertyType] = {};
            if (filterData.equals !== undefined) filter[propertyType].equals = filterData.equals;
            if (filterData.does_not_equal !== undefined) filter[propertyType].does_not_equal = filterData.does_not_equal;
            if (filterData.is_empty !== undefined) filter[propertyType].is_empty = filterData.is_empty;
            if (filterData.is_not_empty !== undefined) filter[propertyType].is_not_empty = filterData.is_not_empty;
            break;

        case 'multi_select':
            filter.multi_select = {};
            if (filterData.equals !== undefined) filter.multi_select.equals = filterData.equals;
            if (filterData.does_not_equal !== undefined) filter.multi_select.does_not_equal = filterData.does_not_equal;
            if (filterData.contains !== undefined) filter.multi_select.contains = filterData.contains;
            if (filterData.does_not_contain !== undefined) filter.multi_select.does_not_contain = filterData.does_not_contain;
            if (filterData.is_empty !== undefined) filter.multi_select.is_empty = filterData.is_empty;
            if (filterData.is_not_empty !== undefined) filter.multi_select.is_not_empty = filterData.is_not_empty;
            break;

        case 'date':
            filter.date = {};
            if (filterData.equals !== undefined) filter.date.equals = filterData.equals;
            if (filterData.before !== undefined) filter.date.before = filterData.before;
            if (filterData.after !== undefined) filter.date.after = filterData.after;
            if (filterData.on_or_before !== undefined) filter.date.on_or_before = filterData.on_or_before;
            if (filterData.on_or_after !== undefined) filter.date.on_or_after = filterData.on_or_after;
            if (filterData.is_empty !== undefined) filter.date.is_empty = filterData.is_empty;
            if (filterData.is_not_empty !== undefined) filter.date.is_not_empty = filterData.is_not_empty;
            break;

        case 'people':
        case 'created_by':
        case 'last_edited_by':
            filter[propertyType] = {};
            if (filterData.contains !== undefined) filter[propertyType].contains = filterData.contains;
            if (filterData.does_not_contain !== undefined) filter[propertyType].does_not_contain = filterData.does_not_contain;
            if (filterData.is_empty !== undefined) filter[propertyType].is_empty = filterData.is_empty;
            if (filterData.is_not_empty !== undefined) filter[propertyType].is_not_empty = filterData.is_not_empty;
            break;

        case 'files':
            filter.files = {};
            if (filterData.is_empty !== undefined) filter.files.is_empty = filterData.is_empty;
            if (filterData.is_not_empty !== undefined) filter.files.is_not_empty = filterData.is_not_empty;
            break;

        case 'url':
        case 'email':
        case 'phone_number':
            filter[propertyType] = {};
            if (filterData.equals !== undefined) filter[propertyType].equals = filterData.equals;
            if (filterData.does_not_equal !== undefined) filter[propertyType].does_not_equal = filterData.does_not_equal;
            if (filterData.contains !== undefined) filter[propertyType].contains = filterData.contains;
            if (filterData.does_not_contain !== undefined) filter[propertyType].does_not_contain = filterData.does_not_contain;
            if (filterData.starts_with !== undefined) filter[propertyType].starts_with = filterData.starts_with;
            if (filterData.ends_with !== undefined) filter[propertyType].ends_with = filterData.ends_with;
            if (filterData.is_empty !== undefined) filter[propertyType].is_empty = filterData.is_empty;
            if (filterData.is_not_empty !== undefined) filter[propertyType].is_not_empty = filterData.is_not_empty;
            break;

        case 'relation':
            filter.relation = {};
            if (filterData.contains !== undefined) filter.relation.contains = filterData.contains;
            if (filterData.does_not_contain !== undefined) filter.relation.does_not_contain = filterData.does_not_contain;
            if (filterData.is_empty !== undefined) filter.relation.is_empty = filterData.is_empty;
            if (filterData.is_not_empty !== undefined) filter.relation.is_not_empty = filterData.is_not_empty;
            break;

        case 'unique_id':
            filter.unique_id = {};
            if (filterData.equals !== undefined) filter.unique_id.equals = filterData.equals;
            if (filterData.does_not_equal !== undefined) filter.unique_id.does_not_equal = filterData.does_not_equal;
            if (filterData.greater_than !== undefined) filter.unique_id.greater_than = filterData.greater_than;
            if (filterData.less_than !== undefined) filter.unique_id.less_than = filterData.less_than;
            if (filterData.greater_than_or_equal_to !== undefined) filter.unique_id.greater_than_or_equal_to = filterData.greater_than_or_equal_to;
            if (filterData.less_than_or_equal_to !== undefined) filter.unique_id.less_than_or_equal_to = filterData.less_than_or_equal_to;
            if (filterData.is_empty !== undefined) filter.unique_id.is_empty = filterData.is_empty;
            if (filterData.is_not_empty !== undefined) filter.unique_id.is_not_empty = filterData.is_not_empty;
            break;

        case 'formula':
            // Formula filters depend on the formula return type
            filter.formula = {};
            if (filterData.string) {
                const stringFilter = buildPropertyFilter('', 'rich_text', filterData.string);
                filter.formula.string = stringFilter.rich_text;
            } else if (filterData.checkbox) {
                const checkboxFilter = buildPropertyFilter('', 'checkbox', filterData.checkbox);
                filter.formula.checkbox = checkboxFilter.checkbox;
            } else if (filterData.number) {
                const numberFilter = buildPropertyFilter('', 'number', filterData.number);
                filter.formula.number = numberFilter.number;
            } else if (filterData.date) {
                const dateFilter = buildPropertyFilter('', 'date', filterData.date);
                filter.formula.date = dateFilter.date;
            }
            delete filter.property; // Formula doesn't use property name
            break;

        default:
            throw new Error(`Unsupported property type for filtering: ${propertyType}`);
    }

    return filter;
}

// Helper function to build timestamp filters
function buildTimestampFilter(timestamp: 'created_time' | 'last_edited_time', filterData: any): any {
    const filter: any = {};
    filter[timestamp] = {};

    if (filterData.equals !== undefined) filter[timestamp].equals = filterData.equals;
    if (filterData.before !== undefined) filter[timestamp].before = filterData.before;
    if (filterData.after !== undefined) filter[timestamp].after = filterData.after;
    if (filterData.on_or_before !== undefined) filter[timestamp].on_or_before = filterData.on_or_before;
    if (filterData.on_or_after !== undefined) filter[timestamp].on_or_after = filterData.on_or_after;
    if (filterData.is_empty !== undefined) filter[timestamp].is_empty = filterData.is_empty;
    if (filterData.is_not_empty !== undefined) filter[timestamp].is_not_empty = filterData.is_not_empty;

    return filter;
}

// Helper function to recursively build compound filters (and/or)
function buildCompoundFilter(filterInput: any): any {
    if (!filterInput) return undefined;

    // Handle compound filters
    if (filterInput.and) {
        return {
            and: filterInput.and.map((f: any) => buildCompoundFilter(f))
        };
    }

    if (filterInput.or) {
        return {
            or: filterInput.or.map((f: any) => buildCompoundFilter(f))
        };
    }

    // Handle timestamp filters
    if (filterInput.timestamp === 'created_time' || filterInput.timestamp === 'last_edited_time') {
        return buildTimestampFilter(filterInput.timestamp, filterInput);
    }

    // Handle property filters
    if (filterInput.property && filterInput.property_type) {
        return buildPropertyFilter(filterInput.property, filterInput.property_type, filterInput);
    }

    // If it's already a properly formatted filter, return as-is
    return filterInput;
}


function buildPropertySchema(propertyName: string, propertyConfig: any): any {
    const baseSchema: any = {
        type: propertyConfig.type,
        id: propertyConfig.id,
    };

    // Add format examples and options for each type
    switch (propertyConfig.type) {
        case 'title':
            baseSchema.format_example = `{"${propertyName}": {"title": [{"text": {"content": "Your text here"}}]}}`;
            break;
        case 'rich_text':
            baseSchema.format_example = `{"${propertyName}": {"rich_text": [{"text": {"content": "Your text here"}}]}}`;
            break;
        case 'number':
            baseSchema.format_example = `{"${propertyName}": {"number": 123}}`;
            break;
        case 'select':
            baseSchema.options = propertyConfig.select?.options?.map((opt: any) => opt.name) || [];
            baseSchema.format_example = `{"${propertyName}": {"select": {"name": "OptionName"}}}`;
            break;
        case 'multi_select':
            baseSchema.options = propertyConfig.multi_select?.options?.map((opt: any) => opt.name) || [];
            baseSchema.format_example = `{"${propertyName}": {"multi_select": [{"name": "Option1"}, {"name": "Option2"}]}}`;
            break;
        case 'status':
            baseSchema.options = propertyConfig.status?.options?.map((opt: any) => opt.name) || [];
            baseSchema.format_example = `{"${propertyName}": {"status": {"name": "StatusOption"}}}`;
            break;
        case 'date':
            baseSchema.format_example = `{"${propertyName}": {"date": {"start": "2025-01-15"}}}`;
            break;
        case 'checkbox':
            baseSchema.format_example = `{"${propertyName}": {"checkbox": true}}`;
            break;
        case 'url':
            baseSchema.format_example = `{"${propertyName}": {"url": "https://example.com"}}`;
            break;
        case 'email':
            baseSchema.format_example = `{"${propertyName}": {"email": "user@example.com"}}`;
            break;
        case 'phone_number':
            baseSchema.format_example = `{"${propertyName}": {"phone_number": "+1234567890"}}`;
            break;
    }

    return baseSchema;
}


export const notionGetSchemaTool = tool({
    name: 'notion_get_schema',
    description: `Gets the schema/structure of the Notion data source. This tool retrieves all property definitions including property names, types, valid options for select/status fields, and exact format examples for how to construct each property when writing to the database.

Use this tool:
- Before writing any data to determine available properties and their correct formats
- To understand what property names exist and their data types
- To get valid option values for select, multi_select, and status properties
- To see exact format examples for constructing properties in the Notion API format
- To determine how to write to the Notion database by understanding its structure

The schema information returned by this tool should be used to properly format properties when calling notion_modify_page to create or update pages in the database.`,
    parameters: z.object({
        // No parameters needed - uses the data_source_id (stored as database_id) from the session context
    }),
    execute: async ({ }, runContext?: RunContext<NotionDatabaseSession>) => {
        console.log("Executing notion_get_schema tool");
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const notion = new Client({
            auth: runContext.context.notionIntegration.integration_token,
        });

        // Fetch data source schema using the Notion API
        // The database_id in the config is actually the data_source_id
        const dataSourceInfo = await notion.dataSources.retrieve({
            data_source_id: runContext.context.notionConfig.database_id,
        });

        // Extract schema information with format examples
        const schema: Record<string, any> = {};
        for (const [propertyName, propertyConfig] of Object.entries(dataSourceInfo.properties as Record<string, any>)) {
            schema[propertyName] = buildPropertySchema(propertyName, propertyConfig);
        }

        console.log("Notion get schema tool response: ", { schema, property_count: Object.keys(schema).length });

        return {
            data_source_id: runContext.context.notionConfig.database_id,
            database_name: runContext.context.notionConfig.database_name || 'Unknown Database',
            schema: schema,
            property_count: Object.keys(schema).length,
        };
    }
});

// Zod schemas for filter parameters
const dateFilterSchema = z.object({
    equals: z.string().optional(),
    before: z.string().optional(),
    after: z.string().optional(),
    on_or_before: z.string().optional(),
    on_or_after: z.string().optional(),
    is_empty: z.boolean().optional(),
    is_not_empty: z.boolean().optional(),
});

const textFilterSchema = z.object({
    equals: z.string().optional(),
    does_not_equal: z.string().optional(),
    contains: z.string().optional(),
    does_not_contain: z.string().optional(),
    starts_with: z.string().optional(),
    ends_with: z.string().optional(),
    is_empty: z.boolean().optional(),
    is_not_empty: z.boolean().optional(),
});

const numberFilterSchema = z.object({
    equals: z.number().optional(),
    does_not_equal: z.number().optional(),
    greater_than: z.number().optional(),
    less_than: z.number().optional(),
    greater_than_or_equal_to: z.number().optional(),
    less_than_or_equal_to: z.number().optional(),
    is_empty: z.boolean().optional(),
    is_not_empty: z.boolean().optional(),
});

const checkboxFilterSchema = z.object({
    equals: z.boolean().optional(),
    does_not_equal: z.boolean().optional(),
});

const formulaFilterSchema: z.ZodType<any> = z.lazy(() => z.object({
    string: textFilterSchema.optional(),
    checkbox: checkboxFilterSchema.optional(),
    number: numberFilterSchema.optional(),
    date: dateFilterSchema.optional(),
}));

const propertyFilterSchema: z.ZodType<any> = z.lazy(() => z.object({
    property: z.string(),
    property_type: z.enum([
        'title', 'rich_text', 'number', 'checkbox', 'select', 'multi_select',
        'status', 'date', 'people', 'files', 'url', 'email', 'phone_number',
        'relation', 'created_by', 'last_edited_by', 'formula', 'unique_id'
    ]),
    // Conditionally include filter fields based on property type
}).passthrough());

const timestampFilterSchema = z.object({
    timestamp: z.enum(['created_time', 'last_edited_time']),
    equals: z.string().optional(),
    before: z.string().optional(),
    after: z.string().optional(),
    on_or_before: z.string().optional(),
    on_or_after: z.string().optional(),
    is_empty: z.boolean().optional(),
    is_not_empty: z.boolean().optional(),
});

const compoundFilterSchema: z.ZodType<any> = z.lazy(() => z.object({
    and: z.array(compoundFilterSchema).optional(),
    or: z.array(compoundFilterSchema).optional(),
}).or(propertyFilterSchema).or(timestampFilterSchema).or(formulaFilterSchema));

const sortSchema = z.object({
    property: z.string().optional(),
    timestamp: z.enum(['created_time', 'last_edited_time']).optional(),
    direction: z.enum(['ascending', 'descending']),
}).refine(
    (data) => (data.property !== undefined) !== (data.timestamp !== undefined),
    {
        message: "Either 'property' or 'timestamp' must be provided, but not both",
    }
);

// Tool 1: Query the Notion database with filtering, sorting, and pagination
export const notionQueryDatabaseTool = tool({
    name: 'notion_query_database',
    description: `Query a Notion data source (database) to retrieve pages that match specific criteria. This tool efficiently filters, sorts, and paginates results at the database layer for optimal performance.

WHEN TO USE THIS TOOL:
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
        filter: compoundFilterSchema.optional().describe('Filter object to query pages. Supports property filters, timestamp filters, and compound AND/OR logic. All filtering happens server-side for efficiency.'),
        filter_properties: z.array(z.string()).optional().describe('Array of property names or IDs to include in results. Only these properties will be returned, improving performance. Use property names from the database schema.'),
        sorts: z.array(sortSchema).optional().describe('Array of sort objects. Each sort specifies a property or timestamp and direction. Earlier sorts take precedence.'),
        page_size: z.number().int().min(1).max(100).optional().describe('Number of results per page (1-100). Default returns all results. Use pagination for large databases.'),
        start_cursor: z.string().optional().describe('Cursor from previous response to fetch next page. Use next_cursor from response when has_more is true.'),
        result_type: z.enum(['page', 'data_source']).optional().describe('Filter results to only pages or data sources. Only relevant for wiki databases.'),
    }),
    execute: async ({ filter, filter_properties, sorts, page_size, start_cursor, result_type }, runContext?: RunContext<NotionDatabaseSession>) => {
        console.log("Executing notion_query_database tool with filters:", { filter, filter_properties, sorts, page_size, start_cursor });
        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const notion = new Client({
            auth: runContext.context.notionIntegration.integration_token,
        });

        // Build the filter object for Notion API
        let notionFilter: any = undefined;
        if (filter) {
            notionFilter = buildCompoundFilter(filter);
        }

        // Build sort objects for Notion API
        let notionSorts: any[] | undefined = undefined;
        if (sorts && sorts.length > 0) {
            notionSorts = sorts.map(sort => {
                const sortObj: any = {
                    direction: sort.direction,
                };
                if (sort.property) {
                    sortObj.property = sort.property;
                } else if (sort.timestamp) {
                    sortObj.timestamp = sort.timestamp;
                }
                return sortObj;
            });
        }

        // Build query parameters
        const queryParams: any = {
            data_source_id: runContext.context.notionConfig.database_id,
        };

        if (notionFilter) {
            queryParams.filter = notionFilter;
        }

        if (notionSorts) {
            queryParams.sorts = notionSorts;
        }

        if (page_size !== undefined) {
            queryParams.page_size = page_size;
        }

        if (start_cursor) {
            queryParams.start_cursor = start_cursor;
        }

        if (result_type) {
            queryParams.result_type = result_type;
        }

        // Add filter_properties to query params (Notion SDK includes it in the main params)
        if (filter_properties && filter_properties.length > 0) {
            queryParams.filter_properties = filter_properties;
        }

        // Fetch pages using data source query with filters
        const response = await notion.dataSources.query(queryParams);

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
    }
});

// Tool 2: Modify (create or update) pages in the Notion database
export const notionModifyPageTool = tool({
    name: 'notion_modify_page',
    description: `Create a new page (row) in the Notion database or update an existing page. This tool writes data to the database.

WHEN TO USE THIS TOOL:
- When you need to create a new row/page in the database
- When you need to update properties of an existing page
- When you need to add, modify, or remove data from the database
- After querying the database to find pages that need updates

WHAT THIS TOOL DOES:
1. Creates a new page if page_id is null (or not provided)
2. Updates an existing page if a valid page_id is provided
3. Sets or modifies database properties according to the provided properties_json

BEFORE USING THIS TOOL:
- Use notion_get_schema to understand the database structure, property names, types, and valid values
- For updates: Use notion_query_database to find the page_id of the page you want to update
- Ensure property names exactly match the database schema (case-sensitive)
- Use the exact format examples from notion_get_schema for each property type

PROPERTY FORMAT REQUIREMENTS:
Properties must use Notion's API format. The format depends on the property type:
- Title: {"PropertyName": {"title": [{"text": {"content": "value"}}]}}
- Rich Text: {"PropertyName": {"rich_text": [{"text": {"content": "value"}}]}}
- Number: {"PropertyName": {"number": 123}}
- Select: {"PropertyName": {"select": {"name": "OptionName"}}}
- Status: {"PropertyName": {"status": {"name": "StatusName"}}}
- Multi-select: {"PropertyName": {"multi_select": [{"name": "Tag1"}, {"name": "Tag2"}]}}
- Checkbox: {"PropertyName": {"checkbox": true}}
- Date: {"PropertyName": {"date": {"start": "2025-01-15"}}}
- URL: {"PropertyName": {"url": "https://example.com"}}
- Email: {"PropertyName": {"email": "user@example.com"}}

IMPORTANT:
- Property names must match exactly (case-sensitive) with the database schema
- Select/Status values must match exact option names from the schema
- Use notion_get_schema to get format_example for each property type
- page_id must be null (not empty string, not ".") to create a new page
- page_id must be a valid UUID from notion_query_database results to update`,
    parameters: z.object({
        page_id: z.string().nullable().describe('The ID of the page to update (from notion_query_database). MUST be null (not empty string, not period) to create a new page. Only provide a valid page ID string to update an existing page.'),
        properties_json: z.string().describe('JSON string with property names as keys and Notion-formatted values. Example: "{\\"Name\\": {\\"title\\": [{\\"text\\": {\\"content\\": \\"New Item\\"}}]}, \\"Status\\": {\\"select\\": {\\"name\\": \\"In Progress\\"}}}"'),
    }),
    needsApproval: async (_context, { page_id, properties_json }) => {
        return false; // DISABLE UNTIL HUMAN IN THE LOOP IS IMPLEMENTED
    },
    execute: async ({ page_id, properties_json }, runContext?: RunContext<NotionDatabaseSession>) => {
        console.log(chalk.bgMagenta.white.bold('🛠️ Executing notion_modify_page tool'));
        console.log(chalk.cyan('  Page ID: '), chalk.yellow(page_id ?? '(new page)'));
        console.log(chalk.cyan('  Properties JSON: '), chalk.greenBright(properties_json));

        // Parse the JSON string
        let properties: Record<string, any>;
        try {
            properties = JSON.parse(properties_json);
        } catch (error) {
            return {
                success: false,
                error: 'Invalid JSON in properties_json parameter',
                hint: 'Ensure properties_json is a valid JSON string'
            };
        }

        if (!runContext?.context) {
            throw new Error("No context provided");
        }

        const notion = new Client({
            auth: runContext.context.notionIntegration.integration_token,
        });

        // Validate page_id - must be null or a valid UUID-like string (no slashes, periods, or other special chars)
        const validPageId = page_id && page_id.length > 30 && !page_id.includes('/') && page_id !== '.' ? page_id : null;

        try {
            if (validPageId) {
                // Update existing page
                const response = await notion.pages.update({
                    page_id: validPageId,
                    properties: properties as Record<string, any>,
                });
                // Report action (no DB writes here)
                const databaseName = runContext.context.notionConfig.database_name || 'Notion database';
                runContext.context.runActions = runContext.context.runActions || [];
                runContext.context.runActions.push({
                    action: 'Updated page',
                    integration: IntegrationType.NOTION,
                    target: databaseName,
                    details: 'Updated page in database',
                    url: 'url' in response ? (response as any).url : undefined,
                });
                return {
                    success: true,
                    action: 'updated',
                    page_id: response.id,
                    url: 'url' in response ? response.url : undefined
                };
            } else {
                // Create new page
                const response = await notion.pages.create({
                    parent: {
                        type: 'data_source_id',
                        data_source_id: runContext.context.notionConfig.database_id,
                    },
                    properties: properties as Record<string, any>,
                });
                console.log(chalk.green("Notion database modified successfully"));
                // Report action (no DB writes here)
                const databaseName = runContext.context.notionConfig.database_name || 'Notion database';
                runContext.context.runActions = runContext.context.runActions || [];
                runContext.context.runActions.push({
                    action: 'Created page',
                    integration: IntegrationType.NOTION,
                    target: databaseName,
                    details: 'Created new page in database',
                    url: 'url' in response ? (response as any).url : undefined,
                });
                return {
                    success: true,
                    action: 'created',
                    page_id: response.id,
                    url: 'url' in response ? response.url : undefined
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                hint: 'Check that property names match the database schema and values are in correct Notion API format'
            };
        }
    }
});

