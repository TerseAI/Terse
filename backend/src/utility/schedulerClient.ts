import { CloudSchedulerClient } from "@google-cloud/scheduler"
import type { protos } from "@google-cloud/scheduler"

import { cloudScheduler, gcp } from "../config/settings"
import logger from "../logger"

type Job = protos.google.cloud.scheduler.v1.IJob
type CreateJobRequest = protos.google.cloud.scheduler.v1.ICreateJobRequest
type GetJobRequest = protos.google.cloud.scheduler.v1.IGetJobRequest
type ListJobsRequest = protos.google.cloud.scheduler.v1.IListJobsRequest
type ListJobsResponse = protos.google.cloud.scheduler.v1.IListJobsResponse
type DeleteJobRequest = protos.google.cloud.scheduler.v1.IDeleteJobRequest
type PauseJobRequest = protos.google.cloud.scheduler.v1.IPauseJobRequest
type ResumeJobRequest = protos.google.cloud.scheduler.v1.IResumeJobRequest
type RunJobRequest = protos.google.cloud.scheduler.v1.IRunJobRequest

export enum ScheduledJobState {
    ENABLED = "ENABLED",
    PAUSED = "PAUSED",
    DISABLED = "DISABLED",
    UPDATE_FAILED = "UPDATE_FAILED",
    STATE_UNSPECIFIED = "STATE_UNSPECIFIED"
}

export interface ScheduledJob {
    id: string
    schedule: string
    url: string
    state: ScheduledJobState
}

export class SchedulerClient {
    private client: CloudSchedulerClient
    private projectId: string
    private location: string

    constructor() {
        try {
            const serviceAccountBase64 = gcp.serviceAccountBase64

            if (!serviceAccountBase64) {
                throw new Error("GCP_SERVICE_ACCOUNT_BASE64 environment variable is required to initialize Scheduler client")
            }

            const projectId = gcp.projectId
            if (!projectId) {
                throw new Error("GCP_PROJECT_ID environment variable is required to initialize Scheduler client")
            }

            const location = gcp.region || "us-central1"

            // Decode the base64 service account
            const serviceAccountJson = Buffer.from(serviceAccountBase64, "base64").toString("utf-8")
            const credentials = JSON.parse(serviceAccountJson)

            // Initialize the Cloud Scheduler client with credentials
            this.client = new CloudSchedulerClient({
                credentials: credentials
            })

            this.projectId = projectId
            this.location = location

            logger.info("Scheduler client initialized", { projectId, location })
        } catch (error) {
            logger.error("Failed to initialize Scheduler client", { error })
            throw new Error(`Failed to initialize Scheduler client: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
    }

    private getParentPath(): string {
        return `projects/${this.projectId}/locations/${this.location}`
    }

    private getJobPath(jobId: string): string {
        return `${this.getParentPath()}/jobs/${jobId}`
    }

    private extractJobId(jobPath: string | null | undefined): string {
        if (!jobPath) {
            throw new Error("Job path is required")
        }
        const parts = jobPath.split("/")
        return parts[parts.length - 1] || jobPath
    }

    private transformJob(job: Job): ScheduledJob {
        const jobId = this.extractJobId(job.name)
        const url = job.httpTarget?.uri || ""
        const schedule = job.schedule || ""

        // Map the state enum to our ScheduledJobState enum
        let state: ScheduledJobState = ScheduledJobState.STATE_UNSPECIFIED
        if (job.state === 1 || job.state === "ENABLED") {
            state = ScheduledJobState.ENABLED
        } else if (job.state === 2 || job.state === "PAUSED") {
            state = ScheduledJobState.PAUSED
        } else if (job.state === 3 || job.state === "DISABLED") {
            state = ScheduledJobState.DISABLED
        } else if (job.state === 4 || job.state === "UPDATE_FAILED") {
            state = ScheduledJobState.UPDATE_FAILED
        }

        return {
            id: jobId,
            schedule,
            url,
            state
        }
    }

    async create(jobId: string, schedule: string, url: string): Promise<ScheduledJob> {
        try {
            const job: Job = {
                name: this.getJobPath(jobId),
                schedule,
                timeZone: "UTC",
                httpTarget: {
                    uri: url,
                    httpMethod: "POST",
                    headers: {
                        Authorization: `Bearer ${cloudScheduler.secret}`,
                        "Content-Type": "application/json"
                    }
                }
            }

            const request: CreateJobRequest = {
                parent: this.getParentPath(),
                job: job
            }

            const [response] = await this.client.createJob(request)
            logger.info("Scheduler job created", { jobId, jobName: response.name })
            return this.transformJob(response)
        } catch (error) {
            logger.error("Failed to create scheduler job", { error, jobId })
            throw error
        }
    }

    async list(pageSize?: number, pageToken?: string): Promise<{ jobs: ScheduledJob[]; nextPageToken?: string }> {
        try {
            const request: ListJobsRequest = {
                parent: this.getParentPath(),
                pageSize: pageSize || 500,
                pageToken: pageToken
            }

            const [jobs, , listResponse] = await this.client.listJobs(request)
            logger.debug("Scheduler jobs listed", { count: jobs?.length || 0 })

            const transformedJobs = (jobs || []).map(job => this.transformJob(job))

            return {
                jobs: transformedJobs,
                nextPageToken: listResponse?.nextPageToken || undefined
            }
        } catch (error) {
            logger.error("Failed to list scheduler jobs", { error })
            throw error
        }
    }

    async get(jobId: string): Promise<ScheduledJob | undefined> {
        try {
            const request: GetJobRequest = {
                name: this.getJobPath(jobId)
            }

            const [response] = await this.client.getJob(request)
            logger.debug("Scheduler job retrieved", { jobId })
            return response ? this.transformJob(response) : undefined
        } catch (error) {
            logger.error("Unable to get scheduler job", { jobId })
            return undefined
        }
    }

    async delete(jobId: string): Promise<void> {
        try {
            const request: DeleteJobRequest = {
                name: this.getJobPath(jobId)
            }

            await this.client.deleteJob(request)
            logger.info("Scheduler job deleted", { jobId })
        } catch (error) {
            logger.error("Failed to delete scheduler job", { error, jobId })
            throw error
        }
    }

    async pause(jobId: string): Promise<ScheduledJob> {
        try {
            const request: PauseJobRequest = {
                name: this.getJobPath(jobId)
            }

            const [response] = await this.client.pauseJob(request)
            logger.info("Scheduler job paused", { jobId })
            return this.transformJob(response)
        } catch (error) {
            logger.error("Failed to pause scheduler job", { error, jobId })
            throw error
        }
    }

    async resume(jobId: string): Promise<ScheduledJob> {
        try {
            const request: ResumeJobRequest = {
                name: this.getJobPath(jobId)
            }

            const [response] = await this.client.resumeJob(request)
            logger.info("Scheduler job resumed", { jobId })
            return this.transformJob(response)
        } catch (error) {
            logger.error("Failed to resume scheduler job", { error, jobId })
            throw error
        }
    }

    async run(jobId: string): Promise<ScheduledJob> {
        try {
            const request: RunJobRequest = {
                name: this.getJobPath(jobId)
            }

            const [response] = await this.client.runJob(request)
            logger.info("Scheduler job triggered manually", { jobId })
            return this.transformJob(response)
        } catch (error) {
            logger.error("Failed to run scheduler job", { error, jobId })
            throw error
        }
    }
}

export function createSchedulerClient(): SchedulerClient {
    return new SchedulerClient()
}
