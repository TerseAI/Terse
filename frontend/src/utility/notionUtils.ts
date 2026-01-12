/**
 * Formats a Notion page or database ID into a Notion URL.
 * 
 * @param id - The Notion page or database ID (UUID format)
 * @param title - Optional title to include in the URL slug for better readability
 * @returns A formatted Notion URL with the native deep link format
 * 
 * @example
 * getNotionUrl('2c171d11-679e-8087-ab78-f4e892dafb2a', 'Weekly Release Notes Terse')
 * // Returns: 'https://www.notion.so/native/weekly-release-notes-terse-2c171d11679e8087ab78f4e892dafb2a?deepLinkOpenNewTab=true'
 */
export function getNotionUrl(id: string, title?: string): string {
    // Remove hyphens from UUID (Notion URLs use IDs without hyphens)
    const idWithoutHyphens = id.replace(/-/g, '');
    
    // Create title slug if title is provided
    let urlPath = idWithoutHyphens;
    if (title) {
        // Convert title to URL-friendly slug: lowercase, replace spaces/special chars with hyphens
        const slug = title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        
        if (slug) {
            urlPath = `${slug}-${idWithoutHyphens}`;
        }
    }
    
    return `https://www.notion.so/native/${urlPath}?deepLinkOpenNewTab=true`;
}

