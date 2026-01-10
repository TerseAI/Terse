import { FormIntegrationInstallation, Integration } from "./abstract/Integration";
import { CronJobIntegrationMetadata, IntegrationInstance, IntegrationType } from "../shared/Integrations";
import { ChannelInputWithConfigs } from "../types/prisma";
import { Request, Response } from "express";
import logger from "../logger";
import { createSchedulerClient, SchedulerClient } from "../utility/schedulerClient";
import { settings } from "../config/settings";
import { db } from "../prismaClient";

// Event type for schedule webhook
export interface ScheduleWebhookEvent {
    inputId: string;
}

export class CronJobIntegrationManager implements 
    Integration<IntegrationInstance, ScheduleWebhookEvent, typeof CronJobIntegrationMetadata>, 
    FormIntegrationInstallation<IntegrationType.CRON_JOB> 
{
    integrationType: IntegrationType = IntegrationType.CRON_JOB;
    private schedulerClient: SchedulerClient | null = null;

    constructor() {}

    private getSchedulerClient(): SchedulerClient {
        if (!this.schedulerClient) {
            this.schedulerClient = createSchedulerClient();
        }
        return this.schedulerClient;
    }

    async getInstancesForUser(_userId: string): Promise<IntegrationInstance[]> {
        return [];
    }

    async getAllActiveInstances(): Promise<IntegrationInstance[]> {
        return [];
    }

    async processWebhookEvent(event: ScheduleWebhookEvent): Promise<void> {
        const { inputId } = event;

        logger.info("⏰ Processing schedule trigger", { inputId });

        const channelInput = await db().automation_inputs.findUnique({
            where: { id: inputId },
            include: {
                automation: true,
                time_trigger_config: true,
            },
        });

        if (!channelInput) {
            logger.warn("⚠️  Schedule trigger: channel input not found", { inputId });
            return;
        }

        if (!channelInput.time_trigger_config) {
            logger.warn("⚠️  Schedule trigger: no time trigger config", { inputId });
            return;
        }

        const channel = channelInput.automation;
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

        logger.info("✅ Schedule trigger processed", {
            inputId,
            channelId: channel.id,
            channelName: channel.name,
            cronExpression: channelInput.time_trigger_config.cron_expression,
        });
    }

    async deleteInstallation(_integrationId: string): Promise<void> {}

    async setupChannelInput(_integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void> {
        if (!channelInput.time_trigger_config) {
            logger.warn("⚠️  No time_trigger_config found for channel input, skipping scheduler setup", {
                inputId: channelInput.id,
            });
            return;
        }

        const cronExpression = channelInput.time_trigger_config.cron_expression;
        if (!cronExpression) {
            logger.warn("⚠️  No cron expression configured, skipping scheduler setup", {
                inputId: channelInput.id,
            });
            return;
        }

        try {
            const scheduler = this.getSchedulerClient();
            const jobId = this.getJobIdForInput(channelInput.id);
            const webhookUrl = this.getWebhookUrl(channelInput.id);

            const existingJob = await scheduler.get(jobId);
            if (existingJob) {
                logger.info("✅ Scheduler job already exists for channel input", {
                    inputId: channelInput.id,
                    jobId,
                    schedule: existingJob.schedule,
                });
                return;
            }

            const job = await scheduler.create(jobId, cronExpression, webhookUrl);
            
            logger.info("✅ Created Cloud Scheduler job for time trigger", {
                inputId: channelInput.id,
                jobId: job.id,
                schedule: job.schedule,
                url: job.url,
            });
        } catch (error) {
            logger.error("❌ Failed to create Cloud Scheduler job", {
                error,
                inputId: channelInput.id,
                cronExpression,
            });
            throw error;
        }
    }

    /**
     * Deletes the Cloud Scheduler job when a TIME_TRIGGER input is removed from a channel.
     */
    async teardownChannelInput(_integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void> {
        if (!channelInput.time_trigger_config) {
            return;
        }

        const scheduler = this.getSchedulerClient();
        const jobId = this.getJobIdForInput(channelInput.id);

        if (!jobId) {
            console.warn("No job ID found for input", { inputId: channelInput.id });
            return;
        }

        await scheduler.delete(jobId);
        
        logger.info("✅ Deleted Cloud Scheduler job for time trigger", {
            inputId: channelInput.id,
            jobId,
        });
    }

    async processFormSubmission(_req: Request, res: Response): Promise<void> {
        res.status(400).json({ error: "CronJob is a system integration and cannot be installed" });
    }

    private getJobIdForInput(inputId: string): string {
        return `terse-schedule-${inputId}`;
    }

    private getWebhookUrl(inputId: string): string {
        const baseUrl = settings.urls.backend;
        return `${baseUrl}/webhooks/schedule/${inputId}`;
    }
}
