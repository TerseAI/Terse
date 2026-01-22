import { FormFieldDefinition, FormIntegrationInstallation, Integration, FormSubmissionInput, FormSubmissionResult } from "./abstract/Integration";
import { CronJobIntegrationMetadata, IntegrationInstance, IntegrationType } from "../shared/Integrations";
import { AgentTriggerWithConfigs } from "../types/prisma";
import logger, { runWithUserContext } from "../logger";
import { createSchedulerClient, SchedulerClient } from "../utility/schedulerClient";
import { settings } from "../config/settings";
import { db } from "../prismaClient";
import { EventProcessor } from "../agent/AgentRunner/EventProcessor";
import { InputEvent } from "./abstract/InputEvent";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { InputConfigType } from "@prisma/client";
import { ApiRoutes } from "../shared/ApiRoutes";
import { FrontendRoutes } from "../shared/FrontendRoutes";

export interface ScheduleWebhookEvent {
    inputId: string;
    isManualTrigger?: boolean;
    manualContext?: string;
}

export class CronJobIntegrationManager implements
    Integration<IntegrationInstance, ScheduleWebhookEvent, typeof CronJobIntegrationMetadata>,
    FormIntegrationInstallation<IntegrationType.CRON_JOB> {
    integrationType: IntegrationType = IntegrationType.CRON_JOB;
    private schedulerClient: SchedulerClient | null = null;

    constructor() { }

    getFormFields(): FormFieldDefinition[] {
        return [];
    }

    private getSchedulerClient(): SchedulerClient {
        if (!this.schedulerClient) {
            this.schedulerClient = createSchedulerClient();
        }
        return this.schedulerClient;
    }

    async getInstancesForUser(_userId: string): Promise<IntegrationInstance[]> {
        return [];
    }

    formatIntegrationInstanceForAgent(_instance: IntegrationInstance): string {
        return `This is a cron job integration. It is always supported by default.`;
    }

    async getAllActiveInstances(): Promise<IntegrationInstance[]> {
        return [];
    }

    async processWebhookEvent(event: ScheduleWebhookEvent): Promise<void> {
        const { inputId, isManualTrigger, manualContext } = event;

        logger.info(isManualTrigger ? "🖱️ Processing manual trigger" : "⏰ Processing schedule trigger", {
            inputId,
            isManualTrigger,
            hasManualContext: !!manualContext,
        });

        const agentTrigger = await db().automation_inputs.findUnique({
            where: { id: inputId },
            include: {
                automation: true,
                time_trigger_config: true,
            },
        });
        if (!agentTrigger) {
            logger.warn("⚠️  Schedule trigger: channel input not found", { inputId });
            return;
        }

        if (!agentTrigger.time_trigger_config) {
            logger.warn("⚠️  Schedule trigger: no time trigger config", { inputId });
            return;
        }

        const channel = agentTrigger.automation;
        if (!channel) {
            logger.warn("⚠️  Schedule trigger: channel not found", { inputId });
            return;
        }

        if (!channel.is_active) {
            logger.info("ℹ️  Schedule triggered but channel is inactive", {
                inputId,
                channelId: channel.id,
                channelName: channel.name
            });
            return;
        }

        const user = await db().users.findUnique({
            where: { id: agentTrigger.automation.user_id },
        });

        if (!user) {
            logger.warn("⚠️  Schedule trigger: user not found", { inputId });
            return;
        }

        logger.info(isManualTrigger ? "✅ Manual trigger processed" : "✅ Schedule trigger processed", {
            inputId,
            channelId: channel.id,
            channelName: channel.name,
            cronExpression: agentTrigger.time_trigger_config.cron_expression,
            isManualTrigger,
        });

        // Process with user context for logging
        await runWithUserContext(user.id, user.email, async () => {
            const cronJobEvent = new CronJobEvent(event);
            const eventProcessor = new EventProcessor(cronJobEvent, user);
            await eventProcessor.process();
        });
    }

    async deleteInstallation(_integrationId: string): Promise<void> { }

    async setupAgentTrigger(_integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        if (!agentTrigger.time_trigger_config) {
            logger.warn("⚠️  No time_trigger_config found for channel input, skipping scheduler setup", {
                inputId: agentTrigger.id,
            });
            return;
        }

        const cronExpression = agentTrigger.time_trigger_config.cron_expression;
        if (!cronExpression) {
            logger.warn("⚠️  No cron expression configured, skipping scheduler setup", {
                inputId: agentTrigger.id,
            });
            return;
        }

        try {
            const scheduler = this.getSchedulerClient();
            const jobId = this.getJobIdForInput(agentTrigger.id);
            const webhookUrl = this.getWebhookUrl(agentTrigger.id);

            const existingJob = await scheduler.get(jobId);
            if (existingJob) {
                logger.info("✅ Scheduler job already exists for channel input", {
                    inputId: agentTrigger.id,
                    jobId,
                    schedule: existingJob.schedule,
                });
                return;
            }

            const job = await scheduler.create(jobId, cronExpression, webhookUrl);

            logger.info("✅ Created Cloud Scheduler job for time trigger", {
                inputId: agentTrigger.id,
                jobId: job.id,
                schedule: job.schedule,
                url: job.url,
            });
        } catch (error) {
            logger.error("❌ Failed to create Cloud Scheduler job", {
                error,
                inputId: agentTrigger.id,
                cronExpression,
            });
            throw error;
        }
    }

    async teardownAgentTrigger(_integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        if (!agentTrigger.time_trigger_config) {
            return;
        }

        const scheduler = this.getSchedulerClient();
        let jobId: string | null = null;
        try {
            jobId = this.getJobIdForInput(agentTrigger.id);
            logger.info("Deleting Cloud Scheduler job", { inputId: agentTrigger.id, jobId });
        } catch (error) {
            logger.error("❌ Failed to delete Cloud Scheduler job", {
                inputId: agentTrigger.id,
            });
            return;
        }

        if (!jobId) {
            console.warn("No job ID found for input", { inputId: agentTrigger.id });
            return;
        }

        try {
            await scheduler.delete(jobId);
        } catch (error) {
            if (isSchedulerJobNotFoundError(error)) {
                logger.info("ℹ️  Scheduler job already removed", {
                    inputId: agentTrigger.id,
                    jobId,
                });
                return;
            }

            logger.error("❌ Failed to delete Cloud Scheduler job", {
                inputId: agentTrigger.id,
                jobId,
            });
            throw error;
        }

        logger.info("✅ Deleted Cloud Scheduler job for time trigger", {
            inputId: agentTrigger.id,
            jobId,
        });
    }

    async processFormSubmission(_input: FormSubmissionInput): Promise<FormSubmissionResult> {
        return {
            success: false,
            error: "CronJob is a system integration and cannot be installed",
            statusCode: 400,
        };
    }

    private getJobIdForInput(inputId: string): string {
        return `terse-schedule-${inputId}`;
    }

    private getWebhookUrl(inputId: string): string {
        const baseUrl = settings.urls.backend;
        return `${baseUrl}${ApiRoutes.WEBHOOKS.SCHEDULE_BY_INPUT_ID.build(inputId)}`;
    }
}

