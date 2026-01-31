import { IntegrationCompletedTask } from "./IntegrationCompletedTask";
import { IntegrationFormCompletedTask } from "./IntegrationFormCompletedTask";
import {
  integrationTaskQueue,
  integrationFormTaskQueue,
} from "./IntegrationTaskQueues";
import { resumeChatAgentAfterIntegration } from "../agent/ChatAgent/resumeChatAgentAfterIntegration";
import logger from "../logger";
import { IntegrationType } from "../shared/Integrations";
import { OAuthStatePayload } from "../utility/oauth";
import { trackIntegrationAdded } from "../utility/analytics";

const INTEGRATION_COMPLETED_TASK_NAME = "INTEGRATION_COMPLETED_TASK" as const;
const INTEGRATION_FORM_COMPLETED_TASK_NAME =
  "INTEGRATION_FORM_COMPLETED_TASK" as const;

/**
 * Checks if the state payload contains chat metadata indicating
 * this OAuth flow was initiated from ChatAgent
 */
function hasChatMetadata(statePayload: OAuthStatePayload): boolean {
  return !!(
    statePayload &&
    typeof statePayload === "object" &&
    statePayload.chatId &&
    statePayload.channel &&
    statePayload.integrationType
  );
}

/**
 * Register listener for integration completed tasks
 * When an integration completes with chat metadata, it will resume the ChatAgent conversation
 */
integrationTaskQueue.addListener({
  taskName: INTEGRATION_COMPLETED_TASK_NAME,
  onTask: async (task: IntegrationCompletedTask) => {
    try {
      // Track integration added analytics event
      trackIntegrationAdded(task.userId, {
        integrationType: task.integrationType,
      });

      // Check if this OAuth flow was initiated from ChatAgent
      if (hasChatMetadata(task.statePayload)) {
        logger.info(
          "Integration completed with chat metadata, resuming ChatAgent",
          {
            integrationType: task.integrationType,
            integrationId: task.integrationId,
            userId: task.userId,
            chatId: task.statePayload.chatId,
            channel: task.statePayload.channel,
          },
        );

        // Resume ChatAgent conversation asynchronously (organization-scoped)
        const organizationId = task.statePayload?.organizationId;
        if (organizationId) {
          await resumeChatAgentAfterIntegration(
            task.userId,
            organizationId,
            task.statePayload.chatId!,
            task.statePayload.channel!,
            task.statePayload.integrationType as IntegrationType,
            task.integrationId,
            task.statePayload.messageTs,
          );
          logger.info("ChatAgent resumed after integration completion", {
            integrationType: task.integrationType,
            integrationId: task.integrationId,
          });
        }
      } else {
        logger.debug(
          "Integration completed without chat metadata (normal OAuth flow)",
          {
            integrationType: task.integrationType,
            integrationId: task.integrationId,
            userId: task.userId,
          },
        );
      }
    } catch (error) {
      // Log error but don't throw - we don't want to break the task flow
      logger.error("Error in integration completion task handler", {
        error,
        integrationType: task.integrationType,
        integrationId: task.integrationId,
        userId: task.userId,
      });
    }
  },
});

logger.info("Integration task handler listener registered");

/**
 * Register listener for integration form completion tasks
 * When an integration form is completed with chat metadata, it will resume the ChatAgent conversation
 */
integrationFormTaskQueue.addListener({
  taskName: INTEGRATION_FORM_COMPLETED_TASK_NAME,
  onTask: async (task: IntegrationFormCompletedTask) => {
    try {
      // Track integration added analytics event
      trackIntegrationAdded(task.userId, {
        integrationType: task.integrationType,
      });

      // Check if this form completion was initiated from ChatAgent
      if (hasChatMetadata(task.statePayload)) {
        const channel = task.statePayload.channel!;
        const chatId = task.statePayload.chatId!;

        logger.info(
          "Integration form completed with chat metadata, resuming ChatAgent",
          {
            integrationType: task.integrationType,
            integrationId: task.integrationId,
            userId: task.userId,
            chatId,
            channel,
          },
        );

        // Resume ChatAgent conversation asynchronously (organization-scoped)
        await resumeChatAgentAfterIntegration(
          task.userId,
          task.organizationId,
          chatId,
          channel,
          task.statePayload.integrationType as IntegrationType,
          task.integrationId,
          task.statePayload.messageTs,
        );

        logger.info("ChatAgent resumed after integration form completion", {
          integrationType: task.integrationType,
          integrationId: task.integrationId,
          channel,
        });
      } else {
        logger.debug(
          "Integration form completed without chat metadata (normal form flow)",
          {
            integrationType: task.integrationType,
            integrationId: task.integrationId,
            userId: task.userId,
          },
        );
      }
    } catch (error) {
      // Log error but don't throw - we don't want to break the task flow
      logger.error("Error in integration form completion task handler", {
        error,
        integrationType: task.integrationType,
        integrationId: task.integrationId,
        userId: task.userId,
      });
    }
  },
});

logger.info("Integration form task handler listener registered");
