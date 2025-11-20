import { PageObjectResponse, PartialPageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

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

export function getBlockTypeName(block: any): string {
  // For update operations, the block might have properties like { paragraph: {...} } or { heading_1: {...} }
  // For append operations, blocks have a 'type' property
  let blockType: string | undefined;
  
  if (block.type) {
    blockType = block.type;
  } else {
    // Check for type-specific properties (e.g., paragraph, heading_1, etc.)
    const typeProperties = [
      'paragraph', 'heading_1', 'heading_2', 'heading_3',
      'bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle',
      'code', 'quote', 'callout', 'divider', 'table',
      'image', 'video', 'file', 'bookmark', 'link_preview', 'link_to_page'
    ];
    for (const prop of typeProperties) {
      if (prop in block) {
        blockType = prop;
        break;
      }
    }
  }
  
  const typeMap: Record<string, string> = {
    'paragraph': 'paragraph',
    'heading_1': 'heading',
    'heading_2': 'heading',
    'heading_3': 'heading',
    'bulleted_list_item': 'bullet point',
    'numbered_list_item': 'numbered item',
    'to_do': 'to-do item',
    'toggle': 'toggle',
    'code': 'code block',
    'quote': 'quote',
    'callout': 'callout',
    'divider': 'divider',
    'table': 'table',
    'image': 'image',
    'video': 'video',
    'file': 'file',
    'bookmark': 'bookmark',
    'link_preview': 'link',
    'link_to_page': 'page link',
  };
  return typeMap[blockType || ''] || 'content';
}

export function describeBlocks(blocks: any[]): string {
  if (blocks.length === 0) return 'content';
  if (blocks.length === 1) {
    return getBlockTypeName(blocks[0]);
  }
  
  // Count block types
  const typeCounts: Record<string, number> = {};
  blocks.forEach(block => {
    const typeName = getBlockTypeName(block);
    typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
  });
  
  const parts: string[] = [];
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count === 1) {
      parts.push(`1 ${type}`);
    } else {
      parts.push(`${count} ${type}s`);
    }
  }
  
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts.join(' and ');
  return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
}

