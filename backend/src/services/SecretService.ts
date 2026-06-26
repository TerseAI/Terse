import { z } from "zod"

import logger from "../common/logger"
import { type IntegrationManagers, getIntegrationRegistry } from "../integrations/abstract/IntegrationRegistry"

import { getSecretManagerClient } from "./secretManager"
import { SecretManagerClient } from "./secretManager/SecretManagerClient"

export class SecretService {
    private static instance: SecretService
    private constructor(private readonly secretManagerClient: SecretManagerClient = getSecretManagerClient()) {}

    public static getInstance(): SecretService {
        if (!SecretService.instance) {
            SecretService.instance = new SecretService()
        }
        return SecretService.instance
    }

    async createSecrets(arg: CreateSecretsArg): Promise<void> {
        const value = arg.secret.value
        if (Object.keys(value).length === 0) return

        const blobId = this.blobIdFor(arg)
        const existing = await this.readBlob(blobId)

        const merged: Record<string, unknown> = { ...existing }
        for (const [k, v] of Object.entries(value)) {
            if (v !== undefined) merged[k] = v
        }
        const validated = this.partialSchemaFor(arg).parse(merged) as Record<string, unknown>

        await this.writeBlob(blobId, validated)
    }

    async getSecrets<A extends GetSecretsArg>(arg: A): Promise<GetSecretsReturn<A>> {
        switch (arg.type) {
            case "integration":
                return this.getIntegrationSecrets(arg.secret) as Promise<GetSecretsReturn<A>>
            case "project":
                return this.getProjectSecrets(arg.secret) as Promise<GetSecretsReturn<A>>
            default:
                throw arg satisfies never
        }
    }

    async tryGetSecrets<A extends GetSecretsArg>(arg: A): Promise<GetSecretsReturn<A> | null> {
        try {
            return await this.getSecrets(arg)
        } catch (error) {
            if (error instanceof SecretNotFoundError) return null
            throw error
        }
    }

    async deleteSecrets(arg: GetSecretsArg | GetSecretsArg[]): Promise<void> {
        const list = Array.isArray(arg) ? arg : [arg]
        if (list.length === 0) return

        const results = await Promise.allSettled(list.map(a => this.deleteBlob(this.blobIdFor(a))))

        const failures = results.flatMap((r, i) => (r.status === "rejected" ? [{ arg: list[i], reason: r.reason }] : []))
        if (failures.length > 0) {
            logger.error("Failed to delete some secret blobs", { failureCount: failures.length, totalCount: list.length, failures })
        }
    }

    async deleteSecretFields(arg: DeleteSecretFieldsArg): Promise<boolean> {
        const blobId = this.blobIdFor(arg)
        const blob = await this.readBlob(blobId)

        let mutated = false
        for (const key of arg.secret.keys) {
            if (key in blob) {
                delete blob[key]
                mutated = true
            }
        }

        if (!mutated) return false
        if (Object.keys(blob).length === 0) {
            await this.deleteBlob(blobId)
            return true
        }

        const validated = this.partialSchemaFor(arg).parse(blob) as Record<string, unknown>
        await this.writeBlob(blobId, validated)
        return true
    }

    async listSecretKeys(arg: GetSecretsArg): Promise<string[]> {
        const blob = await this.readBlob(this.blobIdFor(arg))
        return Object.keys(blob).sort()
    }

    private async getIntegrationSecrets<T extends IntegrationKey>(arg: { integrationType: T; recordId: string }): Promise<IntegrationBlob<T>> {
        const blobId = this.blobIdFor({ type: "integration", secret: arg })
        const validated = await this.readAndValidateOrNull(blobId, this.schemaFor(arg.integrationType))
        if (!validated) {
            throw new SecretNotFoundError(`Integration secret ${blobId} not found`)
        }
        return validated as IntegrationBlob<T>
    }

    private async getProjectSecrets(arg: ProjectGetSecretsArg["secret"]): Promise<Record<string, string>> {
        const blobId = this.blobIdFor({ type: "project", secret: arg })
        const validated = await this.readAndValidateOrNull(blobId, projectBlobSchema)
        return validated ?? {}
    }

    private blobIdFor(arg: GetSecretsArg): string {
        switch (arg.type) {
            case "integration":
                return [arg.secret.integrationType.toLowerCase(), arg.secret.recordId].join("-")
            case "project":
                return ["project", arg.secret.projectId].join("-").slice(0, 255)
            default:
                throw arg satisfies never
        }
    }