function isSchedulerJobNotFoundError(error: unknown): boolean {
    if (!error) {
        return false;
    }

    const anyError = error as { code?: number; message?: string };
    if (anyError.code === 5) {
        return true;
    }

    return typeof anyError.message === "string" && anyError.message.includes("NOT_FOUND");
}


export class CronJobEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.CRON_JOB;
    data: ScheduleWebhookEvent;

    constructor(data: ScheduleWebhookEvent) {
        super();
        this.data = data;
    }

    formatForAgentRunner(): string {
        const { isManualTrigger, manualContext } = this.data;

        if (isManualTrigger) {
            let message = `This is a manually triggered event for the channel input ${this.data.inputId}.`;

            if (manualContext) {
                message += `\n\nUser provided context for this manual trigger:\n${manualContext}`;
            }

            return message;
        }

        return `This is a scheduled event for the channel input ${this.data.inputId}. The channel input is configured to run at the following cron expression.`;
    }

    debugLog(): string {
        return this.data.isManualTrigger ? `Manual Trigger` : `Scheduled Event`;
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.TIME_TRIGGER) {
            return false;
        }

        return true;
    }

    createTriggerMetadata(): RunHistoryTrigger {
        const { isManualTrigger } = this.data;

        return {
            event: isManualTrigger ? 'manual_trigger' : 'scheduled_event',
            integration: IntegrationType.CRON_JOB,
            source: isManualTrigger ? "Manual Trigger" : "Scheduled Job",
            title: isManualTrigger ? "Manual Trigger" : "Scheduled Job",
            subheader: isManualTrigger ? "Triggered manually by user" : "Scheduled Job",
            url: FrontendRoutes.AGENTS.BY_ID_RELATIVE(this.data.inputId),
        };
    }

    getImageUrls(): string[] {
        return [];
    }
}