import { z } from "zod"

import { gcp } from "../config/settings"
import { INTEGRATION_REGISTRY, type IntegrationManagers } from "../integrations/abstract/IntegrationRegistry"
import logger from "../logger"
import { getSecretManagerClient } from "../utility/secretManagerClient"

export function isGsmAvailable(): boolean {
    return Boolean(gcp.serviceAccountBase64 && gcp.projectId)
}

export async function createSecrets(arg: CreateSecretsArg): Promise<void> {
    const value = arg.secret.value
    if (Object.keys(value).length === 0) return

    const blobId = blobIdFor(arg)
    const existing = await readBlob(blobId)

    const merged: Record<string, unknown> = { ...existing }
    for (const [k, v] of Object.entries(value)) {
        if (v !== undefined) merged[k] = v
    }
    const validated = partialSchemaFor(arg).parse(merged) as Record<string, unknown>

    await writeBlob(blobId, validated)
}

export function getSecrets<A extends GetSecretsArg>(arg: A): Promise<GetSecretsReturn<A>> {
    switch (arg.type) {
        case "integration":
            return getIntegrationSecrets(arg.secret) as Promise<GetSecretsReturn<A>>
        case "project":
            return getProjectSecrets(arg.secret) as Promise<GetSecretsReturn<A>>
        default:
            throw arg satisfies never
    }
}

export async function tryGetSecrets<A extends GetSecretsArg>(arg: A): Promise<GetSecretsReturn<A> | null> {
    try {
        return await getSecrets(arg)
    } catch (error) {
        if (error instanceof SecretNotFoundError) return null
        throw error
    }
}

async function getIntegrationSecrets<T extends IntegrationKey>(arg: { integrationType: T; recordId: string }): Promise<IntegrationBlob<T>> {
    const blobId = blobIdFor({ type: "integration", secret: arg })
    const validated = await readAndValidateOrNull(blobId, schemaFor(arg.integrationType))
    if (!validated) {
        throw new SecretNotFoundError(`Integration secret ${blobId} not found`)
    }
    return validated as IntegrationBlob<T>
}

async function getProjectSecrets(arg: ProjectGetSecretsArg["secret"]): Promise<Record<string, string>> {
    const blobId = blobIdFor({ type: "project", secret: arg })
    const validated = await readAndValidateOrNull(blobId, projectBlobSchema)
    return validated ?? {}
}

export async function deleteSecrets(arg: GetSecretsArg | GetSecretsArg[]): Promise<void> {
    const list = Array.isArray(arg) ? arg : [arg]
    if (list.length === 0) return

    const results = await Promise.allSettled(list.map(a => deleteBlob(blobIdFor(a))))

    const failures = results.flatMap((r, i) => (r.status === "rejected" ? [{ arg: list[i], reason: r.reason }] : []))
    if (failures.length > 0) {
        logger.error("Failed to delete some secret blobs", { failureCount: failures.length, totalCount: list.length, failures })
    }
}

export async function deleteSecretFields(arg: DeleteSecretFieldsArg): Promise<boolean> {
    const blobId = blobIdFor(arg)
    const blob = await readBlob(blobId)

    let mutated = false
    for (const key of arg.secret.keys) {
        if (key in blob) {
            delete blob[key]
            mutated = true
        }
    }

    if (!mutated) return false
    if (Object.keys(blob).length === 0) {
        await deleteBlob(blobId)
        return true
    }

    const validated = partialSchemaFor(arg).parse(blob) as Record<string, unknown>
    await writeBlob(blobId, validated)
    return true
}

export async function listSecretKeys(arg: ListSecretKeysArg): Promise<string[]> {
    const blob = await readBlob(blobIdFor(arg))
    return Object.keys(blob).sort()
}

function partialSchemaFor(arg: AnyArg): z.ZodType {
    switch (arg.type) {
        case "integration":
            return schemaFor(arg.secret.integrationType).partial()
        case "project":
            return projectBlobSchema
        default:
            throw arg satisfies never
    }
}

