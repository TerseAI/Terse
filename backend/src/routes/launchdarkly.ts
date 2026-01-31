import { Request, Response } from "express";
import { parseFormSubmissionFromRequest } from "../integrations/abstract/Integration";
import { LaunchDarklyIntegrationManager } from "../integrations/LaunchDarklyIntegration";
import logger from "../logger";
import { db } from "../prismaClient";

export async function getLaunchDarklyIntegrations(req: Request, res: Response) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const manager = new LaunchDarklyIntegrationManager();
    const integrations = await manager.getInstancesForOrganization(
      req.session.user.organizationId,
    );
    res.status(200).json(integrations);
  } catch (error) {
    logger.error("Error fetching LaunchDarkly integrations:", { error });
    res
      .status(500)
      .json({ error: "Failed to fetch LaunchDarkly integrations" });
  }
}

export async function createOrUpdateLaunchDarklyIntegration(
  req: Request,
  res: Response,
) {
  const input = parseFormSubmissionFromRequest(req);
  if (!input) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const manager = new LaunchDarklyIntegrationManager();
    const result = await manager.processFormSubmission(input);

    if (!result.success) {
      res.status(result.statusCode || 500).json({
        error: result.error || "Failed to process integration",
        ...(result.data || {}),
      });
      return;
    }

    res.status(result.statusCode || 200).json(result.data || { success: true });
  } catch (error) {
    logger.error("Error creating/updating LaunchDarkly integration:", {
      error,
    });
    res.status(500).json({ error: "Failed to process integration" });
  }
}

export async function getLaunchDarklyProjects(req: Request, res: Response) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { integrationId } = req.params;

  if (!integrationId) {
    res.status(400).json({ error: "integrationId is required" });
    return;
  }

  try {
    const response = await fetchLaunchDarklyProjects(
      req.session.user.id,
      integrationId,
    );
    res.status(200).json(response);
  } catch (error: any) {
    logger.error("Error fetching LaunchDarkly projects:", {
      error,
      integrationId,
    });
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch projects" });
  }
}

export async function fetchLaunchDarklyProjects(
  userId: string,
  integrationId: string,
  query: string = "",
): Promise<{ projects: Array<{ key: string; name: string }> }> {
  const integration = await db().launchdarkly_integrations.findFirst({
    where: {
      id: integrationId,
      user_id: userId,
    },
  });

  if (!integration) {
    throw new Error("LaunchDarkly integration not found");
  }

  const response = await fetch("https://app.launchdarkly.com/api/v2/projects", {
    method: "GET",
    headers: {
      Authorization: integration.api_key,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("Failed to fetch LaunchDarkly projects", {
      integrationId,
      status: response.status,
      error: errorText,
    });
    throw new Error(response.status === 401 ? "Invalid API key" : errorText);
  }

  const projectsData = await response.json();
  let projects = Array.isArray(projectsData)
    ? projectsData
    : projectsData.items || projectsData.projects || [];

  if (query) {
    const queryLower = query.toLowerCase();
    projects = projects.filter(
      (p: any) =>
        p.name?.toLowerCase().includes(queryLower) ||
        p.key?.toLowerCase().includes(queryLower),
    );
  }

  const projectsList = projects.map((p: any) => ({
    key: p.key || p._id,
    name: p.name || p.key || "Unnamed Project",
  }));

  return { projects: projectsList };
}

export async function fetchLaunchDarklyEnvironments(
  userId: string,
  integrationId: string,
  projectKey: string,
): Promise<{ environments: Array<{ key: string; name: string }> }> {
  const integration = await db().launchdarkly_integrations.findFirst({
    where: {
      id: integrationId,
      user_id: userId,
    },
  });

  if (!integration) {
    throw new Error("LaunchDarkly integration not found");
  }

  const response = await fetch(
    `https://app.launchdarkly.com/api/v2/projects/${projectKey}/environments`,
    {
      method: "GET",
      headers: {
        Authorization: integration.api_key,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("Failed to fetch LaunchDarkly environments", {
      integrationId,
      projectKey,
      status: response.status,
      error: errorText,
    });
    throw new Error(response.status === 401 ? "Invalid API key" : errorText);
  }

  const environmentsData = await response.json();
  const environments = Array.isArray(environmentsData)
    ? environmentsData
    : environmentsData.items || environmentsData.environments || [];

  return {
    environments: environments.map((e: any) => ({
      key: e.key || e._id,
      name: e.name || e.key || "Unnamed Environment",
    })),
  };
}

export async function getLaunchDarklyEnvironments(req: Request, res: Response) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { integrationId, projectKey } = req.params;

  if (!integrationId || !projectKey) {
    res
      .status(400)
      .json({ error: "integrationId and projectKey are required" });
    return;
  }

  try {
    const integration = await db().launchdarkly_integrations.findUnique({
      where: { id: integrationId },
      select: { api_key: true, user_id: true },
    });

    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    // Verify the integration belongs to the user
    if (integration.user_id !== req.session.user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Fetch environments from LaunchDarkly API
    const response = await fetch(
      `https://app.launchdarkly.com/api/v2/projects/${projectKey}/environments`,
      {
        method: "GET",
        headers: {
          Authorization: integration.api_key,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to fetch LaunchDarkly environments", {
        integrationId,
        projectKey,
        status: response.status,
        error: errorText,
      });
      res
        .status(response.status)
        .json({ error: "Failed to fetch environments from LaunchDarkly" });
      return;
    }

    const environmentsData = await response.json();
    const environments = Array.isArray(environmentsData)
      ? environmentsData
      : environmentsData.items || environmentsData.environments || [];

    // Return environments with key and name
    const environmentsList = environments.map((e: any) => ({
      key: e.key || e._id,
      name: e.name || e.key || "Unnamed Environment",
    }));

    res.status(200).json({ environments: environmentsList });
  } catch (error) {
    logger.error("Error fetching LaunchDarkly environments:", {
      error,
      integrationId,
      projectKey,
    });
    res.status(500).json({ error: "Failed to fetch environments" });
  }
}
