import { InputConfigType } from "@prisma/client"
import crypto from "crypto"
import { Request, Response } from "express"
import { attioAttributeSchema, attioListSchema, attioObjectSchema, attioWebhookPayloadSchema } from "terse-types"
import { IntegrationType } from "terse-types/Integrations"
import type { AttioAttribute, AttioObjectWithAttributes } from "terse-types/types"
import { z } from "zod"

import logger from "../../../common/logger"
import { AttioIntegrationManager } from "../../../integrations/attio/integration"
import { db } from "../../../loaders/prisma"
import { AttioApiError, attioRequestData } from "../../../outputs/attio/tools/attioApi"
import { SecretService } from "../../../services/SecretService"

const webhookParamsSchema = z.object({ triggerId: z.string() })

export async function getAttioIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new AttioIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Attio integrations:", { error })
        res.status(500).json({ error: "Failed to fetch Attio integrations" })
    }
}

export async function getAttioObjects(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const { integrationId } = req.params
    if (!integrationId) {
        res.status(400).json({ error: "Missing integrationId parameter" })
        return
    }

    try {
        const manager = new AttioIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            res.status(404).json({ error: "Attio integration not found or not connected" })
            return
        }

        const objects = await attioRequestData(accessToken, "/objects", z.array(attioObjectSchema), "objects")

        const objectsWithAttributes = await Promise.all(
            objects.map(async (obj): Promise<AttioObjectWithAttributes> => ({
                ...obj,
                attributes: await fetchEnrichedAttributes(accessToken, "objects", obj.api_slug)
            }))
        )

        res.status(200).json(objectsWithAttributes)
    } catch (error) {
        respondAttioFetchFailure(res, error, "objects")
    }
}

export async function getAttioLists(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const { integrationId } = req.params
    if (!integrationId) {
        res.status(400).json({ error: "Missing integrationId parameter" })
        return
    }

    try {
        const manager = new AttioIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            res.status(404).json({ error: "Attio integration not found or not connected" })
            return
        }

        const lists = await attioRequestData(accessToken, "/lists", z.array(attioListSchema), "lists")

        const listsWithAttributes = await Promise.all(
            lists.map(async list => ({
                ...list,
                attributes: await fetchEnrichedAttributes(accessToken, "lists", list.id.list_id)
            }))
        )

        res.status(200).json(listsWithAttributes)
    } catch (error) {
        respondAttioFetchFailure(res, error, "lists")
    }
}

const OPTION_PATH_BY_ATTRIBUTE_TYPE: Record<string, string> = { status: "statuses", select: "options" }

async function fetchEnrichedAttributes(accessToken: string, target: "objects" | "lists", identifier: string): Promise<AttioAttribute[]> {
    let attributes: AttioAttribute[]
    try {
        attributes = await attioRequestData(accessToken, `/${target}/${encodeURIComponent(identifier)}/attributes`, z.array(attioAttributeSchema), "attributes")
    } catch (error) {
        logger.warn("Failed to fetch Attio attributes", { target, identifier, error })
        return []
    }
    return Promise.all(attributes.map(attribute => enrichAttributeWithOptions(accessToken, target, identifier, attribute)))
}

const attributeOptionSchema = z.object({ title: z.string(), is_archived: z.boolean() }).catchall(z.unknown())

async function enrichAttributeWithOptions(accessToken: string, target: "objects" | "lists", identifier: string, attribute: AttioAttribute): Promise<AttioAttribute> {
    const pathSegment = OPTION_PATH_BY_ATTRIBUTE_TYPE[(attribute.type || "").toLowerCase()]
    if (!pathSegment || !attribute.api_slug) return attribute

    try {
        const options = await attioRequestData(
            accessToken,
            `/${target}/${encodeURIComponent(identifier)}/attributes/${encodeURIComponent(attribute.api_slug)}/${pathSegment}`,
            z.array(attributeOptionSchema),
            "attribute options"
        )
        return { ...attribute, options: options.flatMap(option => (option.title && !option.is_archived ? [option.title] : [])) }
    } catch (error) {
        logger.warn("Failed to fetch Attio attribute options", { target, identifier, attributeSlug: attribute.api_slug, error })
        return attribute
    }
}

function respondAttioFetchFailure(res: Response, error: unknown, what: "objects" | "lists") {
    if (error instanceof AttioApiError) {
        logger.error(`Failed to fetch Attio ${what}`, { status: error.status, error: error.responseBody })
        res.status(error.status).json({ error: `Failed to fetch Attio ${what}` })
        return
    }
    logger.error(`Error fetching Attio ${what}`, { error })
    res.status(500).json({ error: `Failed to fetch Attio ${what}` })
}

export const attioOAuthCallback = async (req: Request, res: Response) => {
    const integration = new AttioIntegrationManager()
    await integration.processInstallationCallback(req, res)
}

export async function handleAttioWebhook(req: Request, res: Response) {
    const { triggerId } = webhookParamsSchema.parse(req.params)

    try {
        const rawBody = req.body as Buffer
        if (!Buffer.isBuffer(rawBody)) {
            logger.error("Attio webhook: missing raw body", { triggerId })
            res.status(400).json({ error: "Missing raw body" })
            return
        }

        const trigger = await db().automation_inputs.findFirst({
            where: { id: triggerId, config_type: InputConfigType.ATTIO_INPUT }
        })
        if (!trigger) {
            logger.warn("Attio webhook: unknown trigger", { triggerId })
            res.status(404).json({ error: "Trigger not found" })
            return
        }
        const secretService = SecretService.getInstance()
        const secret = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.ATTIO, recordId: triggerId } })
        if (!secret.webhookSecret) {
            logger.error("Attio webhook: signing secret not found", { triggerId })
            res.status(500).json({ error: "Webhook secret missing" })
            return
        }

        const headerSignature = req.get("attio-signature") ?? req.get("x-attio-signature")
        if (!verifyAttioSignature(headerSignature, rawBody, secret.webhookSecret)) {
            logger.error("Attio webhook: invalid signature", { triggerId })
            res.status(401).json({ error: "Invalid signature" })
            return
        }

        let body: unknown
        try {
            body = JSON.parse(rawBody.toString("utf8"))
        } catch (error) {
            logger.warn("Attio webhook: invalid JSON", { triggerId, error })
            res.status(400).json({ error: "Invalid JSON" })
            return
        }

        const parsed = attioWebhookPayloadSchema.safeParse(body)
        if (!parsed.success) {
            logger.warn("Attio webhook: payload validation failed", { triggerId, issues: parsed.error.issues })
            res.status(400).json({ error: "Invalid payload" })
            return
        }

        const idempotencyKey = req.get("idempotency-key") ?? crypto.randomUUID()

        res.status(200).json({ received: true })

        const manager = new AttioIntegrationManager()
        manager.processWebhookEvent({ triggerId, payload: parsed.data, idempotencyKey }).catch(error => {
            logger.error("Error processing Attio webhook", { error, triggerId })
        })
    } catch (error) {
        logger.error("Attio webhook handler failed", { error, triggerId })
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to process webhook" })
        }
    }
}

function verifyAttioSignature(headerSignature: string | undefined, rawBody: Buffer, secret: string): boolean {
    if (typeof headerSignature !== "string") return false
    try {
        const expected = Buffer.from(headerSignature, "hex")
        const computed = crypto.createHmac("sha256", secret).update(rawBody).digest()
        return expected.length === computed.length && crypto.timingSafeEqual(computed, expected)
    } catch (error) {
        logger.error("Error verifying Attio signature", { error })
        return false
    }
}
