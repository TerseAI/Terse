import { Jwt } from "../utility/jwt.js";
import { login as loginUser, findUserByEmail, createUser, updateUserGitHubUsername } from "../types/user.js";
import axios from "axios";
import crypto from "crypto";
const COOKIE_NAME = 'AUTH_JWT';
const GITHUB_STATE_COOKIE = 'GITHUB_OAUTH_STATE';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/auth/github/callback';
const GITHUB_LOGIN_REDIRECT = process.env.GITHUB_LOGIN_REDIRECT || 'http://localhost:3000';
export const authMiddleware = async (req, res, next) => {
    try {
        if (!req.cookies || !req.cookies[COOKIE_NAME]) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const token = req.cookies[COOKIE_NAME];
        const user = await new Jwt().verify(token);
        if (!user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        // Create session object
        const session = {
            user: user,
        };
        req.session = session;
        next();
    }
    catch (error) {
        next(error); // Pass errors to error handler
    }
};
export async function me(req, res) {
    try {
        res.send(req.session?.user);
    }
    catch (error) {
        console.error('Failed to retrieve session user:', error);
        res.status(500).json({ message: 'Failed to fetch user information' });
    }
}
export async function login(req, res) {
    console.log('login route has been hit');
    console.log('req.body', req.body);
    try {
        const user = await loginUser(req.body.email, req.body.password);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Create JWT
        const token = await new Jwt().sign(user.id);
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });
        console.log('Login successful for user:', user.email);
        res.json({
            message: 'Login successful',
            user: user
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}
export function logout(req, res) {
    console.log('logout route has been hit');
    try {
        res.clearCookie(COOKIE_NAME);
        res.send({
            message: 'Logout successful',
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Failed to logout' });
    }
}
export async function githubLogin(req, res) {
    const state = crypto.randomBytes(8).toString('hex');
    res.cookie(GITHUB_STATE_COOKIE, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });
    const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_CALLBACK_URL)}&scope=read:user%20user:email&state=${state}`;
    res.redirect(redirectUrl);
}
export async function githubCallback(req, res) {
    const { code, state } = req.query;
    console.log('githubCallback', req.query, req.body);
    if (!code || !state || state !== req.cookies[GITHUB_STATE_COOKIE]) {
        return res.status(400).send('Invalid OAuth state');
    }
    res.clearCookie(GITHUB_STATE_COOKIE);
    try {
        const tokenResp = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: GITHUB_CALLBACK_URL,
        }, {
            headers: { Accept: 'application/json' }
        });
        const accessToken = tokenResp.data.access_token;
        if (!accessToken) {
            return res.status(400).send('Failed to obtain access token');
        }
        const userResp = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        console.log('userResp', userResp.data);
        let email = userResp.data.email;
        const name = userResp.data.name || userResp.data.login;
        const githubUsername = userResp.data.login;
        if (!email) {
            const emailsResp = await axios.get('https://api.github.com/user/emails', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const primary = emailsResp.data.find((e) => e.primary) || emailsResp.data[0];
            email = primary?.email;
        }
        if (!email) {
            return res.status(400).send('Email not available');
        }
        let user = await findUserByEmail(email);
        if (!user) {
            // Create new user with GitHub username
            await createUser(name, email, githubUsername);
            user = await findUserByEmail(email);
        }
        else if (user.github_username !== githubUsername) {
            // Update existing user's GitHub username if it's different
            await updateUserGitHubUsername(user.id, githubUsername);
            user = await findUserByEmail(email);
        }
        if (!user) {
            return res.status(500).send('Failed to create or find user');
        }
        const token = await new Jwt().sign(user.id);
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });
        res.redirect(GITHUB_LOGIN_REDIRECT);
    }
    catch (error) {
        console.error('GitHub OAuth error:', error);
        res.status(500).send('Authentication failed');
    }
}
export default { me, login, logout, githubLogin, githubCallback };
//# sourceMappingURL=auth.js.map