    private async readBlob(blobId: string): Promise<Record<string, unknown>> {
        return (await this.readBlobOrNull(blobId)) ?? {}
    }

    private async readBlobOrNull(blobId: string): Promise<Record<string, unknown> | null> {
        const raw = await this.secretManagerClient.getSecretOrNull(blobId)
        if (raw === null) return null
        try {
            const parsed = JSON.parse(raw)
            if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
                logger.error("Secret blob is not a JSON object", { blobId })
                return null
            }
            return parsed as Record<string, unknown>
        } catch (error) {
            logger.error("Failed to parse secret blob JSON", { blobId, error })
            return null
        }
    }

    private partialSchemaFor(arg: GetSecretsArg): z.ZodType {
        switch (arg.type) {
            case "integration":
                return this.schemaFor(arg.secret.integrationType).partial()
            case "project":
                return projectBlobSchema
            default:
                throw arg satisfies never
        }
    }

    private schemaFor(integrationType: IntegrationKey): z.ZodObject {
        const manager = getIntegrationRegistry().find(m => m.integrationType === integrationType)
        if (!manager || !("secretSchema" in manager) || !manager.secretSchema) {
            throw new Error(`No secret schema registered for integration type: ${integrationType}`)
        }
        return manager.secretSchema
    }

    private async writeBlob(blobId: string, blob: Record<string, unknown>): Promise<void> {
        const serialized = JSON.stringify(blob)
        if (Buffer.byteLength(serialized, "utf8") > MAX_BLOB_BYTES) {
            throw new Error(`Secret blob exceeds ${MAX_BLOB_BYTES} bytes`)
        }

        await this.secretManagerClient.createOrUpdateSecret(blobId, serialized)
    }

    private async deleteBlob(blobId: string): Promise<void> {
        await this.secretManagerClient.deleteSecret(blobId)
    }

    private async readAndValidateOrNull<S extends z.ZodTypeAny>(blobId: string, schema: S): Promise<z.infer<S> | null> {
        const blob = await this.readBlobOrNull(blobId)
        if (blob === null) return null
        const result = schema.safeParse(blob)
        if (!result.success) {
            logger.error("Secret blob failed schema validation", { blobId, issues: result.error.issues })
            return null
        }
        return result.data
    }
}

const MAX_BLOB_BYTES = 60 * 1024

const projectBlobSchema = z.record(z.string(), z.string())

type RegistryEntry = IntegrationManagers[number]
type ManagerWithSchema = Extract<RegistryEntry, { secretSchema: unknown }>

type IntegrationKey = ManagerWithSchema["integrationType"]
type IntegrationBlob<T extends IntegrationKey> = z.infer<Extract<ManagerWithSchema, { integrationType: T }>["secretSchema"]>
type IntegrationField<T extends IntegrationKey> = keyof IntegrationBlob<T>

export type GetSecretsArg = IntegrationGetSecretsArg | ProjectGetSecretsArg

type IntegrationGetSecretsArg<T extends IntegrationKey = IntegrationKey> = {
    type: "integration"
    secret: { integrationType: T; recordId: string }
}

type ProjectGetSecretsArg = {
    type: "project"
    secret: { projectId: string }
}

type GetSecretsReturn<A> = A extends IntegrationGetSecretsArg<infer T> ? IntegrationBlob<T> : A extends ProjectGetSecretsArg ? Record<string, string> : never

type WithSecretField<A, F> = A extends { secret: infer S } ? Omit<A, "secret"> & { secret: S & F } : never

type CreateSecretsArg = IntegrationCreateSecretsArg | ProjectCreateSecretsArg

type IntegrationCreateSecretsArg = {
    [K in IntegrationKey]: WithSecretField<IntegrationGetSecretsArg<K>, { value: Partial<IntegrationBlob<K>> }>
}[IntegrationKey]

type ProjectCreateSecretsArg = WithSecretField<ProjectGetSecretsArg, { value: Record<string, string> }>

type DeleteSecretFieldsArg = IntegrationDeleteSecretFieldsArg | ProjectDeleteSecretFieldsArg

type IntegrationDeleteSecretFieldsArg = {
    [K in IntegrationKey]: WithSecretField<IntegrationGetSecretsArg<K>, { keys: readonly IntegrationField<K>[] }>
}[IntegrationKey]

type ProjectDeleteSecretFieldsArg = WithSecretField<ProjectGetSecretsArg, { keys: readonly string[] }>

export class SecretNotFoundError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SecretNotFoundError"
    }
}
