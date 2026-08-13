import { Prisma, RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"
import AdmZip from "adm-zip"
import crypto from "crypto"

import logger from "../common/logger"
import { SdkDeployTelemetry } from "../common/sdkDeployTelemetry"
import { shellQuote } from "../common/shellEscape"
import { db } from "../loaders/prisma"
import { settings } from "../settings"
import { type LocalPackagesBundle, packLocalSdkPackages } from "../utility/localPackages"

import { type ResolvedSandboxBaseImage, SandboxBaseImageResolver } from "./sandboxBaseImage/SandboxBaseImageResolver"
import { getSandboxProvider } from "./sandboxProvider"
import { SANDBOX_DEFAULT_OPTIONS } from "./sandboxProvider/ModalSandboxService"
import type { Sandbox } from "./sandboxProvider/SandboxService"
import { sdkRuntimeExecutorRegistry } from "./sdkRuntimeExecutors/SdkRuntimeExecutorRegistry"
import {
    type SandboxCommandResult,
    type SdkBuildStep,
    type SdkDeployImageBuildContext,
    type SdkDeployPhase,
    type SdkProjectArchive,
    type SdkProjectRuntime,
    SdkRuntimeExecutor
} from "./sdkRuntimeExecutors/types"
import { deployBuildSandboxUniqueName } from "./sdkSandboxLayerKeys"

const DEFAULT_SOURCE_IMAGE_GRACE_HOURS = 24
const DEFAULT_DEPENDENCY_IMAGE_GRACE_HOURS = 72
const DEFAULT_CLEANUP_BATCH_SIZE = 50

const APT_GET_INSTALL_FLAGS = "apt-get -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::Retries=3 -o DPkg::Lock::Timeout=120"

interface PreparedSdkDeployImage {
    runtime: SdkProjectRuntime
    buildHash: string
    sourceHash: string
    deployImageId: string
}

interface PhaseContext {
    onProgress?: (phase: SdkDeployPhase) => void
    telemetry?: SdkDeployTelemetry
}

interface CleanupSdkSandboxImagesResult {
    deletedSourceImages: number
    deletedDependencyImages: number
    failures: Array<{ kind: "source" | "dependency"; recordId: string; sandboxImageId: string; error: string }>
}

class ZipSdkProjectArchive implements SdkProjectArchive {
    readonly entries: Set<string>

    private readonly entryByPath = new Map<string, ReturnType<AdmZip["getEntries"]>[number]>()

    constructor(zipBuffer: Buffer) {
        const zip = new AdmZip(zipBuffer)

        for (const entry of zip.getEntries()) {
            if (entry.isDirectory) {
                continue
            }

            this.entryByPath.set(normalizeArchivePath(entry.entryName), entry)
        }

        this.entries = new Set(this.entryByPath.keys())
    }

    has(path: string): boolean {
        return this.entryByPath.has(normalizeArchivePath(path))
    }

    readText(path: string): string | null {
        const entry = this.entryByPath.get(normalizeArchivePath(path))
        return entry ? entry.getData().toString("utf-8") : null
    }

    computeSourceHash(): string {
        const hash = crypto.createHash("sha256")

        for (const path of [...this.entryByPath.keys()].sort()) {
            hash.update(path)
            hash.update("\0")
            hash.update(this.entryByPath.get(path)!.getData())
            hash.update("\0")
        }

        return hash.digest("hex")
    }
}

/**
 * Builds the one image a deploy needs: source, installed dependencies, and the built workflow bundle.
 * Runs boot straight from it. Package downloads are cached on a per-organization volume, so a build
 * never shares a mutable surface with another tenant.
 */
export class SdkSandboxImageService {
    private elapsed(startMs: number): string {
        return `${((performance.now() - startMs) / 1000).toFixed(2)}s`
    }

    /**
     * The one path every unit of build work goes through: the user hears about it before it
     * starts, and the telemetry keeps what it cost. Nothing else should time a build step.
     */
    private async runPhase<T>(context: PhaseContext, phase: SdkDeployPhase, work: () => Promise<T>): Promise<T> {
        context.onProgress?.(phase)
        const start = performance.now()
        try {
            return await work()
        } finally {
            context.telemetry?.recordPhase(phase, performance.now() - start)
        }
    }

    async prepareFromSourceZip(params: {
        zipBuffer: Buffer
        organizationId: string
        cliVersion: string
        /** Absent means build one: an older CLI cannot tell us, and a missing bundle breaks durable jobs. */
        requiresWorkflowBundle?: boolean
        onProgress?: (phase: SdkDeployPhase) => void
        telemetry?: SdkDeployTelemetry
    }): Promise<PreparedSdkDeployImage> {
        const { zipBuffer, organizationId, cliVersion, requiresWorkflowBundle, onProgress, telemetry } = params
        const archive = telemetry ? telemetry.measureSync("buildArchiveMs", () => new ZipSdkProjectArchive(zipBuffer)) : new ZipSdkProjectArchive(zipBuffer)
        const executor = telemetry ? telemetry.measureSync("resolveRuntimeMs", () => sdkRuntimeExecutorRegistry.resolve(archive.entries)) : sdkRuntimeExecutorRegistry.resolve(archive.entries)
        telemetry?.setRuntime(executor.runtime)

        // Dev-only: hoist the dev's locally-built SDK/CLI into the sandbox instead of the npm registry.
        const localPackages = settings.devLocalPackages
            ? telemetry
                ? telemetry.measureSync("packLocalPackagesMs", () => packLocalSdkPackages(settings.devLocalPackages!.monorepoRoot))
                : packLocalSdkPackages(settings.devLocalPackages.monorepoRoot)
            : undefined

        const sourceHash = telemetry ? telemetry.measureSync("computeSourceHashMs", () => archive.computeSourceHash()) : archive.computeSourceHash()

        const baseImage = await SandboxBaseImageResolver.getInstance().resolve({
            releaseImageName: executor.releaseImageName,
            genericImage: executor.sandboxImage,
            usesLocalPackages: localPackages !== undefined,
            // The local provider ignores registry images entirely, so a probe would buy nothing.
            registryImagesSupported: getSandboxProvider().supportsContainerizedRunners
        })
        telemetry?.setBaseImageKind(baseImage.kind)
        logger.info("SDK image build: base image resolved", { kind: baseImage.kind, reference: baseImage.reference })

        const defineParams = { archive, organizationId, sourceHash, cliVersion, baseImage, localPackages }
        const buildHash = (telemetry ? telemetry.measureSync("defineDeployImageMs", () => executor.defineDeployImage(defineParams)) : executor.defineDeployImage(defineParams)).buildHash

        onProgress?.("preparing")
        const ensureParams = { archive, organizationId, buildHash, sourceHash, executor, cliVersion, baseImage, localPackages, zipBuffer, onProgress, requiresWorkflowBundle }
        const deployImage = await (telemetry ? telemetry.measure("deployImageResolveMs", () => this.ensureDeployImage({ ...ensureParams, telemetry })) : this.ensureDeployImage(ensureParams))

        return {
            runtime: executor.runtime,
            buildHash,
            sourceHash,
            deployImageId: deployImage.id
        }
    }

    async cleanupUnusedImages(params?: { sourceImageGraceHours?: number; dependencyImageGraceHours?: number; batchSize?: number }): Promise<CleanupSdkSandboxImagesResult> {
        const sourceImageGraceHours = params?.sourceImageGraceHours ?? DEFAULT_SOURCE_IMAGE_GRACE_HOURS
        const dependencyImageGraceHours = params?.dependencyImageGraceHours ?? DEFAULT_DEPENDENCY_IMAGE_GRACE_HOURS
        const batchSize = params?.batchSize ?? DEFAULT_CLEANUP_BATCH_SIZE

        const prisma = db()
        const failures: CleanupSdkSandboxImagesResult["failures"] = []

        const staleDeployImages = await prisma.sdk_source_images.findMany({
            where: {
                deploys: { none: {} },
                last_used_at: { lt: new Date(Date.now() - sourceImageGraceHours * 60 * 60 * 1000) }
            },
            orderBy: { last_used_at: "asc" },
            take: batchSize
        })

        let deletedSourceImages = 0
        for (const deployImage of staleDeployImages) {
            const failure = await this.deleteImageRecord(() => prisma.sdk_source_images.delete({ where: { id: deployImage.id } }), deployImage.image_id, "source", deployImage.id)
            failure ? failures.push(failure) : deletedSourceImages++
        }

        // Retired layer: nothing writes sdk_dependency_images any more, this drains what is left.
        const retiredDependencyImages = await prisma.sdk_dependency_images.findMany({
            where: { last_used_at: { lt: new Date(Date.now() - dependencyImageGraceHours * 60 * 60 * 1000) } },
            orderBy: { last_used_at: "asc" },
            take: batchSize
        })

        let deletedDependencyImages = 0
        for (const dependencyImage of retiredDependencyImages) {
            const failure = await this.deleteImageRecord(() => prisma.sdk_dependency_images.delete({ where: { id: dependencyImage.id } }), dependencyImage.image_id, "dependency", dependencyImage.id)
            failure ? failures.push(failure) : deletedDependencyImages++
        }

        return { deletedSourceImages, deletedDependencyImages, failures }
    }

    private async deleteImageRecord(
        deleteRow: () => Promise<unknown>,
        sandboxImageId: string,
        kind: "source" | "dependency",
        recordId: string
    ): Promise<CleanupSdkSandboxImagesResult["failures"][number] | undefined> {
        try {
            await this.deleteImage(sandboxImageId)
            await deleteRow()
            return undefined
        } catch (error) {
            return { kind, recordId, sandboxImageId, error: extractError(error) }
        }
    }

    private async ensureDeployImage(params: {
        archive: SdkProjectArchive
        organizationId: string
        buildHash: string
        sourceHash: string
        executor: SdkRuntimeExecutor
        cliVersion: string
        baseImage: ResolvedSandboxBaseImage
        localPackages?: LocalPackagesBundle
        requiresWorkflowBundle?: boolean
        zipBuffer: Buffer
        onProgress?: (phase: SdkDeployPhase) => void
        telemetry?: SdkDeployTelemetry
    }) {
        const { organizationId, buildHash, sourceHash, executor, cliVersion, baseImage, zipBuffer, telemetry } = params
        const prisma = db()
        const sandboxService = getSandboxProvider()
        const identity = { organization_id: organizationId, build_hash: buildHash }

        const existing = await prisma.sdk_source_images.findUnique({ where: { organization_id_build_hash: identity } })
        const existingImageExists = existing ? await sandboxService.imageExists(existing.image_id) : false
        if (existing && existingImageExists) {
            telemetry?.setDeployImageCacheHit(true)
            params.onProgress?.("reusing_cached_build")
            logger.info("SDK image cache: reuse deploy image", { buildHash, organizationId, imageId: existing.image_id })
            return prisma.sdk_source_images.update({ where: { id: existing.id }, data: { last_used_at: new Date() } })
        }
        telemetry?.setDeployImageCacheHit(false)

        if (existing) {
            logger.warn("SDK image cache: deploy image missing, rebuilding", { buildHash, organizationId, imageId: existing.image_id })
            await prisma.sdk_source_images.delete({ where: { id: existing.id } }).catch(() => {})
        }

        const buildStarted = performance.now()
        const sandboxImageId = await (telemetry ? telemetry.measure("deployImageBuildMs", () => this.buildDeployImage({ ...params, telemetry })) : this.buildDeployImage(params))

        try {
            const created = await prisma.sdk_source_images.create({
                data: {
                    organization_id: organizationId,
                    runtime: executor.runtime,
                    build_hash: buildHash,
                    source_hash: sourceHash,
                    cli_version: cliVersion,
                    base_image_tag: baseImage.reference,
                    image_id: sandboxImageId
                }
            })
            logger.info("SDK image cache: new deploy image", { buildHash, organizationId, imageId: created.image_id, duration: this.elapsed(buildStarted) })
            return created
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                // A concurrent deploy of the same build won the race; drop ours and take theirs.
                await this.deleteImage(sandboxImageId).catch(() => {})
                const row = await prisma.sdk_source_images.update({ where: { organization_id_build_hash: identity }, data: { last_used_at: new Date() } })
                logger.info("SDK image cache: reuse deploy image", { buildHash, organizationId, imageId: row.image_id, concurrent: true })
                return row
            }

            throw error
        }
    }

    private async buildDeployImage(params: {
        archive: SdkProjectArchive
        organizationId: string
        buildHash: string
        executor: SdkRuntimeExecutor
        cliVersion: string
        baseImage: ResolvedSandboxBaseImage
        localPackages?: LocalPackagesBundle
        requiresWorkflowBundle?: boolean
        zipBuffer: Buffer
        onProgress?: (phase: SdkDeployPhase) => void
        telemetry?: SdkDeployTelemetry
    }): Promise<string> {
        const { archive, organizationId, buildHash, executor, cliVersion, baseImage, localPackages, requiresWorkflowBundle, zipBuffer, onProgress, telemetry } = params
        const sandboxService = getSandboxProvider()
        const phaseContext: PhaseContext = { onProgress, telemetry }
        const sandboxBaseImage = sandboxService.getImageFromRegistry(baseImage.reference)

        const sb = await this.runPhase(phaseContext, "starting_sandbox", async () => {
            const app = await sandboxService.getOrCreateApp("terse-sdk-image-builder")
            return sandboxService.getOrCreateSandbox(app, sandboxBaseImage, deployBuildSandboxUniqueName(buildHash), { ...SANDBOX_DEFAULT_OPTIONS, timeoutMs: 30 * 60 * 1000 })
        })

        try {
            await this.runPhase(phaseContext, "unpacking_source", () => this.extractSourceZip({ sb, sandboxService, executor, zipBuffer }))

            const buildContext = this.buildContext({ sb, sandboxService, archive, executor, cliVersion, baseImage, localPackages, requiresWorkflowBundle, phaseContext })
            await executor.buildDeployImage(buildContext)

            const image = await this.runPhase(phaseContext, "saving_image", () => sb.snapshotFilesystem())
            return image.imageId
        } finally {
            await this.terminateBuildSandbox(sb, "deploy image build", executor.runtime)
        }
    }

    private buildContext(params: {
        sb: Sandbox
        sandboxService: ReturnType<typeof getSandboxProvider>
        archive: SdkProjectArchive
        executor: SdkRuntimeExecutor
        cliVersion: string
        baseImage: ResolvedSandboxBaseImage
        localPackages?: LocalPackagesBundle
        requiresWorkflowBundle?: boolean
        phaseContext: PhaseContext
    }): SdkDeployImageBuildContext {
        const { sb, sandboxService, archive, executor, cliVersion, baseImage, localPackages, requiresWorkflowBundle, phaseContext } = params

        return {
            sb,
            archive,
            cliVersion,
            baseImage,
            requiresWorkflowBundle: requiresWorkflowBundle ?? true,
            projectDir: sandboxService.getProjectPath(sb),
            cliCachePath: sandboxService.getCliCachePath(sb),
            localPackages,
            ensureSandboxCommand: async (step, command) => {
                await this.runPhase(phaseContext, step, () => this.ensureSandboxCommand(sb, step, command, executor.runtime))
            },
            writeFile: async (path, content) => {
                await this.writeFileToSandbox(sb, path, content)
            },
            writeBinaryFile: async (path, content) => {
                await this.writeBinaryToSandbox(sb, path, content)
            },
            escapeShellArg: shellQuote
        }
    }

    private async extractSourceZip(params: { sb: Sandbox; sandboxService: ReturnType<typeof getSandboxProvider>; executor: SdkRuntimeExecutor; zipBuffer: Buffer }): Promise<void> {
        const { sb, sandboxService, executor, zipBuffer } = params
        const projectDir = sandboxService.getProjectPath(sb)
        const sourceZipPath = sandboxService.getScratchPath(sb, "source-image-code.zip")

        await this.writeBinaryToSandbox(sb, sourceZipPath, zipBuffer)

        const ensureUnzip = `(command -v unzip >/dev/null || (export DEBIAN_FRONTEND=noninteractive && ${APT_GET_INSTALL_FLAGS} update -qq && ${APT_GET_INSTALL_FLAGS} install -y -qq unzip >/dev/null))`
        await this.ensureSandboxCommand(
            sb,
            "unpacking_source",
            `mkdir -p ${shellQuote(projectDir)} && find ${shellQuote(projectDir)} -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} + && ${ensureUnzip} && unzip -qq -o ${shellQuote(sourceZipPath)} -d ${shellQuote(projectDir)}`,
            executor.runtime
        )
    }

    private async deleteImage(imageId: string): Promise<void> {
        const sandboxService = getSandboxProvider()
        await sandboxService.deleteImage(imageId)
    }

    private async writeFileToSandbox(sb: Sandbox, path: string, content: string): Promise<void> {
        const fileHandle = await sb.open(path, "w")
        await fileHandle.write(new TextEncoder().encode(content))
        await fileHandle.close()
    }

    private async writeBinaryToSandbox(sb: Sandbox, path: string, content: Buffer): Promise<void> {
        const fileHandle = await sb.open(path, "w")
        await fileHandle.write(new Uint8Array(content))
        await fileHandle.close()
    }

    private async ensureSandboxCommand(sb: Sandbox, step: SdkBuildStep | "unpacking_source", command: string, runtime: SdkProjectRuntime): Promise<void> {
        const label = step.replace(/_/g, " ")
        let result: SandboxCommandResult
        try {
            result = await this.runSandboxCommand(sb, command)
        } catch (error) {
            await this.terminateSandboxAfterFailure(sb, label, runtime, error)
            throw error
        }

        if (result.exitCode !== 0) {
            const failureMessage = this.buildFailureMessage(result)
            await this.terminateSandboxAfterFailure(sb, label, runtime, failureMessage)
            throw new Error(`${label} failed for ${runtime}: ${failureMessage}`)
        }

        this.logStepOutcome(step, result)
    }

    /**
     * A package manager says exactly what it did ("reused 452, downloaded 0", "Already up to date"),
     * and without it a slow install is indistinguishable from a cold cache. Discarding that on
     * success cost this several rounds of guessing, so the summary lines are kept.
     */
    private logStepOutcome(step: SdkBuildStep | "unpacking_source", result: SandboxCommandResult): void {
        if (step !== "install_dependencies") return

        const summary = result.stdout
            .split("\n")
            .map(line => line.trim())
            .filter(line => /^(Progress:|Packages:|Already up to date|added |up to date)/.test(line))
            .slice(-2)

        logger.info("SDK image build: dependencies installed", { summary: summary.length > 0 ? summary : result.stdout.trim().split("\n").slice(-1) })
    }

    private async terminateBuildSandbox(sb: Sandbox, label: string, runtime: SdkProjectRuntime): Promise<void> {
        try {
            await sb.terminate()
            logger.info("SDK image build: terminated build sandbox", { label, runtime, sandboxId: sb.sandboxId })
        } catch (error) {
            logger.warn("SDK image build: terminate build sandbox failed", {
                label,
                runtime,
                sandboxId: sb.sandboxId,
                errorMessage: error instanceof Error ? error.message : String(error)
            })
        }
    }

    // Terminate the build sandbox so the next deploy starts from a clean image rather than reusing
    // a poisoned filesystem (e.g. held apt locks, partial extraction, half-installed packages).
    private async terminateSandboxAfterFailure(sb: Sandbox, label: string, runtime: SdkProjectRuntime, reason: unknown): Promise<void> {
        try {
            await sb.terminate()
            logger.warn("SDK image build: terminated sandbox after failure", {
                label,
                runtime,
                sandboxId: sb.sandboxId,
                reason: reason instanceof Error ? reason.message : String(reason).slice(0, 200)
            })
        } catch (terminateError) {
            logger.warn("SDK image build: terminate after failure failed", {
                label,
                runtime,
                sandboxId: sb.sandboxId,
                errorMessage: terminateError instanceof Error ? terminateError.message : String(terminateError)
            })
        }
    }

    private async runSandboxCommand(sb: Sandbox, command: string): Promise<SandboxCommandResult> {
        const proc = await sb.exec(["sh", "-c", command], {
            stdout: "pipe",
            stderr: "pipe"
        })

        const [stdout, stderr] = await Promise.all([proc.stdout.readText(), proc.stderr.readText()])
        const exitCode = await proc.wait()
        return { exitCode, stdout, stderr }
    }

    private buildFailureMessage(result: SandboxCommandResult): string {
        const stderr = result.stderr.trim()
        if (stderr.length > 0) {
            return stderr.slice(0, 500)
        }

        const stdout = result.stdout.trim()
        if (stdout.length > 0) {
            return stdout.slice(0, 500)
        }

        return `Process exited with code ${result.exitCode}`
    }
}

function normalizeArchivePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/^\/+/, "")
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function extractError(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
