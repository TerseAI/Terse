import { Request, Response } from "express";
import { db } from "../prismaClient";
import chalk from "chalk";
import { NotionIntegration, NotionDatabase, NotionDatabasesResponse } from "../shared/types";
import jwt from 'jsonwebtoken';
import { Client } from '@notionhq/client';

export const setNotionIntegration = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { integrationToken, databaseId }: NotionIntegration = req.body;
    console.log(chalk.blue("🔑 Adding Notion integration for user"), chalk.yellow(user.id));

    if (!integrationToken || !databaseId) {
        return res.status(400).json({ error: 'Integration token and database ID are required' });
    }

    try {
        // Check if integration already exists
        const existingIntegration = await db().notion_integrations.findUnique({
            where: {
                user_id: user.id
            }
        });

        if (existingIntegration) {
            // Update existing integration
            await db().notion_integrations.update({
                where: {
                    user_id: user.id
                },
                data: {
                    integration_token: integrationToken,
                    database_id: databaseId,
                }
            });
            console.log(chalk.green('✅ Updated Notion integration for user'), chalk.yellow(user.id));
        } else {
            // Create new integration
            await db().notion_integrations.create({
                data: {
                    user_id: user.id,
                    integration_token: integrationToken,
                    database_id: databaseId,
                }
            });
            console.log(chalk.green('✅ Created Notion integration for user'), chalk.yellow(user.id));
        }

        res.status(200).json({ message: 'Notion integration set' });
    } catch (error) {
        console.error(chalk.red('Error setting Notion integration:'), error);
        res.status(500).json({ error: 'Failed to set Notion integration' });
    }
}

export const getNotionIntegration = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const integration = await db().notion_integrations.findUnique({
            where: {
                user_id: user.id
            }
        });

        if (!integration) {
            console.log("No Notion integration found for user", user.id);
            return res.status(200).json({
                integrationToken: null,
                databaseId: null
            });
        }

        const response: NotionIntegration = {
            integrationToken: integration.integration_token,
            databaseId: integration.database_id
        };

        res.status(200).json(response);
    } catch (error) {
        console.error(chalk.red('Error getting Notion integration:'), error);
        res.status(500).json({ error: 'Failed to get Notion integration' });
    }
}

export const deleteNotionIntegration = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const integration = await db().notion_integrations.findUnique({
            where: {
                user_id: user.id
            }
        });

        if (!integration) {
            return res.status(404).json({ error: 'No Notion integration found' });
        }

        // Clean up automation inputs/outputs that reference this Notion integration
        await db().automation_inputs.deleteMany({
            where: {
                integration_type: 'NOTION',
                integration_id: integration.id
            }
        });

        await db().automation_outputs.deleteMany({
            where: {
                integration_type: 'NOTION',
                integration_id: integration.id
            }
        });

        await db().notion_integrations.delete({
            where: { user_id: user.id }
        });

        console.log(chalk.green('✅ Deleted Notion integration for user'), chalk.yellow(user.id));
        res.status(200).json({ message: 'Notion integration deleted' });
    } catch (error) {
        console.error(chalk.red('Error deleting Notion integration:'), error);
        res.status(500).json({ error: 'Failed to delete Notion integration' });
    }
}

// OAuth Functions

export const getNotionOAuthUrl = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Generate state token for security (prevents CSRF)
        const state = jwt.sign(
            { userId: user.id, timestamp: Date.now() },
            process.env.JWT_SECRET!,
            { expiresIn: '10m' }
        );

        const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
        const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            throw new Error('Notion OAuth credentials not configured');
        }

        // Build OAuth URL with proper encoding
        const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
        authUrl.searchParams.append('client_id', clientId);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('owner', 'user');
        authUrl.searchParams.append('redirect_uri', redirectUri);
        authUrl.searchParams.append('state', state);

        console.log(chalk.blue('🔗 Generated Notion OAuth URL for user'), chalk.yellow(user.id));
        res.json({ url: authUrl.toString() });
    } catch (error) {
        console.error(chalk.red('Error generating Notion OAuth URL:'), error);
        res.status(500).json({ error: 'Failed to generate OAuth URL' });
    }
};

