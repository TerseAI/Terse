import { NotificationDestinationType } from "@prisma/client"
import { notificationDestinationsKey } from "terse-types/InvalidationKeys"
import { EmailNotificationDestination, NotificationDestinationType as SharedNotificationDestinationType, SlackNotificationDestination } from "terse-types/Notifications"

import { initializeSlackWebClient } from "../../../integrations/slack/client"
import { SLACKBOT_USER_ID } from "../../../integrations/slack/helpers"
import { emitCacheInvalidationWithKey } from "../../../services/CacheInvalidationService"
import { UserNotificationDestination, UserSlackIntegrationWithSlack } from "../../../types/prisma"

import { createDestination, deleteDestination, findDestinationById, findDestinationsForUser, findSlackIntegrationForOrganization, updateDestination } from "./repository"

const EXACTLY_ONE_SLACK_TARGET_ERROR = "Exactly one Slack destination must be selected: either a channel or a user."
const NOTIFICATION_DESTINATIONS_INVALIDATION_KEY = notificationDestinationsKey()[0]

export class DestinationNotFoundError extends Error {
    constructor() {
        super("Notification destination not found")
        this.name = "DestinationNotFoundError"
    }
}

export class InvalidDestinationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "InvalidDestinationError"
    }
}

export class SlackIntegrationNotFoundError extends Error {
    constructor() {
        super("Slack integration not found or not owned by user")
        this.name = "SlackIntegrationNotFoundError"
    }
}

type SlackTargetSelection = { targetType: "channel"; slackChannelId: string; slackChannelName?: string } | { targetType: "user"; slackUserId: string; slackUserName?: string }

type ResolvedSlackDestination = {
    slackChannelId: string
    slackChannelName: string | null
    slackUserId: string | null
    slackUserName: string | null
}

function normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(record, key)
}

function parseSlackTargetSelection(params: { slackChannelId?: string; slackChannelName?: string; slackUserId?: string; slackUserName?: string }): SlackTargetSelection {
    const hasChannelTarget = Boolean(params.slackChannelId)
    const hasUserTarget = Boolean(params.slackUserId)
    if (hasChannelTarget === hasUserTarget) throw new InvalidDestinationError(EXACTLY_ONE_SLACK_TARGET_ERROR)
    if (params.slackChannelId) {
        return { targetType: "channel", slackChannelId: params.slackChannelId, slackChannelName: params.slackChannelName }
    }
    return { targetType: "user", slackUserId: params.slackUserId!, slackUserName: params.slackUserName }
}

function getSlackTargetSelectionFromStoredDestination(destination: UserNotificationDestination): SlackTargetSelection {
    const storedSlackUserId = normalizeOptionalString(destination.slack_user_id)
    if (storedSlackUserId) {
        return { targetType: "user", slackUserId: storedSlackUserId, slackUserName: normalizeOptionalString(destination.slack_user_name) }
    }
    const storedSlackChannelId = normalizeOptionalString(destination.slack_channel_id)
    if (storedSlackChannelId) {
        return { targetType: "channel", slackChannelId: storedSlackChannelId, slackChannelName: normalizeOptionalString(destination.slack_channel_name) }
    }
    throw new InvalidDestinationError(EXACTLY_ONE_SLACK_TARGET_ERROR)
}

function getResolvedSlackDestinationFromStoredDestination(destination: UserNotificationDestination): ResolvedSlackDestination {
    const slackChannelId = normalizeOptionalString(destination.slack_channel_id)
    if (!slackChannelId) throw new InvalidDestinationError(EXACTLY_ONE_SLACK_TARGET_ERROR)
    return {
        slackChannelId,
        slackChannelName: normalizeOptionalString(destination.slack_channel_name) ?? null,
        slackUserId: normalizeOptionalString(destination.slack_user_id) ?? null,
        slackUserName: normalizeOptionalString(destination.slack_user_name) ?? null
    }
}

