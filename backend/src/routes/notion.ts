import { Client } from "@notionhq/client";
import { SearchResponse } from "@notionhq/client/build/src/api-endpoints";
import { Request, Response } from "express";
import { NotionIntegrationManager } from "../integrations/NotionIntegration";
import logger from "../logger";
import { db } from "../prismaClient";
import { NotionResource, NotionResourcesResponse } from "../shared/types";
import { extractPageTitle } from "../utility/notion";

export async function getNotionIntegrations(req: Request, res: Response) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const manager = new NotionIntegrationManager();
    const integrations = await manager.getInstancesForOrganization(
      req.session.user.organizationId,
    );
    res.status(200).json(integrations);
  } catch (error) {
    logger.error("Error fetching Notion integrations:", { error });
    res.status(500).json({ error: "Failed to fetch Notion integrations" });
  }
}

// OAuth Functions
export const notionOAuthCallback = async (req: Request, res: Response) => {
  const integration = new NotionIntegrationManager();
  await integration.processInstallationCallback(req, res);
};

// Search Notion pages and databases by title
export const fetchNotionResources = async (
  organizationId: string,
  integrationId: string,
  search: string = "",
  typeFilter?: string,
): Promise<NotionResourcesResponse> => {
  if (!integrationId) {
    throw new Error("integrationId is required");
  }
  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  const integration = await db().notion_integrations.findFirst({
    where: {
      id: integrationId,
      organization_id: organizationId,
    },
  });

  if (!integration) {
    throw new Error("Notion integration not found");
  }

  const manager = new NotionIntegrationManager();
  const accessToken = await manager.getAccessToken(integrationId);
  if (!accessToken) {
    throw new Error("Could not get valid access token");
  }

  const notionClient = new Client({ auth: accessToken });
  const searchOptions: Parameters<typeof notionClient.search>[0] = {
    query: search,
    page_size: 100,
  };

  if (typeFilter === "page") {
    searchOptions.filter = { property: "object", value: "page" };
  } else if (typeFilter === "database") {
    searchOptions.filter = { property: "object", value: "data_source" };
  }

  const searchResponse: SearchResponse = await notionClient.search(
    searchOptions,
  );

  let resources: NotionResource[] = searchResponse.results
    .map((result: any) => {
      if (result.object === "data_source") {
        return {
          id: result.id,
          title: result.title?.[0]?.plain_text || "Untitled Database",
          url: result.url,
          type: "database" as const,
        };
      } else if (result.object === "page") {
        return {
          id: result.id,
          title: extractPageTitle(result),
          url: "url" in result ? result.url : "",
          type: "page" as const,
        };
      }
      return null;
    })
    .filter((resource): resource is NotionResource => resource !== null);

  if (!search) {
    resources = resources.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
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
    if (!user.organizationId) {
      return res.status(400).json({ error: "Organization context is required" });
    }
    const response = await fetchNotionResources(
      user.organizationId,
      integrationId,
      search,
      typeFilter,
    );
    res.status(200).json(response);
  } catch (error: any) {
    logger.error("Error searching Notion resources:", { error });
    res.status(500).json({
      error: "Failed to search resources",
      details: error.message,
    });
  }
};
