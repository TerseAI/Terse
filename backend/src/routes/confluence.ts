import { db } from "../prismaClient";
import { Request, Response } from "express";
import type { ConfluencePage } from "../shared/types";
import chalk from "chalk";
import { AtlassianIntegrationManager } from "../integrations/AtlassianIntegration";
import logger from "../logger";

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
        logger.error('Error fetching Confluence integrations:', { error });
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

    // Search term is optional - empty returns all pages
    const search = (req.query.search as string) || "";

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
        // Use Confluence Search API with CQL query
        const searchUrl = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api/search`;
        // If search term provided, filter by title; otherwise return all pages
        const cql = search ? `type=page AND title ~ "${search}"` : `type=page`;
        const params = new URLSearchParams({
            cql,
            limit: '100',
        });

        const searchResponse = await fetch(`${searchUrl}?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            },
        });

        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            logger.error('Confluence Search API error:', { status: searchResponse.status, errorText });
            throw new Error(`Confluence Search API error: ${searchResponse.status} ${searchResponse.statusText} - ${errorText}`);
        }

        const searchData = await searchResponse.json() as ConfluenceSearchResponse;
        let resources = mapSearchResultsToConfluencePages(searchData.results || []);
        
        // Only sort alphabetically when no search term - otherwise preserve platform's relevance ranking
        if (!search) {
            resources = resources.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
        }

        return res.status(200).json({
            success: true,
            resources,
            total: resources.length,
        });
    } catch (error: any) {
        logger.error('Error searching Confluence resources:', { error });
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to search Confluence resources',
        });
    }
}

// MARK: - Helpers

/**
 * Maps Confluence Search API results to ConfluencePage objects.
 * Search results contain content objects with different structure than v2 API.
 */
function mapSearchResultsToConfluencePages(results: ConfluenceSearchResult[]): ConfluencePage[] {
    return results
        .map((result) => {
            const content = result.content;
            if (!content || content.type !== 'page') {
                return null;
            }

            // Check for required fields
            const missingFields: string[] = [];
            if (!content.id) missingFields.push('page id');
            if (!content.title) missingFields.push('page title');
            
            if (missingFields.length > 0) {
                logger.warn(`Missing fields for search result "${content.title || content.id || 'unknown'}": ${missingFields.join(', ')}`);
                return null;
            }

            // Extract space info from the content
            const spaceKey = content.space?.key || '';
            const spaceName = content.space?.name || spaceKey;

            return {
                id: content.id,
                title: content.title,
                spaceId: spaceKey,
                spaceName: spaceName,
                url: content._links?.webui || '',
                status: content.status || 'current',
                version: content.version?.number || 1,
            } as ConfluencePage;
        })
        .filter((page): page is ConfluencePage => page !== null);
}

// MARK: - Types

interface ConfluenceSearchResult {
    content?: {
        id: string;
        type: string;
        status?: string;
        title: string;
        space?: {
            key: string;
            name: string;
        };
        version?: {
            number: number;
        };
        _links?: {
            webui?: string;
        };
    };
    title?: string;
    excerpt?: string;
    url?: string;
}

interface ConfluenceSearchResponse {
    results: ConfluenceSearchResult[];
    start?: number;
    limit?: number;
    size?: number;
    totalSize?: number;
    _links?: {
        next?: string;
        self?: string;
    };
}