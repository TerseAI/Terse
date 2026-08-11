import { Prisma, RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"
import AdmZip from "adm-zip"
import crypto from "crypto"

import logger from "../common/logger"
import { SdkDeployTelemetry } from "../common/sdkDeployTelemetry"
import { shellQuote } from "../common/shellEscape"
import { db } from "../loaders/prisma"
import { settings } from "../settings"
import { type LocalPackagesBundle, packLocalSdkPackages } from "../utility/localPackages"

import { getSandboxProvider } from "./sandboxProvider"
import { SANDBOX_DEFAULT_OPTIONS } from "./sandboxProvider/ModalSandboxService"
import type { Sandbox } from "./sandboxProvider/SandboxService"
import { sdkRuntimeExecutorRegistry } from "./sdkRuntimeExecutors/SdkRuntimeExecutorRegistry"
import { type SandboxCommandResult, type SdkDependencyImageBuildContext, type SdkProjectArchive, type SdkProjectRuntime, SdkRuntimeExecutor } from "./sdkRuntimeExecutors/types"
import { computeSourceLayerKey, dependencyBuildSandboxUniqueName, sourceImageBuildSandboxUniqueName } from "./sdkSandboxLayerKeys"

const DEFAULT_SOURCE_IMAGE_GRACE_HOURS = 24
const DEFAULT_DEPENDENCY_IMAGE_GRACE_HOURS = 72
const DEFAULT_CLEANUP_BATCH_SIZE = 50

const APT_GET_INSTALL_FLAGS = "apt-get -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::Retries=3 -o DPkg::Lock::Timeout=120"

interface PreparedSdkSandboxImages {
    runtime: SdkProjectRuntime
    dependencyHash: string
    dependencyImageId: string
    sourceHash: string
    sourceImageId: string
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

export class SdkSandboxImageService {
    private elapsed(startMs: number): string {
        return `${((performance.now() - startMs) / 1000).toFixed(2)}s`
    }

    async prepareFromSourceZip(params: {
        zipBuffer: Buffer
        organizationId: string
        cliVersion: string
        onProgress?: (phase: "dependency_image" | "source_image") => void
        telemetry?: SdkDeployTelemetry
    }): Promise<PreparedSdkSandboxImages> {
        const { zipBuffer, organizationId, cliVersion, onProgress, telemetry } = params
        const archive = telemetry ? telemetry.measureSync("buildArchiveMs", () => new ZipSdkProjectArchive(zipBuffer)) : new ZipSdkProjectArchive(zipBuffer)
        const executor = telemetry ? telemetry.measureSync("resolveRuntimeMs", () => sdkRuntimeExecutorRegistry.resolve(archive.entries)) : sdkRuntimeExecutorRegistry.resolve(archive.entries)
        telemetry?.setRuntime(executor.runtime)

        // Dev-only: hoist the dev's locally-built SDK/CLI into the sandbox instead of the npm registry.
        const localPackages = settings.devLocalPackages
            ? telemetry
                ? telemetry.measureSync("packLocalPackagesMs", () => packLocalSdkPackages(settings.devLocalPackages!.monorepoRoot))
                : packLocalSdkPackages(settings.devLocalPackages.monorepoRoot)
            : undefined

        const dependencyHash = (
            telemetry
                ? telemetry.measureSync("defineDependencyImageMs", () => executor.defineDependencyImage(archive, cliVersion, localPackages))
                : executor.defineDependencyImage(archive, cliVersion, localPackages)
        ).dependencyHash
        const sourceHash = telemetry ? telemetry.measureSync("computeSourceHashMs", () => archive.computeSourceHash()) : archive.computeSourceHash()

        onProgress?.("dependency_image")
        const dependencyImage = await (telemetry
            ? telemetry.measure("dependencyImageResolveMs", () =>
                  this.ensureDependencyImage({
                      archive,
                      dependencyHash,
                      executor,
                      cliVersion,
                      localPackages,
                      telemetry
                  })
              )
            : this.ensureDependencyImage({
                  archive,
                  dependencyHash,
                  executor,
                  cliVersion,
                  localPackages
              }))

        const sourceLayerKey = computeSourceLayerKey({ organizationId, dependencyHash, sourceHash })

        onProgress?.("source_image")
        const sourceImage = await (telemetry
            ? telemetry.measure("sourceImageResolveMs", () =>
                  this.ensureSourceImage({
                      dependencyImageId: dependencyImage.id,
                      dependencySandboxImageId: dependencyImage.image_id,
                      executor,
                      organizationId,
                      sourceHash,
                      sourceLayerKey,
                      zipBuffer,
                      telemetry
                  })
              )
            : this.ensureSourceImage({
                  dependencyImageId: dependencyImage.id,
                  dependencySandboxImageId: dependencyImage.image_id,
                  executor,
                  organizationId,
                  sourceHash,
                  sourceLayerKey,
                  zipBuffer
              }))

        return {
            runtime: executor.runtime,
            dependencyHash,
            dependencyImageId: dependencyImage.id,
            sourceHash,
            sourceImageId: sourceImage.id
        }
    }

    async cleanupUnusedImages(params?: { sourceImageGraceHours?: number; dependencyImageGraceHours?: number; batchSize?: number }): Promise<CleanupSdkSandboxImagesResult> {
        const sourceImageGraceHours = params?.sourceImageGraceHours ?? DEFAULT_SOURCE_IMAGE_GRACE_HOURS
        const dependencyImageGraceHours = params?.dependencyImageGraceHours ?? DEFAULT_DEPENDENCY_IMAGE_GRACE_HOURS
        const batchSize = params?.batchSize ?? DEFAULT_CLEANUP_BATCH_SIZE

        const sourceCutoff = new Date(Date.now() - sourceImageGraceHours * 60 * 60 * 1000)
        const dependencyCutoff = new Date(Date.now() - dependencyImageGraceHours * 60 * 60 * 1000)

        const prisma = db()
        const failures: CleanupSdkSandboxImagesResult["failures"] = []

        const staleSourceImages = await prisma.sdk_source_images.findMany({
            where: {
                deploys: { none: {} },
                last_used_at: { lt: sourceCutoff }
            },
            orderBy: { last_used_at: "asc" },
            take: batchSize
        })

        let deletedSourceImages = 0
        for (const sourceImage of staleSourceImages) {
            try {
                await this.deleteImage(sourceImage.image_id)
                await prisma.sdk_source_images.delete({ where: { id: sourceImage.id } })
                deletedSourceImages++
            } catch (error) {
                failures.push({
                    kind: "source",
                    recordId: sourceImage.id,
                    sandboxImageId: sourceImage.image_id,
                    error: extractError(error)
                })
            }
        }

        const staleDependencyImages = await prisma.sdk_dependency_images.findMany({
            where: {
                source_images: { none: {} },
                last_used_at: { lt: dependencyCutoff }
            },
            orderBy: { last_used_at: "asc" },
            take: batchSize
        })

        let deletedDependencyImages = 0
        for (const dependencyImage of staleDependencyImages) {
            try {
                await this.deleteImage(dependencyImage.image_id)
                await prisma.sdk_dependency_images.delete({ where: { id: dependencyImage.id } })
                deletedDependencyImages++
            } catch (error) {
                failures.push({
                    kind: "dependency",
                    recordId: dependencyImage.id,
                    sandboxImageId: dependencyImage.image_id,
                    error: extractError(error)
                })
            }
        }

        return {
            deletedSourceImages,
            deletedDependencyImages,
            failures
        }
    }

    private async ensureDependencyImage(params: {
        archive: SdkProjectArchive
        dependencyHash: string
        executor: SdkRuntimeExecutor
        cliVersion: string
        localPackages?: LocalPackagesBundle
        telemetry?: SdkDeployTelemetry
    }) {
        const { archive, dependencyHash, executor, cliVersion, localPackages, telemetry } = params
        const prisma = db()
        const sandboxService = getSandboxProvider()

        const existing = await prisma.sdk_dependency_images.findUnique({
            where: { dependency_hash: dependencyHash }
        })

        const existingImageExists = existing ? await sandboxService.imageExists(existing.image_id) : false
        if (existing && existingImageExists) {
            telemetry?.setDependencyImageCacheHit(true)
            logger.info("SDK image cache: reuse dependency layer", {
                dependencyHash: dependencyHash,
                imageId: existing.image_id
            })
            return prisma.sdk_dependency_images.update({
                where: { id: existing.id },
                data: { last_used_at: new Date() }
            })
        }
        telemetry?.setDependencyImageCacheHit(false)

        if (existing) {
            logger.warn("SDK image cache: dependency image missing, rebuilding", {
                dependencyHash: dependencyHash,
                imageId: existing.image_id
            })
            await prisma.sdk_dependency_images.delete({ where: { id: existing.id } }).catch(() => {})
        }

        const buildStarted = performance.now()
        const sandboxImageId = await (telemetry
            ? telemetry.measure("dependencyImageBuildMs", () => this.buildDependencyImage(archive, executor, dependencyHash, cliVersion, localPackages, telemetry))
            : this.buildDependencyImage(archive, executor, dependencyHash, cliVersion, localPackages))

        try {
            const row = await prisma.sdk_dependency_images.create({
                data: {
                    dependency_hash: dependencyHash,
                    runtime: executor.runtime,
                    base_image_tag: executor.sandboxImage,
                    cli_version: cliVersion,
                    image_id: sandboxImageId
                }
            })
            logger.info("SDK image cache: new dependency layer", {
                dependencyHash: dependencyHash,
                imageId: row.image_id,
                duration: this.elapsed(buildStarted)
            })
            return row
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                await this.deleteImage(sandboxImageId).catch(() => {})
                const row = await prisma.sdk_dependency_images.update({
                    where: { dependency_hash: dependencyHash },
                    data: { last_used_at: new Date() }
                })
                logger.info("SDK image cache: reuse dependency layer", {
                    dependencyHash: dependencyHash,
                    imageId: row.image_id,
                    concurrent: true
                })
                return row
            }

            throw error
        }
    }

    private async ensureSourceImage(params: {
        dependencyImageId: string
        dependencySandboxImageId: string
        executor: ReturnType<typeof sdkRuntimeExecutorRegistry.resolve>
        organizationId: string
        sourceHash: string
        sourceLayerKey: string
        zipBuffer: Buffer
        telemetry?: SdkDeployTelemetry
    }) {
        const { dependencyImageId, dependencySandboxImageId, executor, organizationId, sourceHash, sourceLayerKey, zipBuffer, telemetry } = params
        const prisma = db()
        const sandboxService = getSandboxProvider()

        const existing = await prisma.sdk_source_images.findFirst({
            where: {
                organization_id: organizationId,
                dependency_image_id: dependencyImageId,
                source_hash: sourceHash
            }
        })

        const existingImageExists = existing ? await sandboxService.imageExists(existing.image_id) : false
        if (existing && existingImageExists) {
            telemetry?.setSourceImageCacheHit(true)
            logger.info("SDK image cache: reuse source layer", {
                sourceLayerKey: sourceLayerKey,
                organizationId: organizationId,
                imageId: existing.image_id
            })
            return prisma.sdk_source_images.update({
                where: { id: existing.id },
                data: { last_used_at: new Date() }
            })
        }
        telemetry?.setSourceImageCacheHit(false)

        if (existing) {
            logger.warn("SDK image cache: source image missing, rebuilding", {
                sourceLayerKey,
                organizationId,
                imageId: existing.image_id
            })
            await prisma.sdk_source_images.delete({ where: { id: existing.id } }).catch(() => {})
        }

        const buildStarted = performance.now()
        const sandboxImageId = await (telemetry
            ? telemetry.measure("sourceImageBuildMs", () =>
                  this.buildSourceImage({
                      dependencySandboxImageId,
                      executor,
                      sourceLayerKey,
                      zipBuffer,
                      telemetry
                  })
              )
            : this.buildSourceImage({
                  dependencySandboxImageId,
                  executor,
                  sourceLayerKey,
                  zipBuffer
              }))

        try {
            const created = await prisma.sdk_source_images.create({
                data: {
                    organization_id: organizationId,
                    runtime: executor.runtime,
                    source_hash: sourceHash,
                    image_id: sandboxImageId,
                    dependency_image_id: dependencyImageId
                }
            })
            logger.info("SDK image cache: new source layer", {
                sourceLayerKey: sourceLayerKey,
                organizationId: organizationId,
                imageId: created.image_id,
                duration: this.elapsed(buildStarted)
            })
            return created
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                await this.deleteImage(sandboxImageId).catch(() => {})
                const row = await prisma.sdk_source_images.update({
                    where: {
                        organization_id_dependency_image_id_source_hash: {
                            organization_id: organizationId,
                            dependency_image_id: dependencyImageId,
                            source_hash: sourceHash
                        }
                    },
                    data: { last_used_at: new Date() }
                })
                logger.info("SDK image cache: reuse source layer", {
                    sourceLayerKey: sourceLayerKey,
                    organizationId: organizationId,
                    imageId: row.image_id,
                    concurrent: true
                })
                return row
            }

            throw error
        }
    }

    private async buildDependencyImage(
        archive: SdkProjectArchive,
        executor: SdkRuntimeExecutor,
        dependencyHash: string,
        cliVersion: string,
        localPackages?: LocalPackagesBundle,
        telemetry?: SdkDeployTelemetry
    ): Promise<string> {
        const sandboxService = getSandboxProvider()
        const app = await (telemetry
            ? telemetry.measure("dependencyBuildGetAppMs", () => sandboxService.getOrCreateApp("terse-sdk-image-builder"))
            : sandboxService.getOrCreateApp("terse-sdk-image-builder"))

        const baseImage = sandboxService.getImageFromRegistry(executor.sandboxImage)
        const uniqueName = dependencyBuildSandboxUniqueName(dependencyHash)
        const sb = await (telemetry
            ? telemetry.measure("dependencyBuildSandboxReadyMs", () => sandboxService.getOrCreateSandbox(app, baseImage, uniqueName, SANDBOX_DEFAULT_OPTIONS))
            : sandboxService.getOrCreateSandbox(app, baseImage, uniqueName, SANDBOX_DEFAULT_OPTIONS))

        const buildContext: SdkDependencyImageBuildContext = {
            sb,
            archive,
            cliVersion,
            localPackages,
            templateDir: sandboxService.getDependencyCachePath(sb, executor.runtime),
            cliCachePath: sandboxService.getCliCachePath(sb),
            ensureSandboxCommand: async (label, command) => {
                await this.ensureSandboxCommand(sb, label, command, executor.runtime)
            },
            writeFile: async (path, content) => {
                await this.writeFileToSandbox(sb, path, content)
            },
            writeBinaryFile: async (path, content) => {
                await this.writeBinaryToSandbox(sb, path, content)
            },
            escapeShellArg: shellQuote
        }

        try {
            await (telemetry ? telemetry.measure("dependencyBuildExecutorMs", () => executor.buildDependencyImage(buildContext)) : executor.buildDependencyImage(buildContext))
            const image = await (telemetry ? telemetry.measure("dependencyBuildSnapshotMs", () => sb.snapshotFilesystem()) : sb.snapshotFilesystem())

            return image.imageId
        } finally {
            await this.terminateBuildSandbox(sb, "dependency image build", executor.runtime)
        }
    }

    private async buildSourceImage(params: {
        dependencySandboxImageId: string
        executor: ReturnType<typeof sdkRuntimeExecutorRegistry.resolve>
        sourceLayerKey: string
        zipBuffer: Buffer
        telemetry?: SdkDeployTelemetry
    }): Promise<string> {
        const { dependencySandboxImageId, executor, sourceLayerKey, zipBuffer, telemetry } = params
        const sandboxService = getSandboxProvider()
        const app = await (telemetry
            ? telemetry.measure("sourceBuildGetAppMs", () => sandboxService.getOrCreateApp("terse-sdk-image-builder"))
            : sandboxService.getOrCreateApp("terse-sdk-image-builder"))
        const dependencyImage = await (telemetry
            ? telemetry.measure("sourceBuildLoadDependencyImageMs", () => sandboxService.getImageFromId(dependencySandboxImageId))
            : sandboxService.getImageFromId(dependencySandboxImageId))
        const sb = await (telemetry
            ? telemetry.measure("sourceBuildSandboxReadyMs", () =>
                  sandboxService.getOrCreateSandbox(app, dependencyImage, sourceImageBuildSandboxUniqueName(sourceLayerKey), { ...SANDBOX_DEFAULT_OPTIONS, timeoutMs: 30 * 60 * 1000 })
              )
            : sandboxService.getOrCreateSandbox(app, dependencyImage, sourceImageBuildSandboxUniqueName(sourceLayerKey), { ...SANDBOX_DEFAULT_OPTIONS, timeoutMs: 30 * 60 * 1000 }))

        try {
            return await this.populateSourceImageSandbox({ sb, sandboxService, executor, zipBuffer, telemetry })
        } finally {
            await this.terminateBuildSandbox(sb, "source image build", executor.runtime)
        }
    }

    private async populateSourceImageSandbox(params: {
        sb: Sandbox
        sandboxService: ReturnType<typeof getSandboxProvider>
        executor: ReturnType<typeof sdkRuntimeExecutorRegistry.resolve>
        zipBuffer: Buffer
        telemetry?: SdkDeployTelemetry
    }): Promise<string> {
        const { sb, sandboxService, executor, zipBuffer, telemetry } = params
        const projectDir = sandboxService.getProjectPath(sb)
        const sourceZipPath = sandboxService.getScratchPath(sb, "source-image-code.zip")
        await (telemetry ? telemetry.measure("sourceBuildWriteZipMs", () => this.writeBinaryToSandbox(sb, sourceZipPath, zipBuffer)) : this.writeBinaryToSandbox(sb, sourceZipPath, zipBuffer))
        await (telemetry
            ? telemetry.measure("sourceBuildExtractZipMs", () =>
                  this.ensureSandboxCommand(
                      sb,
                      "extract SDK source",
                      `mkdir -p ${shellQuote(projectDir)} && (command -v unzip >/dev/null || (export DEBIAN_FRONTEND=noninteractive && ${APT_GET_INSTALL_FLAGS} update -qq && ${APT_GET_INSTALL_FLAGS} install -y -qq unzip >/dev/null)) && unzip -o ${shellQuote(sourceZipPath)} -d ${shellQuote(projectDir)}`,
                      executor.runtime
                  )
              )
            : this.ensureSandboxCommand(
                  sb,
                  "extract SDK source",
                  `mkdir -p ${shellQuote(projectDir)} && (command -v unzip >/dev/null || (export DEBIAN_FRONTEND=noninteractive && ${APT_GET_INSTALL_FLAGS} update -qq && ${APT_GET_INSTALL_FLAGS} install -y -qq unzip >/dev/null)) && unzip -o ${shellQuote(sourceZipPath)} -d ${shellQuote(projectDir)}`,
                  executor.runtime
              ))
        await (telemetry
            ? telemetry.measure("sourceBuildPrepareMs", () =>
                  executor.prepareSourceImage({
                      sb,
                      projectDir,
                      templateDir: sandboxService.getDependencyCachePath(sb, executor.runtime),
                      cliCachePath: sandboxService.getCliCachePath(sb),
                      ensureSandboxCommand: async (label, command) => {
                          await this.ensureSandboxCommand(sb, label, command, executor.runtime)
                      },
                      escapeShellArg: shellQuote
                  })
              )
            : executor.prepareSourceImage({
                  sb,
                  projectDir,
                  templateDir: sandboxService.getDependencyCachePath(sb, executor.runtime),
                  cliCachePath: sandboxService.getCliCachePath(sb),
                  ensureSandboxCommand: async (label, command) => {
                      await this.ensureSandboxCommand(sb, label, command, executor.runtime)
                  },
                  escapeShellArg: shellQuote
              }))

        const image = await (telemetry ? telemetry.measure("sourceBuildSnapshotMs", () => sb.snapshotFilesystem()) : sb.snapshotFilesystem())

        return image.imageId
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

    private async ensureSandboxCommand(sb: Sandbox, label: string, command: string, runtime: SdkProjectRuntime): Promise<void> {
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
