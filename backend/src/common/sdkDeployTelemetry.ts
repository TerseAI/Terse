import { AnalyticsEvent, SdkDeployLatencyProperties, analytics } from "./analytics"
import { LatencyTelemetry } from "./latencyTelemetry"
import logger from "./logger"
import { extractErrorMessage } from "./strings"

type SdkDeployDurationKey = Extract<
    keyof SdkDeployLatencyProperties,
    | "totalDeployMs"
    | "parseSourceZipMs"
    | "prepareImagesMs"
    | "registerJobsAndTriggersMs"
    | "buildArchiveMs"
    | "resolveRuntimeMs"
    | "packLocalPackagesMs"
    | "defineDeployImageMs"
    | "computeSourceHashMs"
    | "deployImageResolveMs"
    | "deployImageBuildMs"
    | "deployBuildGetAppMs"
    | "deployBuildSandboxReadyMs"
    | "deployBuildExecutorMs"
    | "deployBuildSnapshotMs"
    | "deployBuildExtractZipMs"
>

type SdkDeployTelemetryParams = {
    userId: string
    organizationId: string
    projectId: string
    cliVersion?: string
    viaRemoteServer: boolean
    jobsDeployed: number
}

export class SdkDeployTelemetry extends LatencyTelemetry<SdkDeployDurationKey> {
    private deployId: string | undefined
    private runtime: string | undefined
    private sourceZipBytes: number | undefined
    private jobsAdded: number | undefined
    private jobsRemoved: number | undefined
    private baseImageKind: string | undefined
    private deployImageCacheHit: boolean | undefined

    constructor(private readonly params: SdkDeployTelemetryParams) {
        super()
    }

    setDeployId(deployId: string): void {
        this.deployId = deployId
    }

    setRuntime(runtime: string): void {
        this.runtime = runtime
    }

    setSourceZipBytes(bytes: number): void {
        this.sourceZipBytes = bytes
    }

    setJobCounts(params: { jobsAdded: number; jobsRemoved: number }): void {
        this.jobsAdded = params.jobsAdded
        this.jobsRemoved = params.jobsRemoved
    }

    setBaseImageKind(kind: string): void {
        this.baseImageKind = kind
    }

    setDeployImageCacheHit(hit: boolean): void {
        this.deployImageCacheHit = hit
    }

    capture(success: boolean, error?: unknown): void {
        this.setDuration("totalDeployMs", this.elapsedSinceStartMs())

        const properties: SdkDeployLatencyProperties = {
            organizationId: this.params.organizationId,
            projectId: this.params.projectId,
            deployId: this.deployId,
            cliVersion: this.params.cliVersion,
            viaRemoteServer: this.params.viaRemoteServer,
            jobsDeployed: this.params.jobsDeployed,
            jobsAdded: this.jobsAdded,
            jobsRemoved: this.jobsRemoved,
            sourceZipBytes: this.sourceZipBytes,
            runtime: this.runtime,
            baseImageKind: this.baseImageKind,
            deployImageCacheHit: this.deployImageCacheHit,
            success,
            ...(error ? { errorMessage: extractErrorMessage(error).slice(0, 500) } : {}),
            ...this.durations
        }

        analytics.capture(this.params.userId, AnalyticsEvent.SDK_DEPLOY_LATENCY, properties)
        logger.info("SDK deploy: latency captured", properties)
    }
}
