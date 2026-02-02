import logger from "../../logger";
import {
  IntegrationInstance,
  IntegrationType,
} from "../../shared/Integrations";
import { OAuthStatePayload, decodeOAuthStateToken } from "../../utility/oauth";
import { Integration } from "../abstract/Integration";
import { IntegrationFormCompletedTask } from "../IntegrationFormCompletedTask";
import { integrationFormTaskQueue } from "../IntegrationTaskQueues";

/**
 * Helper function to emit IntegrationFormCompletedTask if the form submission
 * was initiated from a chat session (has chat metadata in state payload).
 */
export async function emitIntegrationFormCompletedTaskIfNeeded(
  stateToken: string | undefined,
  integrationManager: Integration<IntegrationInstance, any, any, any>,
  userId: string,
  organizationId: string,
  defaultIntegrationType: IntegrationType,
): Promise<void> {
  // Decode state token if provided
  let statePayload: OAuthStatePayload | null = null;
  if (stateToken) {
    try {
      statePayload = decodeOAuthStateToken(stateToken);
    } catch (error) {
      logger.warn("Failed to decode state token in form submission", {
        error,
        integrationType: defaultIntegrationType,
        userId,
      });
      // Continue without state token - not critical
      return;
    }
  }

  // Only emit task if state payload has chat metadata
  if (!statePayload || !statePayload.chatId || !statePayload.channel) {
    return;
  }

  try {
    // Get integration ID by querying the database
    const instances = await integrationManager.getInstancesForOrganization(
      organizationId,
    );
    if (instances.length === 0) {
      logger.warn(
        "[Integration Form] No integration instances found after submission",
        {
          userId,
          integrationType: defaultIntegrationType,
        },
      );
      return;
    }

    const integrationId = instances[0].id;
    const integrationType =
      (statePayload.integrationType as IntegrationType) ||
      defaultIntegrationType;

    logger.info(
      "[Web Chat Integration Form] Form submission successful, emitting task",
      {
        integrationType,
        integrationId,
        userId,
        chatId: statePayload.chatId,
        channel: statePayload.channel,
      },
    );

    integrationFormTaskQueue.emit(
      new IntegrationFormCompletedTask(
        integrationType,
        integrationId,
        userId,
        organizationId,
        statePayload,
        new Date(),
      ),
    );
  } catch (error) {
    logger.error("Error emitting integration form completed task", { error });
    // Don't throw - we don't want to break the form completion flow
  }
}
