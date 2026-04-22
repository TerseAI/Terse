import { Prisma, RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"
import AdmZip from "adm-zip"
import crypto from "crypto"

import logger from "../logger"
import { db } from "../prismaClient"

import { ModalSandboxService, SANDBOX_DEFAULT_OPTIONS } from "./sandboxProvider/ModalSandboxService"
import type { Sandbox } from "./sandboxProvider/SandboxService"
import { sdkRuntimeExecutorRegistry } from "./sdkRuntimeExecutors/SdkRuntimeExecutorRegistry"
import {
    SDK_SOURCE_IMAGE_CODE_ZIP_PATH,
    SDK_SOURCE_IMAGE_PROJECT_DIR,
    type SandboxCommandResult,
    type SdkDependencyImageBuildContext,
    type SdkProjectArchive,
    type SdkProjectRuntime,
    SdkRuntimeExecutor
} from "./sdkRuntimeExecutors/types"
import { computeSourceLayerKey, dependencyBuildSandboxUniqueName, runtimeSandboxUniqueName, sourceImageBuildSandboxUniqueName } from "./sdkSandboxLayerKeys"

const ACTIVE_RUN_STATUSES = [PrismaRunHistoryStatus.in_progress, PrismaRunHistoryStatus.awaiting_approval]
const DEFAULT_SOURCE_IMAGE_GRACE_HOURS = 24
const DEFAULT_DEPENDENCY_IMAGE_GRACE_HOURS = 72
const DEFAULT_CLEANUP_BATCH_SIZE = 50

export interface PreparedSdkSandboxImages {
    runtime: SdkProjectRuntime
    dependencyHash: string
    dependencyImageId: string
    sourceHash: string
    sourceImageId: string
}

export interface CleanupSdkSandboxImagesResult {
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

    async prepareFromSourceZip(params: { zipBuffer: Buffer; gcsKey: string; organizationId: string; onProgress?: (phase: "dependency_image" | "source_image") => void }): Promise<PreparedSdkSandboxImages> {
        const { zipBuffer, gcsKey, organizationId, onProgress } = params
        const archive = new ZipSdkProjectArchive(zipBuffer)
        const executor = sdkRuntimeExecutorRegistry.resolve(archive.entries)

        const dependencyHash = executor.defineDependencyImage(archive).dependencyHash
        const sourceHash = archive.computeSourceHash()

        onProgress?.("dependency_image")
        const dependencyImage = await this.ensureDependencyImage({
            archive,
            dependencyHash,
            executor
        })

        const sourceLayerKey = computeSourceLayerKey({ organizationId, dependencyHash, sourceHash })

        onProgress?.("source_image")
        const sourceImage = await this.ensureSourceImage({
            dependencyImageId: dependencyImage.id,
            dependencySandboxImageId: dependencyImage.image_id,
            executor,
            gcsKey,
            organizationId,
            sourceHash,
            sourceLayerKey,
            zipBuffer
        })

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

    private async ensureDependencyImage(params: { archive: SdkProjectArchive; dependencyHash: string; executor: SdkRuntimeExecutor }) {
        const { archive, dependencyHash, executor } = params
        const prisma = db()

        const existing = await prisma.sdk_dependency_images.findUnique({
            where: { dependency_hash: dependencyHash }
        })

        if (existing) {
            logger.info("SDK image cache: reuse dependency layer", {
                dependencyHash: dependencyHash,
                imageId: existing.image_id
            })
            return prisma.sdk_dependency_images.update({
                where: { id: existing.id },
                data: { last_used_at: new Date() }
            })
        }

        const buildStarted = performance.now()
        const sandboxImageId = await this.buildDependencyImage(archive, executor, dependencyHash)

        try {
            const row = await prisma.sdk_dependency_images.create({
                data: {
                    dependency_hash: dependencyHash,
                    runtime: executor.runtime,
                    base_image_tag: executor.sandboxImage,
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
        gcsKey: string
        organizationId: string
        sourceHash: string
        sourceLayerKey: string
        zipBuffer: Buffer
    }) {
        const { dependencyImageId, dependencySandboxImageId, executor, gcsKey, organizationId, sourceHash, sourceLayerKey, zipBuffer } = params
        const prisma = db()

        const existing = await prisma.sdk_source_images.findFirst({
            where: {
                organization_id: organizationId,
                dependency_image_id: dependencyImageId,
                source_hash: sourceHash
            }
        })

        if (existing) {
            logger.info("SDK image cache: reuse source layer", {
                sourceLayerKey: sourceLayerKey,
                organizationId: organizationId,
                imageId: existing.image_id
            })
            return prisma.sdk_source_images.update({
                where: { id: existing.id },
                data: {
                    gcs_key: gcsKey,
                    last_used_at: new Date()
                }
            })
        }

        const buildStarted = performance.now()
        const sandboxImageId = await this.buildSourceImage({
            dependencySandboxImageId,
            executor,
            sourceLayerKey,
            zipBuffer
        })

        try {
            const created = await prisma.sdk_source_images.create({
                data: {
                    organization_id: organizationId,
                    runtime: executor.runtime,
                    source_hash: sourceHash,
                    gcs_key: gcsKey,
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
            await this.prewarmRuntimeSandbox(sandboxImageId, sourceLayerKey)
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
                    data: {
                        gcs_key: gcsKey,
                        last_used_at: new Date()
                    }
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

    private async buildDependencyImage(archive: SdkProjectArchive, executor: SdkRuntimeExecutor, dependencyHash: string): Promise<string> {
        const sandboxService = new ModalSandboxService()
        const app = await sandboxService.getOrCreateApp("terse-sdk-image-builder")

        const baseImage = sandboxService.getImageFromRegistry(executor.sandboxImage)
        const uniqueName = dependencyBuildSandboxUniqueName(dependencyHash)
        const sb = await sandboxService.getOrCreateSandbox(app, baseImage, uniqueName, SANDBOX_DEFAULT_OPTIONS)

        const buildContext: SdkDependencyImageBuildContext = {
            sb,
            archive,
            templateDir: this.getDependencyTemplateDir(executor.runtime),
            ensureSandboxCommand: async (label, command) => {
                await this.ensureSandboxCommand(sb, label, command, executor.runtime)
            },
            writeFile: async (path, content) => {
                await this.writeFileToSandbox(sb, path, content)
            },
            escapeShellArg: value => this.escapeShellArg(value)
        }

        await executor.buildDependencyImage(buildContext)
        const image = await sb.snapshotFilesystem()

        return image.imageId
    }

    private async buildSourceImage(params: {
        dependencySandboxImageId: string
        executor: ReturnType<typeof sdkRuntimeExecutorRegistry.resolve>
        sourceLayerKey: string
        zipBuffer: Buffer
    }): Promise<string> {
        const { dependencySandboxImageId, executor, sourceLayerKey, zipBuffer } = params
        const sandboxService = new ModalSandboxService()
        const app = await sandboxService.getOrCreateApp("terse-sdk-image-builder")
        const dependencyImage = await sandboxService.getImageFromId(dependencySandboxImageId)
        const sb = await sandboxService.getOrCreateSandbox(app, dependencyImage, sourceImageBuildSandboxUniqueName(sourceLayerKey), { ...SANDBOX_DEFAULT_OPTIONS, timeoutMs: 30 * 60 * 1000 })

        await this.writeBinaryToSandbox(sb, SDK_SOURCE_IMAGE_CODE_ZIP_PATH, zipBuffer)
        await this.ensureSandboxCommand(
            sb,
            "extract SDK source",
            `mkdir -p ${this.escapeShellArg(SDK_SOURCE_IMAGE_PROJECT_DIR)} && (command -v unzip >/dev/null || (export DEBIAN_FRONTEND=noninteractive && apt-get update -qq && apt-get install -y -qq unzip >/dev/null)) && unzip -o ${this.escapeShellArg(
                SDK_SOURCE_IMAGE_CODE_ZIP_PATH
            )} -d ${this.escapeShellArg(SDK_SOURCE_IMAGE_PROJECT_DIR)}`,
            executor.runtime
        )
        await executor.prepareSourceImage({
            sb,
            projectDir: SDK_SOURCE_IMAGE_PROJECT_DIR,
            ensureSandboxCommand: async (label, command) => {
                await this.ensureSandboxCommand(sb, label, command, executor.runtime)
            },
            escapeShellArg: value => this.escapeShellArg(value)
        })

        const image = await sb.snapshotFilesystem()

        return image.imageId
    }

    private async prewarmRuntimeSandbox(modalSourceImageId: string, sourceLayerKey: string): Promise<void> {
        const sandboxService = new ModalSandboxService()
        const app = await sandboxService.getOrCreateApp("terse-sdk-sandbox")
        const image = await sandboxService.getImageFromId(modalSourceImageId)
        const uniqueName = runtimeSandboxUniqueName(sourceLayerKey)
        const sb = await sandboxService.getOrCreateSandbox(app, image, uniqueName, SANDBOX_DEFAULT_OPTIONS)

        const proc = await sb.exec(["true"], { stdout: "pipe", stderr: "pipe" })
        const [stdout, stderr] = await Promise.all([proc.stdout.readText(), proc.stderr.readText()])
        const exitCode = await proc.wait()

        if (exitCode !== 0) {
            logger.error("SDK runtime sandbox prewarm failed", {
                sourceLayerKey,
                modalSourceImageId,
                exitCode,
                stderr: stderr.trim().slice(0, 500),
                stdout: stdout.trim().slice(0, 200)
            })
            throw new Error(`SDK runtime sandbox prewarm failed with exit code ${exitCode}`)
        }

        logger.info("SDK runtime sandbox prewarm completed", { sourceLayerKey, modalSourceImageId })
    }

    private async deleteImage(imageId: string): Promise<void> {
        const sandboxService = new ModalSandboxService()
        await sandboxService.deleteImage(imageId)
    }

    private getDependencyTemplateDir(runtime: SdkProjectRuntime): string {
        return `/opt/terse-sdk-cache/${runtime}/project`
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
        const result = await this.runSandboxCommand(sb, command)
        if (result.exitCode !== 0) {
            throw new Error(`${label} failed for ${runtime}: ${this.buildFailureMessage(result)}`)
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

    private escapeShellArg(value: string): string {
        return `'${value.replace(/'/g, `'\\''`)}'`
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
