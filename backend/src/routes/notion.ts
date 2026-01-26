import { Request, Response } from "express";
import { NotionResourcesResponse } from "../shared/types";
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

export const fetchNotionResources = async (
  userId: string,
  integrationId: string,
  search: string = "",
  typeFilter?: string
): Promise<NotionResourcesResponse> => {
  const manager = new NotionIntegrationManager();
  const resources = await manager.fetchResourcesForInstance(userId, integrationId, search);

  // Apply type filter if specified
  if (typeFilter) {
    return { resources: resources.filter(r => r.type === typeFilter) };
  }

  return { resources };
};

export const getNotionResources = async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const integrationId = req.query.integrationId as string;
  if (!integrationId) {
    return res.status(400).json({ error: "integrationId is required" });
  }

  const search = (req.query.search as string) || "";
  const typeFilter = req.query.type as string | undefined;

  try {
    const response = await fetchNotionResources(user.id, integrationId, search, typeFilter);
    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error searching Notion resources:', { error });
    res.status(500).json({
      error: "Failed to search resources",
      details: error.message
    });
  }
};
