import { PageObjectResponse, PartialPageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * Helper function to extract page title from Notion page properties.
 * Notion pages don't have a direct title property - the title is stored
 * in the properties object, typically as a property with type 'title'.
 */
export function extractPageTitle(page: PageObjectResponse | PartialPageObjectResponse): string {
  // Check if this is a full page object with properties
  if (!('properties' in page) || !page.properties) {
    return "Untitled Page";
  }

  // Look for a title property (usually the first property or one named "Title")
  const properties = page.properties;
  
  // Try common title property names first
  const titleProperty = properties.Title || properties.title || 
    Object.values(properties).find((prop: any) => prop.type === 'title');
  
  if (titleProperty && 'type' in titleProperty && titleProperty.type === 'title' && 'title' in titleProperty) {
    const titleArray = titleProperty.title;
    if (Array.isArray(titleArray) && titleArray.length > 0) {
      return titleArray.map((t: any) => t.plain_text || '').join('').trim() || "Untitled Page";
    }
  }
  
  return "Untitled Page";
}