function blobIdFor(arg: AnyArg): string {
    switch (arg.type) {
        case "integration":
            return [arg.secret.integrationType.toLowerCase(), arg.secret.recordId].join("-")
        case "project":
            return ["project", arg.secret.projectId].join("-").slice(0, 255)
        default:
            throw arg satisfies never
    }
}

async function readBlob(blobId: string): Promise<Record<string, unknown>> {
    return (await readBlobOrNull(blobId)) ?? {}
}

async function readBlobOrNull(blobId: string): Promise<Record<string, unknown> | null> {
    const raw = await getSecretManagerClient().getSecretOrNull(blobId)
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

async function readAndValidateOrNull<S extends z.ZodTypeAny>(blobId: string, schema: S): Promise<z.infer<S> | null> {
    const blob = await readBlobOrNull(blobId)
    if (blob === null) return null
    const result = schema.safeParse(blob)
    if (!result.success) {
        logger.error("Secret blob failed schema validation", { blobId, issues: result.error.issues })
        return null
    }
    return result.data
}

async function writeBlob(blobId: string, blob: Record<string, unknown>): Promise<void> {
    const serialized = JSON.stringify(blob)
    if (Buffer.byteLength(serialized, "utf8") > MAX_BLOB_BYTES) {
        throw new Error(`Secret blob exceeds ${MAX_BLOB_BYTES} bytes`)
    }

    await getSecretManagerClient().createOrUpdateSecret(blobId, serialized)
}

async function deleteBlob(blobId: string): Promise<void> {
    await getSecretManagerClient().deleteSecret(blobId)
}

const MAX_BLOB_BYTES = 60 * 1024

const projectBlobSchema = z.record(z.string(), z.string())

type RegistryEntry = IntegrationManagers[number]
type ManagerWithSchema = Extract<RegistryEntry, { secretSchema: unknown }>

export type IntegrationKey = ManagerWithSchema["integrationType"]
export type IntegrationBlob<T extends IntegrationKey> = z.infer<Extract<ManagerWithSchema, { integrationType: T }>["secretSchema"]>
export type IntegrationField<T extends IntegrationKey> = keyof IntegrationBlob<T>

function schemaFor(integrationType: IntegrationKey): z.ZodObject {
    const manager = INTEGRATION_REGISTRY.find(m => m.integrationType === integrationType)
    if (!manager || !("secretSchema" in manager) || !manager.secretSchema) {
        throw new Error(`No secret schema registered for integration type: ${integrationType}`)
    }
    return manager.secretSchema
}

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

export type CreateSecretsArg = IntegrationCreateSecretsArg | ProjectCreateSecretsArg

type IntegrationCreateSecretsArg = {
    [K in IntegrationKey]: {
        type: "integration"
        secret: { integrationType: K; recordId: string; value: Partial<IntegrationBlob<K>> }
    }
}[IntegrationKey]

type ProjectCreateSecretsArg = {
    type: "project"
    secret: { projectId: string; value: Record<string, string> }
}

export type DeleteSecretFieldsArg = IntegrationDeleteSecretFieldsArg | ProjectDeleteSecretFieldsArg

type IntegrationDeleteSecretFieldsArg = {
    [K in IntegrationKey]: {
        type: "integration"
        secret: { integrationType: K; recordId: string; keys: readonly IntegrationField<K>[] }
    }
}[IntegrationKey]

type ProjectDeleteSecretFieldsArg = {
    type: "project"
    secret: { projectId: string; keys: readonly string[] }
}

export type ListSecretKeysArg = IntegrationListSecretKeysArg | ProjectListSecretKeysArg

type IntegrationListSecretKeysArg = {
    type: "integration"
    secret: { integrationType: IntegrationKey; recordId: string }
}

type ProjectListSecretKeysArg = {
    type: "project"
    secret: { projectId: string }
}

type AnyArg = IntegrationAnyArg | ProjectAnyArg
type IntegrationAnyArg = { type: "integration"; secret: { integrationType: IntegrationKey; recordId: string } }
type ProjectAnyArg = { type: "project"; secret: { projectId: string } }

export class SecretNotFoundError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SecretNotFoundError"
    }
}
