/**
 * Safely decodes a URI component, returning the original string if decoding fails.
 * This prevents URIError from being thrown when encountering malformed percent-encoded sequences.
 * 
 * @param encoded - The URI-encoded string to decode
 * @returns The decoded string, or the original string if decoding fails
 * 
 * @example
 * safeDecodeURIComponent('Hello%20World') // 'Hello World'
 * safeDecodeURIComponent('%E0%A4%A') // '%E0%A4%A' (returns original on error)
 */
export function safeDecodeURIComponent(encoded: string): string {
    try {
        return decodeURIComponent(encoded);
    } catch (error) {
        // If decoding fails (e.g., malformed percent-encoded sequence),
        // return the original string to prevent crashes
        if (error instanceof URIError) {
            return encoded;
        }
        // Re-throw non-URIError exceptions
        throw error;
    }
}
