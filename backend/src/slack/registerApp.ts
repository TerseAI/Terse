import axios from "axios";
import { Request, Response } from "express";
import { User } from "../types/prisma";
import { db } from "../prismaClient"
import { Jwt } from "../utility/jwt";

export async function getSlackOAuthUrl(req: Request, res: Response) {
    const client_id = process.env.SLACK_CLIENT_ID;
    const backendUrl = process.env.BACKEND_URL;
    const redirect_uri = `${backendUrl}/slack/oauth-callback`;

    if(!req.session?.user) {
        res.status(500).json({ message: 'User not found' });
        return;
    }

    const user: User = req.session.user;

    const scope = "chat:write,users:read,users:read.email";
    const user_scope = "";

    // create JWT and attach to url as state
    const jwt = new Jwt();
    const jwtToken = await jwt.sign(user.id);

    const state = encodeURIComponent(jwtToken);

    try {
        const url = `https://slack.com/oauth/v2/authorize?scope=${scope}&user_scope=${user_scope}&redirect_uri=${redirect_uri}&client_id=${client_id}&state=${state}`;
        console.log("Slack OAuth URL", url);

        res.json({
            url
        });
    } catch (error) {
        console.error('Error generating installation URL:', error);
        res.status(500).json({ message: 'Failed to generate installation URL' });
    }
}

export async function getCurrentSlackIntegration(req: Request, res: Response) {
    if(!req.session?.user) {
        res.status(500).json({ message: 'User not found' });
        return;
    }

    const user: User = req.session.user;

    const slackIntegration = await db().slack_integrations.findFirst({
        where: {
            user_id: user.id
        },
        orderBy: {
            created_at: 'desc'
        }
    });
    
    if(!slackIntegration) {
        res.status(404).json({ teamName: null });
        return;
    }

    res.status(200).json({ teamName: slackIntegration.team_name });
}

export async function slackOAuthCallback(req: Request, res: Response) {
    // grab temporary code from query
    const code = req.query.code as string;
    const state = req.query.state as string;

    const jwt = new Jwt();
    const user = await jwt.verify(state);

    if(!user) {
        res.status(500).json({ message: 'User not found' });
        return;
    }

    const client_id = process.env.SLACK_CLIENT_ID;
    const client_secret = process.env.SLACK_CLIENT_SECRET;

    try {
        const response= await axios.post<SlackOAuthResponse>('https://slack.com/api/oauth.v2.access', 
            {
                code: code,
                client_id: client_id,
                client_secret: client_secret,
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log("Slack OAuth response:", response.data);

        const { access_token, authed_user } = response.data;

        if (!response.data.ok) {
            console.error("Slack OAuth response not ok:", response.data);
            res.status(500).json({ message: 'Failed to exchange code for access token' });
            return;
        }

        // store access token in database
        await db().slack_integrations.upsert({
            where: {
                app_id: response.data.app_id
            },
            create: {
                user_id: user.id,
                app_id: response.data.app_id,
                authed_user_id: authed_user.id,
                bot_user_id: response.data.bot_user_id,
                team_id: response.data.team.id,
                team_name: response.data.team.name,
                access_token: access_token,
                scope: response.data.scope,
            },
            update: {
                user_id: user.id,
                app_id: response.data.app_id,
                authed_user_id: authed_user.id,
                bot_user_id: response.data.bot_user_id,
                team_id: response.data.team.id,
                team_name: response.data.team.name,
                access_token: access_token,
                scope: response.data.scope,
            }
        });

        // TODO: We need to open a chat once the user integrates with slack. And then store that thread_ts to use here
        // const result = await client.chat.postMessage({
        //     // The token you used to initialize your app
        //     token: slackIntegration.access_token,
        //     text: message,
        // });

        console.log("Access token:", response.data);
    } catch (error) {
        console.error('Error exchanging code for access token:', error);
        res.status(500).json({ message: 'Failed to exchange code for access token' });
        return;
    }

    // exchange code for access token

    // store access token in database
    res.json({ received: true });
}

export interface SlackOAuthResponse {
    ok: boolean;
    access_token: string;
    token_type: string;
    scope: string;
    bot_user_id: string;
    app_id: string;
    team: {
        name: string;
        id: string;
    };
    enterprise: {
        name: string;
        id: string;
    };
    authed_user: {
        id: string;
        scope: string;
        access_token: string;
        token_type: string;
    };
}

