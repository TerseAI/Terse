/**
 * Extracts file key from Figma URL or returns the input if it's already a file key
 * Supports formats:
 * - https://www.figma.com/design/{fileKey}/...
 * - https://www.figma.com/file/{fileKey}/...
 * - https://figma.com/design/{fileKey}/...
 * - https://www.figma.com/files/team/...?fuid={fileKey} (team URL format)
 * - Direct file key: abc123def456ghi789jkl012
 * 
 * @param input - Figma URL or direct file key
 * @returns File key or null if invalid
 */
export function extractFileKeyFromFigmaUrl(input: string): string | null {
    try {
        // Remove leading/trailing whitespace
        const trimmed = input.trim();
        
        // First, check if it's already a direct file key (22+ alphanumeric characters)
        // File keys are typically 22 alphanumeric characters
        if (/^[a-zA-Z0-9]{22,}$/.test(trimmed)) {
            return trimmed;
        }
        
        // First, try to extract from fuid parameter (team URL format)
        const fuidMatch = trimmed.match(/[?&]fuid=([a-zA-Z0-9]{22,})/i);
        if (fuidMatch && fuidMatch[1]) {
            return fuidMatch[1];
        }
        
        // Try to match Figma URL patterns
        // Pattern 1: /design/{fileKey}/ or /file/{fileKey}/
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

/**
 * Extracts team ID from Figma URL or returns the input if it's already a team ID
 * Supports formats like:
 * - https://www.figma.com/files/team/1557541588002670308/project/...
 * - https://figma.com/files/team/1557541588002670308/project/...
 * - Direct team ID: 1557541588002670308
 * 
 * @param input - Figma URL containing team ID or direct team ID
 * @returns Team ID or null if invalid
 */
export function extractTeamIdFromFigmaUrl(input: string): string | null {
    try {
        // Remove leading/trailing whitespace
        const trimmed = input.trim();
        
        // First, check if it's already a direct team ID (numeric string)
        // Team IDs are typically numeric strings of varying lengths
        if (/^[0-9]+$/.test(trimmed)) {
            return trimmed;
        }
        
        // Try to match Figma URL pattern with team ID
        // Pattern: /files/team/{teamId}/
        const teamPattern = /figma\.com\/files\/team\/([0-9]+)/i;
        const match = trimmed.match(teamPattern);
        
        if (match && match[1]) {
            return match[1];
        }
        
        return null;
    } catch (error) {
        console.error('Error parsing Figma team ID from URL:', error);
        return null;
    }
}

