import { Request, Response } from "express";
import {
  Integration,
  isOAuthIntegrationInstallation,
} from "../integrations/abstract/Integration";
import { INTEGRATION_REGISTRY } from "../integrations/abstract/IntegrationRegistry";
import logger from "../logger";
import {
  InstallationOptionsFor,
  IntegrationDetails,
  IntegrationInstance,
  IntegrationType,
  IntegrationWithStatus,
} from "../shared/Integrations";
import { OAuthInstallationDetails } from "../shared/types";
import { decodeOAuthStateToken } from "../utility/oauth";

export const getIntegrationInstallationDetails = async (
  req: Request,
  res: Response,
) => {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { integrationType } = req.params;
    if (!integrationType) {
      res.status(400).json({ error: "integrationType parameter is required" });
      return;
    }

    const options = req.query.options
      ? JSON.parse(decodeURIComponent(req.query.options as string))
      : undefined;

    let additionalStatePayload: Record<string, string> | undefined = undefined;
    const stateToken = req.query.state as string | undefined;
    if (stateToken) {
      try {
        const statePayload = decodeOAuthStateToken(stateToken);
        if (statePayload.chatId && statePayload.channel) {
          additionalStatePayload = {
            chatId: statePayload.chatId,
            channel: statePayload.channel,
            integrationType:
              statePayload.integrationType || (integrationType as string),
            ...(statePayload.messageTs
              ? { messageTs: statePayload.messageTs }
              : {}),
          };
        }
      } catch (error) {
        logger.warn(
          "Failed to decode stateToken in getIntegrationInstallationDetails",
          {
            error,
            integrationType: req.params.integrationType,
            userId: req.session?.user?.id,
          },
        );
      }
    }

    const userId = req.session.user.id;
    const organizationId = req.session.user.organizationId;
    const installationDetails = await getInstallationInformation(
      integrationType as IntegrationType,
      userId,
      organizationId,
      options,
      additionalStatePayload,
    );
    res.json(installationDetails);
  } catch (error: any) {
    logger.error("Error getting installation details", {
      error,
      integrationType: req.params.integrationType,
      userId: req.session?.user?.id,
    });
    res
      .status(500)
      .json({ error: error.message || "Failed to get installation details" });
  }
};

const getInstallationInformation = async (
  integration: IntegrationType,
  userId: string,
  organizationId: string,
  options: InstallationOptionsFor<IntegrationType>,
  additionalStatePayload?: Record<string, string>,
): Promise<OAuthInstallationDetails> => {
  const integrationInstance = INTEGRATION_REGISTRY.find(
    (instance) => instance.integrationType === integration,
  );
  if (!integrationInstance) {
    throw new Error(`Integration ${integration} not found`);
  }

  if (isOAuthIntegrationInstallation<typeof integration>(integrationInstance)) {
    return await integrationInstance.getInstallationUrl(
      userId,
      organizationId,
      options,
      additionalStatePayload,
    );
  }

  throw new Error(`Integration ${integration} does not support installation`);
};

export async function getAllIntegrations(req: Request, res: Response) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const organizationId = req.session.user.organizationId;

  const activeIntegrationTypes = await getOrganizationActiveIntegrations(
    organizationId,
  );
  const activeIntegrationSet = new Set(activeIntegrationTypes);

  const integrations: IntegrationWithStatus[] = INTEGRATION_REGISTRY.map(
    (integration) => ({
      integrationType: integration.integrationType,
      isActive: activeIntegrationSet.has(integration.integrationType),
    }),
  );

  res.json(integrations);
}

// Keep for backwards compatibility
export async function getActiveIntegrations(req: Request, res: Response) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const organizationId = req.session.user.organizationId;

  const activeIntegrations = await getOrganizationActiveIntegrations(
    organizationId,
  );

  res.json(activeIntegrations);
}

async function integrationHasInstances(
  integration: Integration<IntegrationInstance, any, IntegrationDetails, any>,
  organizationId: string,
): Promise<boolean> {
  return (
    (await integration.getInstancesForOrganization(organizationId)).length > 0
  );
}

export async function getOrganizationActiveIntegrations(
  organizationId: string,
): Promise<IntegrationType[]> {
  const hasInstancesResults = await Promise.all(
    INTEGRATION_REGISTRY.map((integration) =>
      integrationHasInstances(integration, organizationId),
    ),
  );

  return INTEGRATION_REGISTRY.filter(
    (_, index) => hasInstancesResults[index],
  ).map((integration) => integration.integrationType);
}
