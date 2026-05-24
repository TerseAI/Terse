import { InputConfigType } from "@prisma/client"
import { ApiRoutes, CronTrigger, buildRoute } from "terse-types"
import { FormFieldDefinition } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { CronJobIntegrationMetadata, IntegrationInstance, IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"

import logger, { runWithUserContext } from "../../common/logger"
import { SchedulerClient, createSchedulerClient } from "../../common/schedulerClient"
import { getUserForOrg } from "../../integrations/workos/helpers"
import { db } from "../../loaders/prisma"
import { EventProcessor } from "../../modules/agents/AgentRunner/EventProcessor"
import { settings } from "../../settings"
import { AgentTriggerWithConfigs } from "../../types/prisma"
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
    private schedulerClient: SchedulerClient | null = null

    getFormFields(): FormFieldDefinition[] {
        return []
    }

    private getSchedulerClient(): SchedulerClient {
        if (!this.schedulerClient) {
            this.schedulerClient = createSchedulerClient()
        }
        return this.schedulerClient
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

        const user = await getUserForOrg(agentTrigger.automation.user_id, channel.organization_id)
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
            const scheduler = this.getSchedulerClient()
            const jobId = this.getJobIdForInput(agentTrigger.id)
            const webhookUrl = this.getWebhookUrl(agentTrigger.id)

            const existingJob = await scheduler.get(jobId)
            if (existingJob) {
                logger.info("✅ Scheduler job already exists for channel input", {
                    inputId: agentTrigger.id,
                    jobId,
                    schedule: existingJob.schedule
                })
                return
            }

            const job = await scheduler.create(jobId, cronExpression, webhookUrl)

            logger.info("✅ Created Cloud Scheduler job for time trigger", {
                inputId: agentTrigger.id,
                jobId: job.id,
                schedule: job.schedule,
                url: job.url
            })
        } catch (error) {
            logger.error("❌ Failed to create Cloud Scheduler job", {
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

        const scheduler = this.getSchedulerClient()
        let jobId: string | null = null
        try {
            jobId = this.getJobIdForInput(agentTrigger.id)
            logger.info("Deleting Cloud Scheduler job", {
                inputId: agentTrigger.id,
                jobId
            })
        } catch (error) {
            logger.error("❌ Failed to delete Cloud Scheduler job", {
                inputId: agentTrigger.id
            })
            return
        }

        if (!jobId) {
            logger.warn("No job ID found for input", { inputId: agentTrigger.id })
            return
        }

        try {
            await scheduler.delete(jobId)
        } catch (error) {
            if (isSchedulerJobNotFoundError(error)) {
                logger.info("ℹ️  Scheduler job already removed", {
                    inputId: agentTrigger.id,
                    jobId
                })
                return
            }

            logger.error("❌ Failed to delete Cloud Scheduler job", {
                inputId: agentTrigger.id,
                jobId
            })
            throw error
        }

        logger.info("✅ Deleted Cloud Scheduler job for time trigger", {
            inputId: agentTrigger.id,
            jobId
        })
    }

    async processFormSubmission(_input: FormSubmissionInput): Promise<FormSubmissionResult> {
        return {
            success: false,
            error: "CronJob is a system integration and cannot be installed",
            statusCode: 400
        }
    }

    private getJobIdForInput(inputId: string): string {
        return `terse-schedule-${inputId}`
    }

    private getWebhookUrl(inputId: string): string {
        const baseUrl = settings.urls.backend
        const webhookUrl = buildRoute(ApiRoutes.WEBHOOKS.SCHEDULE_BY_INPUT_ID, { inputId })
        return `${baseUrl}${webhookUrl}`
    }
}

function isSchedulerJobNotFoundError(error: unknown): boolean {
    if (!error) {
        return false
    }

    const anyError = error as { code?: number; message?: string }
    if (anyError.code === 5) {
        return true
    }

    return typeof anyError.message === "string" && anyError.message.includes("NOT_FOUND")
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
            url: buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: this.data.inputId })
        }
    }
}
