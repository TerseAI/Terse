import { InputConfigType } from "@prisma/client"
import { CronTrigger, buildRoute } from "terse-types"
import { FormFieldDefinition } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { CronJobIntegrationMetadata, IntegrationInstance, IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"

import logger, { runWithUserContext } from "../../common/logger"
import { db } from "../../loaders/prisma"
import { EventProcessor } from "../../modules/agents/AgentRunner/EventProcessor"
import { removeScheduleTrigger, upsertScheduleTrigger } from "../../tasks/queues/scheduleQueue"
import { AgentTriggerWithConfigs } from "../../types/prisma"
import { resolveUserInOrg } from "../../utility/identity"
import { FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration, createNotConnectedCliDisplayState } from "../abstract/Integration"
import { TriggerRuntime } from "../abstract/TriggerRuntime"

interface ScheduleWebhookEvent {
    inputId: string
    isManualTrigger?: boolean
    manualContext?: string
}

export class CronJobIntegrationManager
    extends Integration<IntegrationInstance, ScheduleWebhookEvent, typeof CronJobIntegrationMetadata, never>
    implements FormIntegrationInstallation<IntegrationType.CRON_JOB>
{
    readonly integrationType = IntegrationType.CRON_JOB
    readonly settingsKey = "cloudScheduler"

    getFormFields(): FormFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(_organizationId: string): Promise<IntegrationInstance[]> {
        return []
    }

    async getCliDisplayStateForOrganization(_organizationId: string) {
        return createNotConnectedCliDisplayState()
    }

    formatIntegrationInstanceForAgent(_instance: IntegrationInstance): string {
        return `This is a cron job integration. It is always supported by default.`
    }

    async getAllActiveInstances(): Promise<IntegrationInstance[]> {
        return []
    }

    async processWebhookEvent(event: ScheduleWebhookEvent): Promise<void> {
        const { inputId, isManualTrigger, manualContext } = event

        logger.info(isManualTrigger ? "🖱️ Processing manual trigger" : "⏰ Processing schedule trigger", {
            inputId,
            isManualTrigger,
            hasManualContext: !!manualContext
        })

        const agentTrigger = await db().automation_inputs.findUnique({
            where: { id: inputId },
            include: {
                automation: true,
                time_trigger_config: true
            }
        })
        if (!agentTrigger) {
            logger.warn("⚠️  Schedule trigger: channel input not found", { inputId })
            return
        }

        if (!agentTrigger.time_trigger_config) {
            logger.warn("⚠️  Schedule trigger: no time trigger config", { inputId })
            return
        }

        const channel = agentTrigger.automation
        if (!channel) {
            logger.warn("⚠️  Schedule trigger: channel not found", { inputId })
            return
        }

        if (!channel.is_active && !isManualTrigger) {
            logger.info("ℹ️  Schedule triggered but channel is inactive", {
                inputId,
                channelId: channel.id,
                channelName: channel.name
            })
            return
        }

        logger.info(isManualTrigger ? "✅ Manual trigger processed" : "✅ Schedule trigger processed", {
            inputId,
            channelId: channel.id,
            channelName: channel.name,
            cronExpression: agentTrigger.time_trigger_config.cron_expression,
            isManualTrigger
        })

        const user = await resolveUserInOrg(agentTrigger.automation.user_id, channel.organization_id)
        if (!user) {
            logger.warn("User not found for cron job trigger", {
                userId: agentTrigger.automation.user_id
            })
            return
        }

        // Process with user context for logging
        await runWithUserContext(user, async () => {
            const cronJobEvent = new CronTriggerRuntime(event)
            const eventProcessor = new EventProcessor(cronJobEvent, user, { isManuallyTriggered: !!isManualTrigger })
            await eventProcessor.processSingleAgent(agentTrigger.automation.id)
        })
    }

    async deleteInstallation(_integrationId: string): Promise<void> {}

    async setupAgentTrigger(_integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        if (!agentTrigger.time_trigger_config) {
            logger.warn("⚠️  No time_trigger_config found for channel input, skipping scheduler setup", {
                inputId: agentTrigger.id
            })
            return
        }

        const cronExpression = agentTrigger.time_trigger_config.cron_expression
        if (!cronExpression) {
            logger.warn("⚠️  No cron expression configured, skipping scheduler setup", {
                inputId: agentTrigger.id
            })
            return
        }

        try {
            await upsertScheduleTrigger(agentTrigger.id, cronExpression)
            logger.info("✅ Upserted BullMQ schedule for time trigger", {
                inputId: agentTrigger.id,
                cronExpression
            })
        } catch (error) {
            logger.error("❌ Failed to upsert BullMQ schedule", {
                error,
                inputId: agentTrigger.id,
                cronExpression
            })
            throw error
        }
    }

    async teardownAgentTrigger(_integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        if (!agentTrigger.time_trigger_config) {
            return
        }

        try {
            await removeScheduleTrigger(agentTrigger.id)
            logger.info("✅ Removed BullMQ schedule for time trigger", {
                inputId: agentTrigger.id
            })
        } catch (error) {
            logger.error("❌ Failed to remove BullMQ schedule", {
                error,
                inputId: agentTrigger.id
            })
            throw error
        }
    }

    async processFormSubmission(_input: FormSubmissionInput): Promise<FormSubmissionResult> {
        return {
            success: false,
            error: "CronJob is a system integration and cannot be installed",
            statusCode: 400
        }
    }
}

class CronTriggerRuntime extends TriggerRuntime<CronTrigger> {
    readonly integrationType = IntegrationType.CRON_JOB
    data: CronTrigger

    constructor(data: ScheduleWebhookEvent) {
        super()
        this.data = {
            integrationType: IntegrationType.CRON_JOB,
            eventType: "cron",
            inputId: data.inputId,
            isManualTrigger: data.isManualTrigger,
            manualContext: data.manualContext
        }
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.TIME_TRIGGER) {
            return false
        }
        // Must match the specific trigger ID, not just any time trigger
        return agentTrigger.id === this.data.inputId
    }

    createTriggerMetadata(): RunHistoryTrigger {
        const { isManualTrigger } = this.data
        return {
            event: isManualTrigger ? "manual_trigger" : "scheduled_event",
            integration: IntegrationType.CRON_JOB,
            source: isManualTrigger ? "Manual Trigger" : "Scheduled Job",
            title: isManualTrigger ? "Manual Trigger" : "Scheduled Job",
            subheader: isManualTrigger ? "Triggered manually by user" : "Scheduled Job",
            url: buildRoute(FrontendRoutes.JOBS.BY_ID, { id: this.data.inputId })
        }
    }
}
