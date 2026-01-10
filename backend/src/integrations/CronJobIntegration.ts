import { FormIntegrationInstallation, Integration } from "./abstract/Integration";
import { CronJobIntegrationMetadata, IntegrationInstance, IntegrationType } from "../shared/Integrations";
import { ChannelInputWithConfigs } from "../types/prisma";
import { Request, Response } from "express";
import logger from "../logger";
import { createSchedulerClient, SchedulerClient } from "../utility/schedulerClient";
import { settings } from "../config/settings";

// CronJobIntegration is a system-level integration that manages GCP Cloud Scheduler jobs
// for time-triggered channel inputs. Unlike other integrations, it doesn't require user
// installation - it's automatically available for scheduling.

export class CronJobIntegrationManager implements 
    Integration<IntegrationInstance, never, typeof CronJobIntegrationMetadata>, 
    FormIntegrationInstallation<IntegrationType.CRON_JOB> 
{
    integrationType: IntegrationType = IntegrationType.CRON_JOB;
    private schedulerClient: SchedulerClient | null = null;

    constructor() {
        // Lazily initialize scheduler client to avoid startup errors if GCP isn't configured
    }

    private getSchedulerClient(): SchedulerClient {
        if (!this.schedulerClient) {
            this.schedulerClient = createSchedulerClient();
        }
        return this.schedulerClient;
    }

    // System integration - no user-specific instances
    async getInstancesForUser(_userId: string): Promise<IntegrationInstance[]> {
        return [];
    }

    // System integration - no instances to list
    async getAllActiveInstances(): Promise<IntegrationInstance[]> {
        return [];
    }

    // CronJob doesn't receive external webhooks - it triggers outbound
    async processWebhookEvent(_event: never): Promise<void> {
        throw new Error("CronJob integration does not process external webhooks");
    }

    // System integration - no installation to delete
    async deleteInstallation(_integrationId: string): Promise<void> {
        // No-op: system integration
    }

    /**
     * Creates a Cloud Scheduler job when a TIME_TRIGGER input is added to a channel.
     * The job will POST to our webhook endpoint at the specified cron schedule.
     */
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

            // Check if job already exists
            try {
                const existingJob = await scheduler.get(jobId);
                if (existingJob) {
                    logger.info("✅ Scheduler job already exists for channel input", {
                        inputId: channelInput.id,
                        jobId,
                        schedule: existingJob.schedule,
                    });
                    return;
                }
            } catch (error: any) {
                // Job doesn't exist, which is expected - continue to create
                if (!error.message?.includes("NOT_FOUND") && error.code !== 5) {
                    throw error;
                }
            }

            // Create the scheduler job
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

        try {
            const scheduler = this.getSchedulerClient();
            const jobId = this.getJobIdForInput(channelInput.id);

            await scheduler.delete(jobId);
            
            logger.info("✅ Deleted Cloud Scheduler job for time trigger", {
                inputId: channelInput.id,
                jobId,
            });
        } catch (error: any) {
            // Ignore NOT_FOUND errors - job may have already been deleted
            if (error.message?.includes("NOT_FOUND") || error.code === 5) {
                logger.info("ℹ️  Scheduler job not found (may have been already deleted)", {
                    inputId: channelInput.id,
                });
                return;
            }
            
            logger.error("❌ Failed to delete Cloud Scheduler job", {
                error,
                inputId: channelInput.id,
            });
            throw error;
        }
    }

    // System integration - no form-based installation
    async processFormSubmission(_req: Request, res: Response): Promise<void> {
        res.status(400).json({ error: "CronJob is a system integration and cannot be installed" });
    }

    /**
     * Generates a unique job ID for a channel input.
     * Format: terse-schedule-{inputId}
     */
    private getJobIdForInput(inputId: string): string {
        // Cloud Scheduler job IDs must match: [a-zA-Z][\-\_a-zA-Z0-9]*
        // UUIDs contain hyphens which are allowed, but we need to start with a letter
        return `terse-schedule-${inputId}`;
    }

    /**
     * Gets the webhook URL that Cloud Scheduler should POST to when the job runs.
     */
    private getWebhookUrl(inputId: string): string {
        const baseUrl = settings.urls.backend;
        return `${baseUrl}/api/webhooks/schedule/${inputId}`;
    }
}