async function resolveSlackDestinationTarget(params: { slackIntegration: UserSlackIntegrationWithSlack; targetSelection: SlackTargetSelection }): Promise<ResolvedSlackDestination> {
    if (params.targetSelection.targetType === "channel") {
        return {
            slackChannelId: params.targetSelection.slackChannelId,
            slackChannelName: params.targetSelection.slackChannelName ?? null,
            slackUserId: null,
            slackUserName: null
        }
    }
    const userId = params.targetSelection.slackUserId
    if (userId === SLACKBOT_USER_ID) {
        throw new InvalidDestinationError("Slackbot can't be a notification destination — pick a real user or channel.")
    }
    const client = await initializeSlackWebClient(params.slackIntegration)
    const result = await client.conversations.open({ users: userId })
    const dmChannelId = result.channel?.id
    if (!dmChannelId) throw new InvalidDestinationError(`Unable to open a DM channel for Slack user ${userId}.`)
    return {
        slackChannelId: dmChannelId,
        slackChannelName: params.targetSelection.slackUserName ?? userId,
        slackUserId: userId,
        slackUserName: params.targetSelection.slackUserName ?? null
    }
}

export function transformDestinationToFrontendFormat(destination: UserNotificationDestination): EmailNotificationDestination | SlackNotificationDestination {
    if (destination.destination_type === NotificationDestinationType.EMAIL) {
        return {
            id: destination.id,
            type: SharedNotificationDestinationType.EMAIL,
            isActive: destination.is_active,
            email: destination.email_address ?? ""
        }
    }
    return {
        id: destination.id,
        type: SharedNotificationDestinationType.SLACK,
        isActive: destination.is_active,
        integrationId: destination.slack_integration_id ?? "",
        slackChannelId: destination.slack_channel_id ?? undefined,
        slackChannelName: destination.slack_channel_name ?? undefined,
        slackUserId: destination.slack_user_id ?? undefined,
        slackUserName: destination.slack_user_name ?? undefined
    }
}

function invalidateNotificationDestinations(organizationId: string | null | undefined): void {
    if (!organizationId) return
    emitCacheInvalidationWithKey(organizationId, NOTIFICATION_DESTINATIONS_INVALIDATION_KEY)
}

export async function listDestinationsForUser(userId: string): Promise<Array<EmailNotificationDestination | SlackNotificationDestination>> {
    const destinations = await findDestinationsForUser(userId)
    return destinations.map(transformDestinationToFrontendFormat)
}

interface CreateDestinationInput {
    userId: string
    organizationId: string | undefined
    type: "email" | "slack"
    email?: string
    integrationId?: string
    slackChannelId?: string
    slackChannelName?: string
    slackUserId?: string
    slackUserName?: string
}

export async function createDestinationForUser(input: CreateDestinationInput): Promise<UserNotificationDestination> {
    const { userId, organizationId, type, email, integrationId, slackChannelId, slackChannelName, slackUserId, slackUserName } = input

    if (type === "email" && !email) {
        throw new InvalidDestinationError("Invalid request: email is required for email destinations")
    }

    const normalizedIntegrationId = normalizeOptionalString(integrationId)
    if (type === "slack" && !normalizedIntegrationId) {
        throw new InvalidDestinationError("Invalid request: integrationId is required for Slack destinations")
    }

    let resolvedSlackDestination: ResolvedSlackDestination | null = null
    if (type === "slack") {
        if (!organizationId) throw new InvalidDestinationError("Organization context is required")
        const slackIntegration = await findSlackIntegrationForOrganization(normalizedIntegrationId!, organizationId)
        if (!slackIntegration) throw new SlackIntegrationNotFoundError()
        const slackTargetSelection = parseSlackTargetSelection({
            slackChannelId: normalizeOptionalString(slackChannelId),
            slackChannelName: normalizeOptionalString(slackChannelName),
            slackUserId: normalizeOptionalString(slackUserId),
            slackUserName: normalizeOptionalString(slackUserName)
        })
        resolvedSlackDestination = await resolveSlackDestinationTarget({ slackIntegration, targetSelection: slackTargetSelection })
    }

    const destination = await createDestination({
        user_id: userId,
        destination_type: type === "email" ? NotificationDestinationType.EMAIL : NotificationDestinationType.SLACK,
        email_address: type === "email" ? (email ?? null) : null,
        slack_integration_id: type === "slack" ? (normalizedIntegrationId ?? null) : null,
        slack_channel_id: type === "slack" ? resolvedSlackDestination?.slackChannelId : null,
        slack_channel_name: type === "slack" ? resolvedSlackDestination?.slackChannelName : null,
        slack_user_id: type === "slack" ? resolvedSlackDestination?.slackUserId : null,
        slack_user_name: type === "slack" ? resolvedSlackDestination?.slackUserName : null
    })

    invalidateNotificationDestinations(organizationId)
    return destination
}

