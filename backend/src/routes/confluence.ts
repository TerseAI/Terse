import { db } from "../prismaClient";
import { Request, Response } from "express";
import { ConfluenceClient } from 'confluence.js';
import type { ConfluencePage } from "../shared/types";
import chalk from "chalk";
import { AtlassianIntegrationManager } from "../integrations/AtlassianIntegration";

// Import types from confluence.js using type-only imports
type Content = import('confluence.js').Models.Content;
type ContentArray = import('confluence.js').Models.ContentArray;

export async function getConfluenceIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new AtlassianIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching Confluence integrations:', error);
        res.status(500).json({ error: 'Failed to fetch Confluence integrations' });
    }
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

    // Check OAuth integrations first
    const oauthIntegration = await db().atlassian_integrations.findFirst({
        where: {
            id: integrationId,
            user_id: user.id,
        },
    });

    if (!oauthIntegration) {
        return res.status(404).json({ success: false, error: 'Integration not found' });
    }

    // Get OAuth token from integration
    const baseUrl = oauthIntegration.base_url;
    const accessToken = oauthIntegration.access_token;

    if (!accessToken) {
        return res.status(400).json({ success: false, error: 'Integration missing access token' });
    }

    // For OAuth bearer tokens with Atlassian Cloud, we use the token directly
    const client = new ConfluenceClient({
        host: baseUrl,
        authentication: {
            oauth2: {
                accessToken: accessToken,
            }
        }
    });

    console.log(chalk.green('Confluence client created successfully'));

    try {
        // Fetch all pages using the content API
        // Using type=page to get only pages, and limit to get a reasonable number
        const allResources: ConfluencePage[] = [];
        let start = 0;
        const limit = 100; // Fetch 100 pages per request
        let hasMore = true;

        while (hasMore) {
            console.log(chalk.green('Fetching content...'));
            const contentResponse = await client.content.getContent({
                type: 'page',
                limit: limit,
                start: start,
                expand: ['space', 'version'],
            }) as ContentArray;

            console.log(chalk.green('Content fetched successfully'));

            const resources = mapContentToConfluencePages(contentResponse.results);

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

// MARK: - Helpers

/**
 * Maps Confluence Content pages to ConfluencePage objects, validating required fields.
 * Pages missing required fields are filtered out with warnings logged.
 */
function mapContentToConfluencePages(pages: Content[]): ConfluencePage[] {
    return pages
        .map((page: Content) => {
            // Check for required fields and log warnings if missing
            const missingFields: string[] = [];
            
            if (!page.id) {
                missingFields.push('page id');
            }
            if (!page.title) {
                missingFields.push('page name');
            }
            if (!page.space?.key && !page.space?.id) {
                missingFields.push('space id');
            }
            if (!page.space?.name) {
                missingFields.push('space name');
            }
            if (!page.status) {
                missingFields.push('status');
            }
            if (page.version?.number === undefined) {
                missingFields.push('version');
            }
            
            if (missingFields.length > 0) {
                console.log(chalk.yellow(`⚠️  Warning: Missing fields for page "${page.title || page.id || 'unknown'}": ${missingFields.join(', ')}`));
            }
            
            // Only include pages that have all required fields
            if (!page.id || !page.title || (!page.space?.key && !page.space?.id) || !page.space?.name || !page.status || page.version?.number === undefined) {
                return null;
            }
            
            let url: string | undefined;
            if (page._links?.webui) {
                url = page._links.webui;
            } else if (page._links?.base && page._links?.webui) {
                url = page._links.base + page._links.webui;
            }
            
            // We've already validated that space exists and has either key or id
            const spaceId = page.space.key ? page.space.key : String(page.space.id);
            
            return {
                id: page.id,
                title: page.title,
                spaceId: spaceId,
                spaceName: page.space.name,
                url: url,
                status: page.status,
                version: page.version.number,
            } as ConfluencePage;
        })
        .filter((page): page is ConfluencePage => page !== null);
}