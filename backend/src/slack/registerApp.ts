import axios from "axios";
import { Request, Response } from "express";
import { User } from "../types/prisma";
import { db } from "../prismaClient"
import { Jwt } from "../utility/jwt";
import { LogLevel, WebClient } from "@slack/web-api";
import chalk from "chalk";
import { slack as slackConfig, urls } from "../config/settings";

export async function getSlackOAuthUrl(req: Request, res: Response) {
    const client_id = slackConfig.clientId;
    const redirect_uri = slackConfig.oauthCallbackUrl;

    console.log('redirect_uri', redirect_uri)

    if (!req.session?.user) {
        res.status(500).json({ message: 'User not found' });
        return;
    }

    const user: User = req.session.user;

    const scope = "channels:history,channels:manage,groups:history,groups:write,im:history,im:write,mpim:history,mpim:write";
    const user_scope = "channels:history,channels:read,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,users:read,channels:write,groups:write,mpim:write,im:write"

    // create JWT and attach to url as state
    const jwt = new Jwt();
    const jwtToken = await jwt.sign(user.id);

    const state = encodeURIComponent(jwtToken);

    try {
        const encodedRedirectUri = encodeURIComponent(redirect_uri);
        const url = `https://slack.com/oauth/v2/authorize?scope=${scope}&user_scope=${user_scope}&redirect_uri=${encodedRedirectUri}&client_id=${client_id}&state=${state}`;
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
    const frontendUrl = urls.frontend;

    // Check if Slack returned an error (user denied access, etc.)
    if (req.query.error) {
        console.error("Slack OAuth error:", req.query.error);
        return res.redirect(`${frontendUrl}/oauth/error`);
    }

    // grab temporary code from query
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code || !state) {
        console.error("Missing code or state in OAuth callback");
        return res.redirect(`${frontendUrl}/oauth/error`);
    }

    const jwt = new Jwt();
    const user = await jwt.verify(state);

    if (!user) {
        console.error("Invalid or expired state token");
        return res.redirect(`${frontendUrl}/oauth/error`);
    }

    const client_id = slackConfig.clientId;
    const client_secret = slackConfig.clientSecret;
    const redirect_uri = slackConfig.oauthCallbackUrl;

    try {
        const response = await axios.post<SlackOAuthResponse>('https://slack.com/api/oauth.v2.access',
            {
                code: code,
                client_id: client_id,
                client_secret: client_secret,
                redirect_uri: redirect_uri,
            }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
        );

        console.log("Slack OAuth response:", response.data);

        const { access_token, authed_user, team } = response.data;

        if (!response.data.ok || !team || !team.id) {
            console.error("Slack OAuth response not ok:", response.data);
            return res.redirect(`${frontendUrl}/oauth/error`);
        }

        // check if the slack integration already exists
        let slackIntegration = await db().slack_integrations.findFirst({
            where: {
                team_id: team.id
            }
        });

        await db().$transaction(async (tx) => {
            if (slackIntegration) {
                console.log("Slack integration already exists, continuing with adding user relation");
                // Update existing integration with user_scope
                await db().slack_integrations.update({
                    where: {
                        team_id: slackIntegration.team_id
                    },
                    data: {
                        app_id: response.data.app_id,
                        bot_user_id: response.data.bot_user_id,
                        team_id: response.data.team.id,
                        team_name: response.data.team.name,
                        access_token: access_token,
                    }
                });
            } else {
                console.log(chalk.blue("Slack integration does not exist, creating it"));
                slackIntegration = await db().slack_integrations.create({
                    data: {
                        app_id: response.data.app_id,
                        bot_user_id: response.data.bot_user_id,
                        team_id: response.data.team.id,
                        team_name: response.data.team.name,
                        access_token: access_token,
                    }
                });
                console.log(chalk.green("Slack integration created"));
            }

            const dmChannelId = await openChat(access_token, authed_user.id);

            if (!dmChannelId || !dmChannelId.id) {
                console.error("Error opening chat");
                throw new Error('Failed to open chat');
            }

            await db().user_slack_integrations.upsert({
                where: {
                    user_id_slack_team_id: {
                        user_id: user.id,
                        slack_team_id: slackIntegration.team_id,
                    }
                },
                update: {
                    authed_user_id: authed_user.id,
                    authed_user_access_token: authed_user.access_token,
                },
                create: {
                    user_id: user.id,
                    slack_team_id: slackIntegration.team_id,
                    authed_user_id: authed_user.id,
                    authed_user_access_token: authed_user.access_token,
                }
            });
        });

        console.log("Slack OAuth completed successfully");
        return res.redirect(`${frontendUrl}/oauth/success`);
    } catch (error) {
        console.error('Error exchanging code for access token:', error);
        return res.redirect(`${frontendUrl}/oauth/error`);
    }
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
        access_token: string;
        token_type: string;
    };
}

