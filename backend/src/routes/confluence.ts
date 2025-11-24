import { db } from "../prismaClient";
import { Request, Response } from "express";
import type { ConfluencePage } from "../shared/types";
import chalk from "chalk";
import { AtlassianIntegrationManager } from "../integrations/AtlassianIntegration";

// MARK: - Route Handlers

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

    // Get cloudId from integration
    const cloudId = oauthIntegration.cloud_id;

    if (!cloudId) {
        return res.status(400).json({ success: false, error: 'Integration missing cloud ID' });
    }

    // Get valid access token (handles refresh automatically)
    const manager = new AtlassianIntegrationManager();
    const accessToken = await manager.getAccessToken(integrationId);
    if (!accessToken) {
        return res.status(400).json({ success: false, error: 'Could not get valid access token' });
    }

    try {
        // Use Confluence REST API v2 with cursor-based pagination
        const apiBaseUrl = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2`;
        const allResources: ConfluencePage[] = [];
        const limit = 100;
        let cursor: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
            const params = new URLSearchParams({
                limit: limit.toString(),
            });
            if (cursor) {
                params.append('cursor', cursor);
            }

            const pagesUrl = `${apiBaseUrl}/pages?${params.toString()}`;
            const pagesResponse = await fetch(pagesUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                },
            });

            if (!pagesResponse.ok) {
                const errorText = await pagesResponse.text();
                console.error(chalk.red('Confluence API error:'), pagesResponse.status, errorText);
                throw new Error(`Confluence API error: ${pagesResponse.status} ${pagesResponse.statusText} - ${errorText}`);
            }

            const pagesData = await pagesResponse.json() as ConfluencePagesV2Response;
            const resources = mapV2PagesToConfluencePages(pagesData.results || []);

            allResources.push(...resources);

            // Check for next page using _links.next or Link header
            const nextLink = pagesData._links?.next;
            if (nextLink) {
                // _links.next might be relative or absolute URL
                try {
                    const nextUrl = nextLink.startsWith('http') 
                        ? new URL(nextLink)
                        : new URL(nextLink, `${apiBaseUrl}/`);
                    cursor = nextUrl.searchParams.get('cursor') || undefined;
                    hasMore = !!cursor;
                } catch (error) {
                    // If URL parsing fails, try extracting cursor from query string directly
                    const cursorMatch = nextLink.match(/[?&]cursor=([^&]+)/);
                    cursor = cursorMatch ? cursorMatch[1] : undefined;
                    hasMore = !!cursor;
                }
            } else {
                // Also check Link header as fallback
                const linkHeader = pagesResponse.headers.get('Link');
                if (linkHeader) {
                    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
                    if (nextMatch) {
                        try {
                            const nextUrl = nextMatch[1].startsWith('http')
                                ? new URL(nextMatch[1])
                                : new URL(nextMatch[1], `${apiBaseUrl}/`);
                            cursor = nextUrl.searchParams.get('cursor') || undefined;
                            hasMore = !!cursor;
                        } catch (error) {
                            const cursorMatch = nextMatch[1].match(/[?&]cursor=([^&]+)/);
                            cursor = cursorMatch ? cursorMatch[1] : undefined;
                            hasMore = !!cursor;
                        }
                    } else {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            }
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
 * Maps Confluence REST API v2 pages to ConfluencePage objects, validating required fields.
 * Pages missing required fields are filtered out with warnings logged.
 * Note: API v2 doesn't include spaceName, so we use spaceId as spaceName for now.
 */
function mapV2PagesToConfluencePages(pages: ConfluencePageV2[]): ConfluencePage[] {
    return pages
        .map((page) => {
            // Check for required fields and log warnings if missing
            const missingFields: string[] = [];
            
            if (!page.id) {
                missingFields.push('page id');
            }
            if (!page.title) {
                missingFields.push('page title');
            }
            if (!page.spaceId) {
                missingFields.push('space id');
            }
            if (!page.version?.number) {
                missingFields.push('version number');
            }
            
            if (missingFields.length > 0) {
                console.log(chalk.yellow(`⚠️  Warning: Missing fields for page "${page.title || page.id || 'unknown'}": ${missingFields.join(', ')}`));
            }
            
            // Only include pages that have all required fields
            if (!page.id || !page.title || !page.spaceId || !page.version?.number) {
                return null;
            }
            
            return {
                id: page.id,
                title: page.title,
                spaceId: page.spaceId,
                spaceName: page.spaceId, // API v2 doesn't provide spaceName, use spaceId as fallback
                url: page._links?.webui,
                status: page.status || 'current',
                version: page.version.number,
            } as ConfluencePage;
        })
        .filter((page): page is ConfluencePage => page !== null);
}

// MARK: - Types

interface ConfluencePageV2 {
    id: string;
    status?: string;
    title: string;
    spaceId: string;
    parentId?: string;
    parentType?: string;
    position?: number;
    authorId?: string;
    ownerId?: string;
    lastOwnerId?: string;
    subtype?: string;
    createdAt?: string;
    version?: {
        createdAt?: string;
        message?: string;
        number: number;
        minorEdit?: boolean;
        authorId?: string;
    };
    body?: {
        storage?: any;
        atlas_doc_format?: any;
    };
    _links?: {
        webui?: string;
        editui?: string;
        tinyui?: string;
    };
}

interface ConfluencePagesV2Response {
    results: ConfluencePageV2[];
    _links?: {
        next?: string;
        self?: string;
    };
}