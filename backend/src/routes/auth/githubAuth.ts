import { NextFunction, Request, Response } from "express";
import { COOKIE_NAME } from "../auth";
import { Jwt } from "../../utility/jwt";
import crypto from "crypto";
import chalk from "chalk";
import axios from "axios";
import { findUserByEmail, findUserByGitHubUsername, createUser, updateUserGitHubUsername } from "../../types/user";
import { githubApp, githubAuth } from "../../config/settings";

export const githubAppAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    console.log('githubAppAuthMiddleware route has been hit')
    try {
        let token: string | null = null;

        // First try to get token from Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7); // Remove 'Bearer ' prefix
        } else if (req.cookies && req.cookies[COOKIE_NAME]) {
            // Fall back to cookie
            token = req.cookies[COOKIE_NAME];
        }

        if (!token) {
            res.status(401).json({ message: 'Unauthorized - No token provided' });
            return;
        }

        const isGitHubApp = await new Jwt().verifyGitHubApp(token);
        if (!isGitHubApp) {
            res.status(401).json({ message: 'Unauthorized - Invalid GitHub app token' });
            return;
        }
        next();
    } catch (error) {
        console.error('GitHub app auth middleware error:', error);
        res.status(401).json({ message: 'Unauthorized - Token verification failed' });
    }
}

export function githubLoginURL(req: Request, res: Response) {
    const state = crypto.randomBytes(8).toString('hex');
    const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${githubAuth.clientId}&redirect_uri=${encodeURIComponent(githubAuth.callbackUrl)}&scope=read:user%20user:email&state=${state}`;
    res.json({ url: redirectUrl });
}

export async function githubLogin(req: Request, res: Response) {
    console.log('githubLogin route has been hit')
    const state = crypto.randomBytes(8).toString('hex');
    const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${githubAuth.clientId}&redirect_uri=${encodeURIComponent(githubAuth.callbackUrl)}&scope=read:user%20user:email&state=${state}`;

    console.log('redirectUrl', redirectUrl)
    res.redirect(redirectUrl);
}

export async function githubCallback(req: Request, res: Response) {
    const { code, state } = req.query as { code?: string; state?: string };

    console.log(chalk.blue('🔗 Github OAuth callback received:'), chalk.cyan(JSON.stringify(req.query, null, 2)), chalk.yellow(JSON.stringify(req.body, null, 2)));

    if (!code || !state) {
        return res.status(400).send('Invalid OAuth state');
    }

    try {
        const tokenResp = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: githubAuth.clientId,
            client_secret: githubAuth.clientSecret,
            code,
            redirect_uri: githubAuth.callbackUrl,
        }, {
            headers: { Accept: 'application/json' }
        });

        const githubAccessToken = tokenResp.data.access_token;
        if (!githubAccessToken) {
            return res.status(400).send('Failed to obtain access token');
        }

        const userResp = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${githubAccessToken}` }
        });

        console.log('GitHub OAuth user response:', userResp.data)

        let email = userResp.data.email as string | null;
        const name = (userResp.data.name as string) || (userResp.data.login as string);
        const githubUsername = userResp.data.login as string;

        if (!email) {
            const emailsResp = await axios.get('https://api.github.com/user/emails', {
                headers: { Authorization: `Bearer ${githubAccessToken}` }
            });
            const primary = emailsResp.data.find((e: any) => e.primary) || emailsResp.data[0];
            email = primary?.email;
        }

        if (!email) {
            return res.status(400).send('Email not available');
        }

        let user = await findUserByGitHubUsername(githubUsername);
        if (!user) {
            // Create new user with GitHub username
            user = await createUser(name, email, githubUsername);
        } else if (user.github_username !== githubUsername) {
            // Update existing user's GitHub username if it's different
            await updateUserGitHubUsername(user.id, githubUsername);
            user = await findUserByEmail(email);
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
                  type: 'GITHUB_AUTH_SUCCESS',
                  token: '${token}'
                }, '${githubAuth.loginRedirect}');
                window.close();
              }
            </script>
          `);
    } catch (error) {
        console.error('GitHub OAuth error:', error);
        res.status(500).send('Authentication failed');
    }
}

export async function githubAppOAuth(req: Request, res: Response) {
    console.log('githubAppOAuth route has been hit');

    const state = crypto.randomBytes(16).toString('hex');

    const clientId = githubApp.clientId;
    const redirectUri = githubAuth.callbackUrl;

    const scopes = [
        'read:user',
        'read:org'
    ].join('%20');

    const url = 
      `https://github.com/login/oauth/authorize?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scopes}` +
      `&state=${state}`;

    res.redirect(url);
}