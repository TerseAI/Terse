import { Client } from "@notionhq/client";
import chalk from "chalk";
import { Request, Response } from "express";
import { db } from "../prismaClient";
import { NotionResource, NotionResourcesResponse } from "../shared/types";
import { PageObjectResponse, PartialPageObjectResponse, SearchResponse } from "@notionhq/client/build/src/api-endpoints";
import { extractPageTitle } from "../utility/notion";
import { NotionIntegrationManager } from "../integrations/NotionIntegration";

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
      console.error('Error fetching Notion integrations:', error);
      res.status(500).json({ error: 'Failed to fetch Notion integrations' });
  }
}


// OAuth Functions
export const notionOAuthCallback = async (req: Request, res: Response) => {
  const integration = new NotionIntegrationManager();
  await integration.processInstallationCallback(req, res);
};

// Fetch available databases for a Notion connection
export const getNotionResources = async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const integrationId = req.query.integrationId as string;
  if (!integrationId) {
    return res.status(400).json({ error: "integrationId is required" });
  }

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

    // Fetch databases from Notion API
    const notionClient = new Client({ auth: accessToken });
    const databasesResponse = await notionClient.search({
      filter: { property: "object", value: "data_source" },
      page_size: 100,
    });

    const pagesResponse: SearchResponse = await notionClient.search({
      filter: { property: "object", value: "page" },
      page_size: 100,
    });

    const databases: NotionResource[] = databasesResponse.results.map(
      (db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || "Untitled Database",
        url: db.url,
        type: 'database',
      })
    );

    const pages: NotionResource[] = pagesResponse.results
      .filter((page): page is PageObjectResponse | PartialPageObjectResponse => page.object === 'page')
      .map((page: PageObjectResponse | PartialPageObjectResponse) => ({
        id: page.id,
        title: extractPageTitle(page),
        url: 'url' in page ? page.url : '',
        type: 'page' as const,
      }));
    const resources: NotionResource[] = [...databases, ...pages];

    const response: NotionResourcesResponse = {
      resources,
      selectedResourceId: resources[0].id, // Just choose the first?
      selectedResourceType: resources[0].type,
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error(chalk.red("Error fetching Notion databases:"), error);
    res.status(500).json({
      error: "Failed to fetch databases",
      details: error.message
    });
  }
};