export const notionOAuthCallback = async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
        console.error(chalk.red('Notion OAuth error:'), error);
        return res.redirect(`${process.env.FRONTEND_URL}/oauth/error`);
    }

    if (!code || !state) {
        return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    try {
        // Verify state token to prevent CSRF attacks
        const decoded = jwt.verify(state as string, process.env.JWT_SECRET!) as {
            userId: string;
            timestamp: number;
        };

        // Exchange authorization code for access token
        const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(
                    `${process.env.NOTION_OAUTH_CLIENT_ID}:${process.env.NOTION_OAUTH_CLIENT_SECRET}`
                ).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.NOTION_OAUTH_REDIRECT_URI
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error(chalk.red('Notion token exchange failed:'), errorText);
            throw new Error(`Notion token exchange failed: ${errorText}`);
        }

        const tokenData = await tokenResponse.json();
        const { access_token } = tokenData;

        console.log(chalk.blue('🔑 Received Notion access token for user'), chalk.yellow(decoded.userId));

        // Fetch available databases
        const notionClient = new Client({ auth: access_token });
        const databasesResponse = await notionClient.search({
            filter: { property: 'object', value: 'database' },
            page_size: 100
        });

        const databases: NotionDatabase[] = databasesResponse.results.map((db: any) => ({
            id: db.id,
            title: db.title?.[0]?.plain_text || 'Untitled Database',
            url: db.url
        }));

        console.log(chalk.blue(`📊 Found ${databases.length} databases for user`), chalk.yellow(decoded.userId));

        if (databases.length === 0) {
            console.error(chalk.red('No databases found for user'), chalk.yellow(decoded.userId));
            return res.redirect(`${process.env.FRONTEND_URL}/oauth/error`);
        }

        // Store access token and set the first database as default
        const defaultDatabaseId = databases[0].id;

        await db().notion_integrations.upsert({
            where: { user_id: decoded.userId },
            create: {
                user_id: decoded.userId,
                integration_token: access_token,
                database_id: defaultDatabaseId,
            },
            update: {
                integration_token: access_token,
                database_id: defaultDatabaseId,
            }
        });

        console.log(chalk.green('✅ Notion OAuth completed for user'), chalk.yellow(decoded.userId));
        console.log(chalk.blue('📊 Set default database:'), chalk.yellow(databases[0].title));

        // Redirect to success page which will auto-close the popup
        res.redirect(`${process.env.FRONTEND_URL}/oauth/success`);
    } catch (error) {
        console.error(chalk.red('Error in Notion OAuth callback:'), error);
        res.redirect(`${process.env.FRONTEND_URL}/oauth/error`);
    }
};

export const getNotionDatabases = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const integration = await db().notion_integrations.findUnique({
            where: { user_id: user.id }
        });

        if (!integration || !integration.integration_token) {
            return res.status(404).json({ error: 'No Notion integration found. Please complete OAuth first.' });
        }

        // Fetch available databases using the stored access token
        const notionClient = new Client({ auth: integration.integration_token });
        const databasesResponse = await notionClient.search({
            filter: { property: 'object', value: 'database' },
            page_size: 100
        });

        const databases: NotionDatabase[] = databasesResponse.results.map((db: any) => ({
            id: db.id,
            title: db.title?.[0]?.plain_text || 'Untitled Database',
            url: db.url
        }));

        console.log(chalk.blue(`📊 Retrieved ${databases.length} databases for user`), chalk.yellow(user.id));

        const response: NotionDatabasesResponse = {
            databases,
            selectedDatabaseId: integration.database_id || null
        };

        res.json(response);
    } catch (error) {
        console.error(chalk.red('Error fetching Notion databases:'), error);
        res.status(500).json({ error: 'Failed to fetch databases' });
    }
};

export const setNotionDatabase = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { databaseId } = req.body;

    if (!databaseId) {
        return res.status(400).json({ error: 'Database ID is required' });
    }

    try {
        const integration = await db().notion_integrations.findUnique({
            where: { user_id: user.id }
        });

        if (!integration) {
            return res.status(404).json({ error: 'No Notion integration found. Please complete OAuth first.' });
        }

        // Update the database_id
        await db().notion_integrations.update({
            where: { user_id: user.id },
            data: { database_id: databaseId }
        });

        console.log(chalk.green('✅ Set Notion database for user'), chalk.yellow(user.id), chalk.blue(databaseId));
        res.status(200).json({ message: 'Database selected successfully' });
    } catch (error) {
        console.error(chalk.red('Error setting Notion database:'), error);
        res.status(500).json({ error: 'Failed to set database' });
    }
};
