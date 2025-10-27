import { Request, Response } from "express";
import { Jwt } from "../../utility/jwt";
import crypto from "crypto";
import chalk from "chalk";
import { findUserByEmail, createUser } from "../../types/user";
import { google } from "googleapis";

// Validate Google Auth environment variables (reusing Gmail OAuth client)
if (!process.env.GMAIL_CLIENT_ID) {
    throw new Error('GMAIL_CLIENT_ID is not set in environment variables (required for Google login)');
}
if (!process.env.GMAIL_CLIENT_SECRET) {
    throw new Error('GMAIL_CLIENT_SECRET is not set in environment variables (required for Google login)');
}
if (!process.env.GOOGLE_AUTH_CALLBACK_URL) {
    throw new Error('GOOGLE_AUTH_CALLBACK_URL is not set in environment variables');
}
if (!process.env.GOOGLE_LOGIN_REDIRECT) {
    throw new Error('GOOGLE_LOGIN_REDIRECT is not set in environment variables');
}

const GOOGLE_AUTH_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GOOGLE_AUTH_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GOOGLE_AUTH_CALLBACK_URL = process.env.GOOGLE_AUTH_CALLBACK_URL;
const GOOGLE_LOGIN_REDIRECT = process.env.GOOGLE_LOGIN_REDIRECT;

// Google OAuth scopes for login (different from Gmail integration)
const GOOGLE_LOGIN_SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

// Create OAuth2 client for Google login
function getGoogleAuthClient() {
    return new google.auth.OAuth2(
        GOOGLE_AUTH_CLIENT_ID,
        GOOGLE_AUTH_CLIENT_SECRET,
        GOOGLE_AUTH_CALLBACK_URL
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
    console.log('googleLogin route has been hit');
    const state = crypto.randomBytes(16).toString('hex');
    const oauth2Client = getGoogleAuthClient();

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'online',
        scope: GOOGLE_LOGIN_SCOPES,
        state: state
    });

    console.log('Google auth URL', authUrl);
    res.redirect(authUrl);
}

export async function googleCallback(req: Request, res: Response) {
    const { code, state } = req.query as { code?: string; state?: string };

    console.log(chalk.blue('🔗 Google OAuth callback received:'), chalk.cyan(JSON.stringify(req.query, null, 2)));

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
            user = await createUser(name, email, null);
        } else {
            console.log('Existing user', user)
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
                }, '${GOOGLE_LOGIN_REDIRECT}');
                window.close();
              }
            </script>
          `);
    } catch (error) {
        console.error('Google OAuth error:', error);
        res.status(500).send('Authentication failed');
    }
}