interface UpdateDestinationInput {
    userId: string
    organizationId: string | undefined
    destinationId: string
    type?: "email" | "slack"
    email?: string
    integrationId?: string
    slackChannelId?: string
    slackChannelName?: string
    slackUserId?: string
    slackUserName?: string
    isActive?: boolean
    requestBody: Record<string, unknown>
}

export async function updateDestinationForUser(input: UpdateDestinationInput): Promise<UserNotificationDestination> {
    const { userId, organizationId, destinationId, type, email, integrationId, slackChannelId, slackChannelName, slackUserId, slackUserName, isActive, requestBody } = input

    const existingDestination = await findDestinationById(destinationId, userId)
    if (!existingDestination) throw new DestinationNotFoundError()

    const destinationType = type ?? (existingDestination.destination_type === NotificationDestinationType.SLACK ? "slack" : "email")
    const updateData: Record<string, unknown> = {}
    if (isActive !== undefined) updateData.is_active = isActive

    if (destinationType === "email") {
        const nextEmail = email ?? existingDestination.email_address
        if (!nextEmail) throw new InvalidDestinationError("Invalid request: email is required for email destinations")
        updateData.destination_type = NotificationDestinationType.EMAIL
        updateData.email_address = nextEmail
        updateData.slack_integration_id = null
        updateData.slack_channel_id = null
        updateData.slack_channel_name = null
        updateData.slack_user_id = null
        updateData.slack_user_name = null
    } else {
        const integrationIdToUse = normalizeOptionalString(integrationId) ?? normalizeOptionalString(existingDestination.slack_integration_id)
        if (!integrationIdToUse) throw new InvalidDestinationError("Invalid request: integrationId is required for Slack destinations")

        const hasSlackChannelIdInput = hasOwn(requestBody, "slackChannelId")
        const hasSlackUserIdInput = hasOwn(requestBody, "slackUserId")
        const hasSlackChannelNameInput = hasOwn(requestBody, "slackChannelName")
        const hasSlackUserNameInput = hasOwn(requestBody, "slackUserName")
        const hasExplicitTargetSelection = hasSlackChannelIdInput || hasSlackUserIdInput
        const isExistingSlackDestination = existingDestination.destination_type === NotificationDestinationType.SLACK
        const integrationChanged = integrationIdToUse !== existingDestination.slack_integration_id
        const shouldResolveSlackTarget = !isExistingSlackDestination || hasExplicitTargetSelection || integrationChanged || hasSlackChannelNameInput || hasSlackUserNameInput

        let resolvedSlackDestination: ResolvedSlackDestination
        if (shouldResolveSlackTarget) {
            if (!organizationId) throw new InvalidDestinationError("Organization context is required")
            const slackIntegration = await findSlackIntegrationForOrganization(integrationIdToUse, organizationId)
            if (!slackIntegration) throw new SlackIntegrationNotFoundError()
            const slackTargetSelection = hasExplicitTargetSelection
                ? parseSlackTargetSelection({
                      slackChannelId: hasSlackChannelIdInput ? normalizeOptionalString(slackChannelId) : undefined,
                      slackChannelName: hasSlackChannelNameInput ? normalizeOptionalString(slackChannelName) : undefined,
                      slackUserId: hasSlackUserIdInput ? normalizeOptionalString(slackUserId) : undefined,
                      slackUserName: hasSlackUserNameInput ? normalizeOptionalString(slackUserName) : undefined
                  })
                : getSlackTargetSelectionFromStoredDestination(existingDestination)
            resolvedSlackDestination = await resolveSlackDestinationTarget({ slackIntegration, targetSelection: slackTargetSelection })
        } else {
            resolvedSlackDestination = getResolvedSlackDestinationFromStoredDestination(existingDestination)
        }

        updateData.destination_type = NotificationDestinationType.SLACK
        updateData.email_address = null
        updateData.slack_integration_id = integrationIdToUse
        updateData.slack_channel_id = resolvedSlackDestination.slackChannelId
        updateData.slack_channel_name = resolvedSlackDestination.slackChannelName
        updateData.slack_user_id = resolvedSlackDestination.slackUserId
        updateData.slack_user_name = resolvedSlackDestination.slackUserName
    }

    const updated = await updateDestination(destinationId, updateData)
    invalidateNotificationDestinations(organizationId)
    return updated
}

export async function deleteDestinationForUser(destinationId: string, userId: string, organizationId: string | undefined): Promise<void> {
    const existing = await findDestinationById(destinationId, userId)
    if (!existing) throw new DestinationNotFoundError()
    await deleteDestination(destinationId)
    invalidateNotificationDestinations(organizationId)
}
