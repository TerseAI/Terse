import { InputConfigType } from "@prisma/client"
import { Request, Response } from "express"
import { JWTPayload, SignJWT, jwtVerify } from "jose"
import { randomUUID } from "node:crypto"
import { durableObjectSocketTicketRequestSchema } from "terse-types"
import { z } from "zod"

import { secretsMatch } from "../../common/crypto"
import { buildDurableObjectSocketUrl } from "../../common/durableObjectSocketUrl"
import { db } from "../../loaders/prisma"
import { DURABLE_OBJECT_STORAGE_REGION } from "../../services/DurableObjectControlPlaneClient"
import { settings } from "../../settings"
import { readBearerToken } from "../auth/helpers/authDispatch"

const DEFAULT_TICKET_TTL_SECONDS = 300
const SOCKET_SESSION_SECONDS = 3600
const MAX_METADATA_BYTES = 64 * 1024
const TICKET_ISSUER = "terse"
const TICKET_AUDIENCE = "durable-object-socket"

const socketAuthorizationRequestSchema = z.object({
    triggerId: z.string().min(1),
    actorId: z.string().min(1),
    credential: z.string().min(1)
})

const socketTicketClaimsSchema = z.object({
    triggerId: z.string().min(1),
    actorId: z.string().min(1),
    metadata: z.unknown().optional(),
    exp: z.number().int().positive()
})

export async function handleCreateDurableObjectSocketTicket(req: Request, res: Response): Promise<void> {
    const user = req.session?.user
    if (!user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }
    const request = durableObjectSocketTicketRequestSchema.parse(req.body)
    if (metadataSize(request.metadata) > MAX_METADATA_BYTES) {
        res.status(400).json({ error: "Durable Object socket metadata must not exceed 64 KiB" })
        return
    }
    const trigger = await findOwnedTrigger(request.triggerId, user.organizationId)
    if (!trigger || !tokenCanAccessProject(req, trigger.automation.project_id)) {
        res.status(404).json({ error: "Durable Object trigger not found" })
        return
    }
    const ttlSeconds = request.ttlSeconds ?? DEFAULT_TICKET_TTL_SECONDS
    const token = await signTicket({ triggerId: request.triggerId, actorId: request.actorId, metadata: request.metadata }, ttlSeconds)
    res.status(201).json({
        url: buildDurableObjectSocketUrl(request.triggerId, request.actorId),
        protocols: ["terse-do", `terse-ticket.${token}`],
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    })
}

export async function handleRotateDurableObjectSocketKey(req: Request, res: Response): Promise<void> {
    const user = req.session?.user
    if (!user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }
    const triggerId = req.params.triggerId
    const trigger = await findOwnedTrigger(triggerId, user.organizationId)
    if (!trigger) {
        res.status(404).json({ error: "Durable Object trigger not found" })
        return
    }
    const socketKey = `terse_socket_${randomUUID()}`
    await db().automation_durable_object_configs.update({
        where: { automation_input_id: triggerId },
        data: { socket_token: socketKey }
    })
    res.status(200).json({ socketKey })
}

export async function handleAuthorizeDurableObjectSocket(req: Request, res: Response): Promise<void> {
    if (!hasIntegrationCredential(req)) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }
    const request = socketAuthorizationRequestSchema.parse(req.body)
    const trigger = await findActiveTrigger(request.triggerId)
    if (!trigger) {
        res.status(404).json({ error: "Durable Object trigger not found" })
        return
    }
    const authorization = await authorizeCredential(request, trigger.durable_object_config.socket_token)
    if (!authorization) {
        res.status(401).json({ error: "Invalid socket credential" })
        return
    }
    res.status(200).json({
        namespaceId: trigger.automation.project_id,
        actorType: trigger.integration_id,
        actorId: request.actorId,
        storageRegion: DURABLE_OBJECT_STORAGE_REGION,
        metadata: authorization.metadata,
        expiresAt: authorization.expiresAt
    })
}

async function authorizeCredential(request: z.infer<typeof socketAuthorizationRequestSchema>, socketToken: string): Promise<{ metadata: unknown; expiresAt: number } | null> {
    if (secretsMatch(request.credential, socketToken)) {
        return { metadata: {}, expiresAt: Math.floor(Date.now() / 1000) + SOCKET_SESSION_SECONDS }
    }
    try {
        const { payload } = await jwtVerify(request.credential, ticketKey(), {
            algorithms: ["HS256"],
            issuer: TICKET_ISSUER,
            audience: TICKET_AUDIENCE
        })
        const claims = socketTicketClaimsSchema.parse(payload)
        if (claims.triggerId !== request.triggerId || claims.actorId !== request.actorId) return null
        return { metadata: claims.metadata ?? {}, expiresAt: claims.exp }
    } catch {
        return null
    }
}

async function signTicket(claims: Pick<z.infer<typeof socketTicketClaimsSchema>, "triggerId" | "actorId" | "metadata">, ttlSeconds: number): Promise<string> {
    const payload: JWTPayload = { triggerId: claims.triggerId, actorId: claims.actorId, metadata: claims.metadata }
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(TICKET_ISSUER)
        .setAudience(TICKET_AUDIENCE)
        .setIssuedAt()
        .setJti(randomUUID())
        .setExpirationTime(`${ttlSeconds}s`)
        .sign(ticketKey())
}

function ticketKey(): Uint8Array {
    const token = settings.durableObjects?.socketEventToken
    if (!token) throw new Error("DURABLE_OBJECT_SOCKET_EVENT_TOKEN is not configured")
    return new TextEncoder().encode(token)
}

function hasIntegrationCredential(req: Request): boolean {
    const expected = settings.durableObjects?.socketEventToken
    const supplied = readBearerToken(req.headers.authorization)
    return !!expected && !!supplied && secretsMatch(supplied, expected)
}

function tokenCanAccessProject(req: Request, projectId: string): boolean {
    const method = req.session?.authMethod
    return method?.kind !== "api_token" || method.projectId === null || method.projectId === projectId
}

function metadataSize(metadata: unknown): number {
    return Buffer.byteLength(JSON.stringify(metadata ?? {}))
}

async function findOwnedTrigger(triggerId: string, organizationId: string) {
    const trigger = await db().automation_inputs.findFirst({
        where: {
            id: triggerId,
            config_type: InputConfigType.DURABLE_OBJECT_INPUT,
            automation: { organization_id: organizationId, is_active: true }
        },
        include: { durable_object_config: true, automation: true }
    })
    return trigger?.durable_object_config ? { ...trigger, durable_object_config: trigger.durable_object_config } : null
}

async function findActiveTrigger(triggerId: string) {
    const trigger = await db().automation_inputs.findFirst({
        where: { id: triggerId, config_type: InputConfigType.DURABLE_OBJECT_INPUT, automation: { is_active: true } },
        include: { durable_object_config: true, automation: true }
    })
    return trigger?.durable_object_config ? { ...trigger, durable_object_config: trigger.durable_object_config } : null
}
