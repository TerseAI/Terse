import { db } from "../prismaClient";
import { Request, Response } from "express";
import { ConfluenceClient } from 'confluence.js';
import type { ConfluencePage } from "../shared/types";
import chalk from "chalk";

// Import types from confluence.js using type-only imports
type Content = import('confluence.js').Models.Content;
type ContentArray = import('confluence.js').Models.ContentArray;

export async function setConfluenceCredentials(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { baseUrl, apiKey, email } = req.body;
    if (!baseUrl || !apiKey || !email) {
        return res.status(400).json({ success: false, error: 'baseUrl, apiKey, and email are required' });
    }

    try {
        const valid = await validateConfluenceCredentialsPrivate(email, baseUrl, apiKey);
        if (!valid) {
            return res.status(400).json({ success: false, error: 'Invalid credentials' });
        }

        // Extract site name from baseUrl
        let siteName = baseUrl;
        const siteNameMatch = baseUrl.match(/https?:\/\/([^.]+)/);
        if (siteNameMatch) {
            siteName = siteNameMatch[1];
        }

        const connection = await db().jira_api_keys.create({
            data: {
                user_id: user.id,
                jira_user_email: email,
                base_url: baseUrl,
                site_name: siteName,
                api_token: apiKey,
            }
        });

        console.log(chalk.green('✅ Created Confluence integration:'), chalk.yellow(siteName));

        return res.status(200).json({
            success: true,
            connection: {
                id: connection.id,
                baseUrl: connection.base_url,
                siteName: connection.site_name,
                email: connection.jira_user_email,
            }
        });
    } catch (error) {
        console.error(chalk.red('Error creating Confluence connection:'), error);
        return res.status(500).json({ success: false, error: 'Failed to create connection' });
    }
}


export async function validateConfluenceCredentials(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { baseUrl, email, apiKey } = req.body;
    if (!baseUrl || !email || !apiKey) {
        return res.status(400).json({ success: false, error: 'baseUrl, email, and apiKey are required' });
    }

    const valid = await validateConfluenceCredentialsPrivate(email, baseUrl, apiKey);
    if (!valid) {
        return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    return res.status(200).json({ success: true });
}


async function validateConfluenceCredentialsPrivate(email: string, baseUrl: string, apiKey: string): Promise<boolean> {
    const client = new ConfluenceClient({
        host: baseUrl,
        authentication: {
            basic: {
                email: email,
                apiToken: apiKey,
            }
        },
    });
    const user = await client.users.getCurrentUser();
    console.log("Confluence user:", user);
    return user !== null;
}

export async function getConfluenceResources(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const integrationId = req.query.integrationId as string;
    if (!integrationId) {
        return res.status(400).json({ success: false, error: 'integrationId is required' });
    }

    const integration = await db().jira_api_keys.findFirst({
        where: {
            id: integrationId,
            user_id: user.id,
        },
    });
    if (!integration) {
        return res.status(404).json({ success: false, error: 'Integration not found' });
    }

    const client = new ConfluenceClient({
        host: integration.base_url,
        authentication: {
            basic: {
                email: integration.jira_user_email,
                apiToken: integration.api_token,
            }
        },
    });

    try {
        // Fetch all pages using the content API
        // Using type=page to get only pages, and limit to get a reasonable number
        const allResources: ConfluencePage[] = [];
        let start = 0;
        const limit = 100; // Fetch 100 pages per request
        let hasMore = true;

        while (hasMore) {
            const contentResponse = await client.content.getContent({
                type: 'page',
                limit: limit,
                start: start,
                expand: ['space', 'version'],
            }) as ContentArray;

            // Map the response to match ConfluencePage type
            const resources = contentResponse.results.map((page: Content) => ({
                id: page.id,
                title: page.title || 'Untitled',
                spaceId: page.space?.key || (page.space?.id ? String(page.space.id) : ''),
                url: page._links?.webui || (page._links?.base && page._links?.webui ? page._links.base + page._links.webui : undefined),
                status: page.status || 'current',
                version: page.version?.number || 1,
            }));

            allResources.push(...resources);

            // Check if there are more pages to fetch
            const total = contentResponse.size || 0;
            start += limit;
            hasMore = start < total && contentResponse.results.length === limit;
        }

        // Get the first space ID if available (for backward compatibility)
        const firstSpaceId = allResources.length > 0 ? allResources[0].spaceId : '';

        return res.status(200).json({
            success: true,
            resources: allResources,
            spaceId: firstSpaceId,
            total: allResources.length,
        });
    } catch (error: any) {
        console.error(chalk.red('Error fetching Confluence resources:'), error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch Confluence resources',
        });
    }
}