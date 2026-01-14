import jwt, { SignOptions } from 'jsonwebtoken';
import { jwt as jwtConfig } from '../config/settings';

export interface OAuthStatePayloadOptions {
    /**
     * User ID (required)
     */
    userId: string;
    
    /**
     * Additional fields to include in the state payload (e.g., isBotUser, timestamp)
     */
    additionalFields?: Record<string, any>;
    
    /**
     * Additional state payload variables to merge (e.g., chat metadata)
     */
    additionalStatePayload?: Record<string, string>;
    
    /**
     * JWT expiration time (default: "10m")
     */
    expiresIn?: string;
    
    /**
     * Whether to encode the token as URI component (default: false)
     */
    encodeAsUriComponent?: boolean;
}


export function createOAuthStateToken(options: OAuthStatePayloadOptions): string {
    const {
        userId,
        additionalFields = {},
        additionalStatePayload,
        expiresIn = '10m',
        encodeAsUriComponent = false,
    } = options;

    // Create base state payload with userId
    const statePayload: any = { userId, ...additionalFields };

    // Merge any additional state payload variables
    if (additionalStatePayload && typeof additionalStatePayload === 'object') {
        Object.assign(statePayload, additionalStatePayload);
    }

    // Sign the JWT token
    const jwtToken = jwt.sign(statePayload, jwtConfig.secret, { expiresIn: expiresIn as any });

    // Optionally encode as URI component
    return encodeAsUriComponent ? encodeURIComponent(jwtToken) : jwtToken;
}
