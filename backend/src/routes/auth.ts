import { NextFunction, Request, Response } from "express";
import { Jwt } from "../utility/jwt";
import { login as loginUser } from "../types/user";
import { Session } from "../types/session";
import { nodeEnv, optional } from "../config/settings";
import logger, { setUserContext } from "../logger";

export const COOKIE_NAME = 'AUTH_JWT';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.cookies || !req.cookies[COOKIE_NAME]) {
            logger.debug('Unauthorized - No cookie provided');
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const token = req.cookies[COOKIE_NAME];
        const user = await new Jwt().verify(token);

        if (!user) {
            logger.debug('Unauthorized - No user found');
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        // If user is verified, refresh the token to extend session
        const newToken = await new Jwt().sign(user.id);
        res.cookie(COOKIE_NAME, newToken, {
            httpOnly: true,
            secure: nodeEnv === 'production',
            sameSite: nodeEnv === 'production' ? 'none' : 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Create session object
        const session: Session = {
            user: user,
            isUserInitiated: true,
        };

        req.session = session;
        
        // Set user context for logging
        setUserContext(user.id, user.email);
        
        next();
    } catch (error) {
        next(error); // Pass errors to error handler
    }
}

export async function setSession(req: Request, res: Response) {
    logger.debug('setSession route has been hit', { hasBody: !!req.body });

    const { token } = req.body;

    if (!token) {
        res.status(401).json({ message: 'Unauthorized - No token provided' });
        return;
    }

    // verify token
    const user = await new Jwt().verify(req.body.token);
    if (!user) {
        logger.debug('Unauthorized - Invalid token');
        res.status(401).json({ message: 'Unauthorized - Invalid token' });
        return;
    }

    logger.debug('User verified', { userId: user.id, email: user.email });

    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: nodeEnv === 'production',
        sameSite: nodeEnv === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        domain: optional.cookieDomain || undefined // Allow setting custom domain
    });

    res.json({
        message: 'Login successful',
        user: user
    });
}


export async function me(req: Request, res: Response) {
    try {
        res.send(req.session?.user);
    } catch (error) {
        logger.error('Failed to retrieve session user', { error });
        res.status(500).json({ message: 'Failed to fetch user information' });
    }
}

export async function login(req: Request, res: Response) {
    logger.debug('login route has been hit', { hasBody: !!req.body, hasEmail: !!req.body?.email });

    try {
        const user = await loginUser(req.body.email, req.body.password);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Create JWT token
        const token = await new Jwt().sign(user.id);

        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: nodeEnv === 'production',
            sameSite: nodeEnv === 'production' ? 'none' : 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            domain: optional.cookieDomain || undefined // Allow setting custom domain
        });

        logger.info('Login successful for user', { userId: user.id, email: user.email });

        res.json({
            message: 'Login successful',
            user: user
        });
    } catch (error) {
        logger.error('Login error', { error });
        res.status(500).json({ message: 'Internal server error' });
    }
}

export async function logout(req: Request, res: Response) {
    logger.debug('logout route has been hit', { userId: req.session?.user?.id });
    res.clearCookie(COOKIE_NAME);
    res.json({ message: 'Logout successful' });
}


export default { me, login, logout };