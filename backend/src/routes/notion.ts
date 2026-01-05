import { Client } from "@notionhq/client";
import { Request, Response } from "express";
import { db } from "../prismaClient";
import { NotionResource, NotionResourcesResponse } from "../shared/types";
import { SearchResponse } from "@notionhq/client/build/src/api-endpoints";
import { extractPageTitle } from "../utility/notion";
import { NotionIntegrationManager } from "../integrations/NotionIntegration";
import logger from "../logger";

export async function getNotionIntegrations(req: Request, res: Response) {
  if (!req.session?.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
  }

  try {
      const manager = new NotionIntegrationManager();
      const integrations = await manager.getInstancesForUser(req.session.user.id);
      res.status(200).json(integrations);
  } catch (error) {
      logger.error('Error fetching Notion integrations:', { error });
      res.status(500).json({ error: 'Failed to fetch Notion integrations' });
  }
}

// OAuth Functions
export const notionOAuthCallback = async (req: Request, res: Response) => {
  const integration = new NotionIntegrationManager();
  await integration.processInstallationCallback(req, res);
};

// Search Notion pages and databases by title
export const getNotionResources = async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const integrationId = req.query.integrationId as string;
  if (!integrationId) {
    return res.status(400).json({ error: "integrationId is required" });
  }

  // Search term is optional - empty string returns all accessible resources
  const search = (req.query.search as string) || "";
  
  // Type filter is optional - "page" or "database", if not provided returns both
  const typeFilter = req.query.type as string | undefined;

  try {
    // Verify user owns this integration
    const integration = await db().notion_integrations.findFirst({
      where: {
        id: integrationId,
        user_id: user.id,
      },
    });

    if (!integration) {
      return res.status(404).json({ error: "Notion integration not found" });
    }

    // Get valid access token (handles refresh automatically)
    const manager = new NotionIntegrationManager();
    const accessToken = await manager.getAccessToken(integrationId);
    if (!accessToken) {
      return res.status(400).json({ error: "Could not get valid access token" });
    }

    // Build search options
    const notionClient = new Client({ auth: accessToken });
    const searchOptions: Parameters<typeof notionClient.search>[0] = {
      query: search,
      page_size: 100,
    };
    
    // Add filter if type is specified
    if (typeFilter === 'page') {
      searchOptions.filter = { property: "object", value: "page" };
    } else if (typeFilter === 'database') {
      searchOptions.filter = { property: "object", value: "data_source" };
    }

    const searchResponse: SearchResponse = await notionClient.search(searchOptions);

    let resources: NotionResource[] = searchResponse.results
      .map((result: any) => {
        if (result.object === 'data_source') {
          return {
            id: result.id,
            title: result.title?.[0]?.plain_text || "Untitled Database",
            url: result.url,
            type: 'database' as const,
          };
        } else if (result.object === 'page') {
          return {
            id: result.id,
            title: extractPageTitle(result),
            url: 'url' in result ? result.url : '',
            type: 'page' as const,
          };
        }
        return null;
      })
      .filter((resource): resource is NotionResource => resource !== null);
    
    // Only sort alphabetically when no search term - otherwise preserve platform's relevance ranking
    if (!search) {
      resources = resources.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    }

    const response: NotionResourcesResponse = {
      resources,
    };

    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error searching Notion resources:', { error });
    res.status(500).json({
      error: "Failed to search resources",
      details: error.message
    });
  }
};
