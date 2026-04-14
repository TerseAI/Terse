import AdmZip from "adm-zip"
import { ModalClient, Sandbox } from "modal"

import { settings } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"

import { sdkRuntimeExecutorRegistry } from "./sdkRuntimeExecutors/SdkRuntimeExecutorRegistry"
import type { SandboxCommandResult, SdkImageBuildContext, SdkProjectArchive, SdkProjectRuntime } from "./sdkRuntimeExecutors/types"

export interface PreparedSdkSandboxImage {
    imageHash: string
    imageId: string
    reusedExisting: boolean
    runtime: SdkProjectRuntime
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

            const normalizedPath = normalizeArchivePath(entry.entryName)
            this.entryByPath.set(normalizedPath, entry)
        }

        this.entries = new Set(this.entryByPath.keys())
    }

    has(path: string): boolean {
        return this.entryByPath.has(normalizeArchivePath(path))
    }

    readText(path: string): string | null {
        const entry = this.entryByPath.get(normalizeArchivePath(path))
        if (!entry) {
            return null
        }

        return entry.getData().toString("utf-8")
    }
}

export class SdkSandboxImageService {
    private elapsed(startMs: number): string {
        return `${((performance.now() - startMs) / 1000).toFixed(2)}s`
    }

    async prepareFromSourceZip(zipBuffer: Buffer): Promise<PreparedSdkSandboxImage> {
        const archive = new ZipSdkProjectArchive(zipBuffer)
        const executor = sdkRuntimeExecutorRegistry.resolve(archive.entries)
        const imageDefinition = executor.definePrebuiltImage(archive)

        const existing = await db().automation_prompts.findFirst({
            where: {
                sandbox_image_hash: imageDefinition.imageHash,
                sandbox_image_id: { not: null },
                sandbox_runtime: executor.runtime
            },
            select: {
                sandbox_image_id: true
            }
        })

        if (existing?.sandbox_image_id) {
            logger.info("SDK sandbox image: reusing cached image", {
                runtime: executor.runtime,
                imageHash: imageDefinition.imageHash,
                imageId: existing.sandbox_image_id
            })

            return {
                imageHash: imageDefinition.imageHash,
                imageId: existing.sandbox_image_id,
                reusedExisting: true,
                runtime: executor.runtime
            }
        }

        const modal = new ModalClient({
            tokenId: settings.modal.tokenId,
            tokenSecret: settings.modal.tokenSecret
        })

        const buildStart = performance.now()
        const app = await modal.apps.fromName("terse-sdk-image-builder", { createIfMissing: true })
        const baseImage = modal.images.fromRegistry(executor.sandboxImage)
        const sb = await modal.sandboxes.create(app, baseImage, { timeoutMs: 30 * 60 * 1000 })

        logger.info("SDK sandbox image: started image build", {
            runtime: executor.runtime,
            imageHash: imageDefinition.imageHash,
            sandboxId: sb.sandboxId
        })

        try {
            const buildContext: SdkImageBuildContext = {
                sb,
                archive,
                templateDir: this.getTemplateDir(executor.runtime),
                ensureSandboxCommand: async (label, command) => {
                    await this.ensureSandboxCommand(sb, label, command, executor.runtime)
                },
                writeFile: async (path, content) => {
                    await this.writeFileToSandbox(sb, path, content)
                },
                escapeShellArg: value => this.escapeShellArg(value)
            }

            await executor.buildPrebuiltImage(buildContext)
            const image = await sb.snapshotFilesystem()

            logger.info("SDK sandbox image: finished image build", {
                runtime: executor.runtime,
                imageHash: imageDefinition.imageHash,
                imageId: image.imageId,
                duration: this.elapsed(buildStart)
            })

            return {
                imageHash: imageDefinition.imageHash,
                imageId: image.imageId,
                reusedExisting: false,
                runtime: executor.runtime
            }
        } catch (error) {
            logger.error("SDK sandbox image: failed image build", {
                error,
                runtime: executor.runtime,
                imageHash: imageDefinition.imageHash,
                duration: this.elapsed(buildStart)
            })
            throw error
        } finally {
            await sb.terminate().catch(() => {})
        }
    }

    private getTemplateDir(runtime: SdkProjectRuntime): string {
        return `/opt/terse-sdk-cache/${runtime}/project`
    }

    private async writeFileToSandbox(sb: Sandbox, path: string, content: string): Promise<void> {
        const fileHandle = await sb.open(path, "w")
        await fileHandle.write(new TextEncoder().encode(content))
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
