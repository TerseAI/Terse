import { Request, Response } from "express";
import { Jwt } from "../../utility/jwt";
import crypto from "crypto";
import chalk from "chalk";
import { findUserByEmail, createUser } from "../../types/user";
import { google } from "googleapis";
import { gmail, googleAuth } from "../../config/settings";
import logger from "../../logger";

// Google OAuth scopes for login (different from Gmail integration)
const GOOGLE_LOGIN_SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

// Create OAuth2 client for Google login
function getGoogleAuthClient() {
    return new google.auth.OAuth2(
        gmail.clientId,
        gmail.clientSecret,
        googleAuth.callbackUrl
    );
}

export function googleLoginURL(req: Request, res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const oauth2Client = getGoogleAuthClient();

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'online', // We don't need refresh token for login
        scope: GOOGLE_LOGIN_SCOPES,
        state: state
    });

    res.json({ url: authUrl });
}

export async function googleLogin(req: Request, res: Response) {
    logger.debug('googleLogin route has been hit');
    const state = crypto.randomBytes(16).toString('hex');
    const oauth2Client = getGoogleAuthClient();

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'online',
        scope: GOOGLE_LOGIN_SCOPES,
        state: state
    });

    logger.debug('Google auth URL', { authUrl });
    res.redirect(authUrl);
}

export async function googleCallback(req: Request, res: Response) {
    const { code, state } = req.query as { code?: string; state?: string };

    logger.info('Google OAuth callback received', { query: req.query });

    if (!code || !state) {
        return res.status(400).send('Invalid OAuth state');
    }

    try {
        const oauth2Client = getGoogleAuthClient();

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        if (!tokens.access_token) {
            return res.status(400).send('Failed to obtain access token');
        }

        // Get user info from Google
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        const email = userInfo.data.email;
        const name = userInfo.data.name || email?.split('@')[0] || 'Unknown';

        if (!email) {
            return res.status(400).send('Email not available from Google');
        }

        // Find or create user
        let user = await findUserByEmail(email);
        if (!user) {
            // Create new user
            user = await createUser(name, email, null, 'google');
        } else {
            logger.debug('Existing user', { userId: user.id, email: user.email });
        }

        if (!user) {
            return res.status(500).send('Failed to create or find user');
        }

        const token = await new Jwt().sign(user.id);

        res.send(`
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GOOGLE_AUTH_SUCCESS',
                  token: '${token}'
                }, '${googleAuth.loginRedirect}');
                window.close();
              }
            </script>
          `);
    } catch (error) {
        logger.error('Google OAuth error:', { error });
        res.status(500).send('Authentication failed');
    }
}