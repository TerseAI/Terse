import jwt, { SignOptions } from 'jsonwebtoken';
import { jwt as jwtConfig } from '../config/settings';

/**
 * Encoding format for OAuth state tokens
 */
export enum OAuthStateEncodingFormat {
    /**
     * Sign as JWT token (used by Slack, Linear, Figma, etc.)
     */
    JWT = 'jwt',
    /**
     * Encode as base64 JSON string (used by GitHub, Gmail)
     */
    BASE64 = 'base64',
}

/**
 * OAuth state payload structure (decoded state token)
 * This represents the structure of the state payload used in OAuth flows
 * Generic type that can contain any fields - specific fields are added at runtime
 */
export interface OAuthStatePayload {
    /**
     * User ID (required)
     */
    userId: string;
    
    /**
     * JWT standard claims (added by jwt.sign when using JWT encoding)
     */
    exp?: number;
    iat?: number;
    nbf?: number;
    
    /**
     * Additional dynamic fields from additionalFields or additionalStatePayload
     */
    [key: string]: any;
}

export interface OAuthStatePayloadOptions {
    /**
     * User ID (required)
     */
    userId: string;
    
    /**
     * Additional fields to include in the state payload (e.g., isBotUser, random, timestamp)
     */
    additionalFields?: Record<string, any>;
    
    /**
     * Additional state payload variables to merge (e.g., chat metadata)
     */
    additionalStatePayload?: Record<string, string>;
    
    /**
     * JWT expiration time (default: "10m")
     * Only used when encodingFormat is OAuthStateEncodingFormat.JWT
     */
    expiresIn?: string;
    
    /**
     * Whether to encode the token as URI component (default: false)
     */
    encodeAsUriComponent?: boolean;
    
    /**
     * Encoding format (default: OAuthStateEncodingFormat.JWT)
     */
    encodingFormat?: OAuthStateEncodingFormat;
}

/**
 * Creates an OAuth state token with the specified options
 * Handles all merging logic and encoding internally
 */
export function createOAuthStateToken(options: OAuthStatePayloadOptions): string {
    const {
        userId,
        additionalFields = {},
        additionalStatePayload,
        expiresIn = '10m',
        encodeAsUriComponent = false,
        encodingFormat = OAuthStateEncodingFormat.JWT,
    } = options;

    // Create base state payload with userId
    const statePayload: OAuthStatePayload = { userId, ...additionalFields };

    // Merge any additional state payload variables
    if (additionalStatePayload && typeof additionalStatePayload === 'object') {
        Object.assign(statePayload, additionalStatePayload);
    }

    let encodedState: string;

    if (encodingFormat === OAuthStateEncodingFormat.BASE64) {
        // Encode as base64 JSON string (used by GitHub, Gmail)
        encodedState = Buffer.from(JSON.stringify(statePayload)).toString('base64');
    } else {
        // Sign as JWT token (default, used by Slack, Linear, Figma, etc.)
        const jwtToken = jwt.sign(statePayload, jwtConfig.secret, { expiresIn: expiresIn as any });
        encodedState = jwtToken;
    }

    // Optionally encode as URI component
    return encodeAsUriComponent ? encodeURIComponent(encodedState) : encodedState;
}

/**
 * Decodes an OAuth state token
 * Handles both JWT and base64 JSON formats
 */
export function decodeOAuthStateToken(state: string): OAuthStatePayload {
    try {
        // Try JWT first (most common)
        return jwt.verify(state, jwtConfig.secret) as OAuthStatePayload;
    } catch (jwtError) {
        // If JWT fails, try base64 JSON (used by GitHub, Gmail)
        try {
            return JSON.parse(Buffer.from(state, 'base64').toString('utf-8')) as OAuthStatePayload;
        } catch (base64Error) {
            throw new Error(`Failed to decode state token: ${jwtError instanceof Error ? jwtError.message : 'Unknown error'}`);
        }
    }
}
