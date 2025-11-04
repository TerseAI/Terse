/**
 * Extracts file key from Figma URL
 * Supports formats:
 * - https://www.figma.com/design/{fileKey}/...
 * - https://www.figma.com/file/{fileKey}/...
 * - https://figma.com/design/{fileKey}/...
 * 
 * @param url - Figma URL
 * @returns File key or null if invalid
 */
export function extractFileKeyFromFigmaUrl(url: string): string | null {
    try {
        // Remove leading/trailing whitespace
        const trimmed = url.trim();
        
        // Try to match Figma URL patterns
        // Pattern 1: /design/{fileKey}/ or /file/{fileKey}/
        // File keys are typically 22 alphanumeric characters
        const designPattern = /figma\.com\/(?:design|file)\/([a-zA-Z0-9]{22,})/i;
        const match = trimmed.match(designPattern);
        
        if (match && match[1]) {
            return match[1];
        }
        
        return null;
    } catch (error) {
        console.error('Error parsing Figma URL:', error);
        return null;
    }
}

/**
 * Validates if a string is a valid Figma URL
 */
export function isValidFigmaUrl(url: string): boolean {
    return extractFileKeyFromFigmaUrl(url) !== null;
}

/**
 * Constructs a clean Figma file URL from a file key
 */
export function buildFigmaFileUrl(fileKey: string): string {
    return `https://www.figma.com/file/${fileKey}`;
}

