import axios from "axios";
import { Request, Response } from "express";
import { User } from "../types/prisma";
import { db } from "../prismaClient"
import { Jwt } from "../utility/jwt";
import { LogLevel, WebClient } from "@slack/web-api";
import chalk from "chalk";
import { sendMessage } from "./sendMessage";


const welcomeMessage = `
Hello, I'm Vectra AI, your AI assistant for managing your tickets.

I work in the background, but I'll shoot you a message here whenever I make changes to your tickets!
`;

export async function getSlackOAuthUrl(req: Request, res: Response) {
    const client_id = process.env.SLACK_CLIENT_ID;
    const backendUrl = process.env.BACKEND_URL;
    const redirect_uri = `${backendUrl}/slack/oauth-callback`;

    console.log('redirect_uri', redirect_uri)

    if (!req.session?.user) {
        res.status(500).json({ message: 'User not found' });
        return;
    }

    const user: User = req.session.user;

    const scope = "chat:write,users:read,users:read.email,im:write,groups:write";
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
    if (!req.session?.user) {
        res.status(500).json({ message: 'User not found' });
        return;
    }

    const user: User = req.session.user;

    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            user_id: user.id
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    if (!userSlackIntegration) {
        res.status(404).json({ teamName: null });
        return;
    }

    const slackIntegration = await db().slack_integrations.findFirst({
        where: {
            team_id: userSlackIntegration?.slack_team_id
        }
    });

    if (!slackIntegration || !userSlackIntegration) {
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

    if (!user) {
        res.status(500).json({ message: 'User not found' });
        return;
    }

    const client_id = process.env.SLACK_CLIENT_ID;
    const client_secret = process.env.SLACK_CLIENT_SECRET;
    try {
        const response = await axios.post<SlackOAuthResponse>('https://slack.com/api/oauth.v2.access',
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

        const { access_token, authed_user, scope } = response.data;

        if (!response.data.ok) {
            console.error("Slack OAuth response not ok:", response.data);
            res.status(500).json({ message: 'Failed to exchange code for access token' });
            return;
        }

        // check if the slack integration already exists
        let slackIntegration = await db().slack_integrations.findFirst({
            where: {
                app_id: response.data.app_id
            }
        });

        await db().$transaction(async (tx) => {
            if (slackIntegration) {
                console.log("Slack integration already exists, continuing with adding user relation");
            } else {
                console.log(chalk.blue("Slack integration does not exist, creating it"));
                slackIntegration = await db().slack_integrations.create({
                    data: {
                        app_id: response.data.app_id,
                        bot_user_id: response.data.bot_user_id,
                        team_id: response.data.team.id,
                        team_name: response.data.team.name,
                        access_token: access_token,
                        scope: scope,
                    }
                });
                console.log(chalk.green("Slack integration created"));
            }

            const dmChannelId = await openChat(access_token, authed_user.id);

            if (!dmChannelId || !dmChannelId.id) {
                console.error("Error opening chat");
                res.status(500).json({ message: 'Failed to open chat' });
                return;
            }

            sendMessage(welcomeMessage, access_token, dmChannelId.id);

            const userSlackIntegration = await db().user_slack_integrations.create({
                data: {
                    user_id: user.id,
                    slack_team_id: slackIntegration.team_id,
                    dm_channel_id: dmChannelId?.id,
                    authed_user_id: authed_user.id,
                }
            });
        });

        console.log("Access token:", response.data);
    } catch (error) {
        console.error('Error exchanging code for access token:', error);
        res.status(500).json({ message: 'Failed to exchange code for access token' });
        return;
    }

    res.json({ received: true });
}

async function openChat(accessToken: string, authedUserId: string) {
    try {

        const client = new WebClient(accessToken, {
            // LogLevel can be imported and used to make debugging simpler
            logLevel: LogLevel.DEBUG
        });

        const { channel } = await client.conversations.open({
            users: authedUserId          // ← the U-ID of the person you want to DM
        });

        return channel;
    } catch (error) {
        console.error('Error opening chat:', error);
        return null;
    }
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

