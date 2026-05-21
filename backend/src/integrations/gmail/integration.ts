import { gmail as createGmailClient, gmail_v1 } from "@googleapis/gmail"
import { InputConfigType } from "@prisma/client"
import { Request, Response } from "express"
import { OAuth2Client } from "google-auth-library"
import { ConfigData, ConfigType, GmailEventType, GmailMessagePayload, GmailParsedAttachment, GmailTrigger } from "terse-types"
import { ConfigurationFieldDefinition } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { AdditionalStateParams, GmailIntegration, GmailIntegrationMetadata, InstallationOptionsFor, IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { OAuthInstallationDetails } from "terse-types/types"
import { z } from "zod"

import logger, { runWithUserContext } from "../../common/logger"
import { Identifiable } from "../../hydrators/Hydrator"
import { getUserForOrg } from "../../integrations/workos/helpers"
import { db } from "../../loaders/prisma"
import { EventProcessor } from "../../modules/agents/AgentRunner/EventProcessor"
import { mintOAuthState, verifyOAuthState } from "../../modules/auth/helpers/oauth"
import { FileDownloadResult, StoredFile, buildGmailFileKey, ensureStoredWithMetadata, isSupportedFileType } from "../../services/FileStorageService"
import { SecretService } from "../../services/SecretService"
import { gmail as gmailConfig, urls } from "../../settings"
import { AgentTriggerWithConfigs, GmailIntegration as PrismaGmailIntegration, User } from "../../types/prisma"
import { IntegrationCompletedTask } from "../IntegrationCompletedTask"
import { integrationTaskQueue } from "../IntegrationTaskQueues"
import { Integration, OAuthIntegrationInstallation, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"
import { TriggerRuntime } from "../abstract/TriggerRuntime"

// OAuth2 scopes for Gmail
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose"]

export class GmailIntegrationManager extends Integration<GmailIntegration, GmailWebhookEvent, typeof GmailIntegrationMetadata, never> implements OAuthIntegrationInstallation<IntegrationType.GMAIL> {
    readonly integrationType = IntegrationType.GMAIL
    readonly secretSchema = z.object({
        accessToken: z.string(),
        refreshToken: z.string()
    })

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(organizationId: string): Promise<GmailIntegration[]> {
        const integrations = await db().gmail_integrations.findMany({
            where: { organization_id: organizationId }
        })
        return integrations.map(gi => ({
            id: gi.id,
            email: gi.email,
            historyId: gi.history_id,
            watchExpiration: gi.watch_expiration
        }))
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const integration = await db().gmail_integrations.findFirst({
            where: { organization_id: organizationId, is_active: true },
            orderBy: { created_at: "asc" }
        })

        if (!integration) {
            return createNotConnectedCliDisplayState()
        }

        return createConnectedCliDisplayState("Account", integration.email, integration.id)
    }

    formatIntegrationInstanceForAgent(instance: GmailIntegration): string {
        const details: string[] = []
        if (instance.email) {
            details.push(`email ${instance.email}`)
        }
        const detailText = details.length ? ` (${details.join(", ")})` : ""
        return `Gmail${detailText} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<GmailIntegration[]> {
        const integrations = await db().gmail_integrations.findMany({
            where: { is_active: true },
            select: {
                id: true,
                email: true,
                history_id: true,
                watch_expiration: true
            }
        })
        return integrations.map(gi => ({
            id: gi.id,
            email: gi.email,
            historyId: gi.history_id,
            watchExpiration: gi.watch_expiration
        }))
    }

    async processWebhookEvent(event: GmailWebhookEvent): Promise<void> {
        const { emailAddress, historyId } = event
        logger.info(`Gmail notification for ${emailAddress}, historyId: ${historyId}`, { emailAddress, historyId })

        try {
            // Step 1: Atomically claim this history ID update (CRITICAL SECTION - in transaction)
            const claims = await db().$transaction(async tx => {
                return await claimHistoryIdUpdateInTransaction(tx, emailAddress, historyId)
            })

            if (claims.length === 0) {
                logger.debug(`Skipping webhook processing for ${emailAddress}`, {
                    emailAddress,
                    historyId
                })
                return
            }

            for (const claim of claims) {
                if (!claim.shouldProcess) {
                    continue
                }
                const { integration, user, oldHistoryId } = claim
                const fullUser = await getUserForOrg(integration.user_id, integration.organization_id)
                if (!fullUser) continue

                // Process with user context for logging
                await runWithUserContext(fullUser, async () => {
                    // Step 2: Fetch message IDs from Gmail (fast, non-blocking)
                    const messageIds = await fetchNewMessageIds(integration, oldHistoryId)

                    if (messageIds.length === 0) {
                        logger.debug(`No new messages to process for ${emailAddress}`, {
                            emailAddress,
                            integrationId: integration.id
                        })
                        return
                    }

                    // Step 3: Set up Gmail client (fast, non-blocking)
                    const accessToken = await refreshAccessTokenIfNeeded(integration)
                    const secrets = await this.secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.GMAIL, recordId: integration.id } })
                    const oauth2Client = getOAuth2Client()
                    oauth2Client.setCredentials({
                        access_token: accessToken,
                        refresh_token: secrets.refreshToken
                    })
                    const gmail = createGmailClient({ version: "v1", auth: oauth2Client })

                    const lastProcessedDate: Date | null = integration.last_processed_message_date
                    let mostRecentEmailDate: Date | null = lastProcessedDate

                    // Step 4: Process each message (fast, non-blocking)
                    for (const messageId of messageIds) {
                        // Try to mark this message as processed (non-blocking, unique constraint prevents duplicates)
                        const wasNewlyProcessed = await markMessageAsProcessed(integration.id, messageId, String(Date.now()))

                        if (!wasNewlyProcessed) {
                            logger.debug(`Skipping already processed message ${messageId}`, {
                                messageId,
                                integrationId: integration.id
                            })
                            continue
                        }

                        const parsedEmail: GmailMessagePayload | null = await fetchAndParseEmail(gmail, messageId)

                        if (parsedEmail) {
                            const emailTimestamp = parseInt(parsedEmail.internalDate, 10)
                            const emailDate = new Date(emailTimestamp)

                            logger.debug("Received Webhook for email", {
                                from: parsedEmail.from,
                                to: parsedEmail.to,
                                subject: parsedEmail.subject,
                                date: emailDate.toISOString(),
                                messageId,
                                integrationId: integration.id
                            })

                            // Skip messages older than the last processed message date
                            if (lastProcessedDate && emailDate <= lastProcessedDate) {
                                logger.debug(`Skipping old message ${parsedEmail.id} from ${emailDate.toISOString()}`, {
                                    messageId: parsedEmail.id,
                                    subject: parsedEmail.subject,
                                    emailDate: emailDate.toISOString(),
                                    lastProcessedDate: lastProcessedDate.toISOString(),
                                    integrationId: integration.id
                                })
                                // Mark as processed (non-blocking)
                                await markMessageAsProcessed(integration.id, parsedEmail.id, parsedEmail.internalDate)
                                continue
                            }

                            // Download attachments and store in GCS (if configured)
                            const allAttachments = parsedEmail.attachments || []
                            let storedFiles: StoredFile[] = []
                            if (allAttachments.length > 0) {
                                storedFiles = await downloadGmailAttachments(gmail, parsedEmail.id, allAttachments, integration.id)
                            }

                            // Process email through automations (non-blocking)
                            logger.info("About to process email", {
                                userEmail: fullUser.email,
                                subject: parsedEmail.subject,
                                from: parsedEmail.from,
                                to: parsedEmail.to,
                                date: emailDate.toISOString(),
                                integrationId: integration.id,
                                messageId: parsedEmail.id
                            })

                            const eventProcessor = new EventProcessor(new GmailTriggerRuntime(parsedEmail, integration.id, storedFiles), fullUser)
                            const results = await eventProcessor.process()

                            let hasSuccess = false
                            for (const result of results) {
                                if (result.success) {
                                    logger.info(`Email processed successfully by agent: ${result.agentConfig?.name || "unknown"}`, {
                                        agentName: result.agentConfig?.name,
                                        integrationId: integration.id,
                                        messageId: parsedEmail.id
                                    })
                                    hasSuccess = true
                                } else {
                                    logger.debug(`Agent "${result.agentConfig?.name || "unknown"}" skipped: ${result.message}`, {
                                        agentName: result.agentConfig?.name,
                                        message: result.message,
                                        integrationId: integration.id
                                    })
                                }
                            }

                            // Track the most recent email date if processing succeeded
                            if (hasSuccess && (!mostRecentEmailDate || emailDate > mostRecentEmailDate)) {
                                mostRecentEmailDate = emailDate
                            }
                        }
                    }

                    // Step 5: Update the last processed message date (non-blocking)
                    if (mostRecentEmailDate && mostRecentEmailDate !== lastProcessedDate) {
                        await db().gmail_integrations.update({
                            where: { id: integration.id },
                            data: { last_processed_message_date: mostRecentEmailDate }
                        })
                        logger.info(`Updated last processed message date to ${mostRecentEmailDate.toISOString()}`, {
                            mostRecentEmailDate: mostRecentEmailDate.toISOString(),
                            integrationId: integration.id
                        })
                    }

                    logger.info(`Successfully processed webhook for ${emailAddress}, historyId: ${historyId}`, { emailAddress, historyId, integrationId: integration.id })
                })
            }
        } catch (error) {
            logger.error("Error processing Gmail webhook", {
                error,
                emailAddress,
                historyId
            })
            // Re-throw to ensure it's logged by the caller
            throw error
        }
    }

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        options: InstallationOptionsFor<IntegrationType.GMAIL> | undefined,
        additionalStatePayload: AdditionalStateParams | undefined,
        req: Request,
        res: Response
    ): Promise<OAuthInstallationDetails> {
        const oauth2Client = getOAuth2Client()

        const state = mintOAuthState(req, res, {
            userId,
            organizationId,
            additionalStatePayload
        })

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: "offline", // Get refresh token
            scope: SCOPES,
            state: state,
            prompt: "consent" // Force consent screen to get refresh token
        })
        return {
            oauthUrl: authUrl
        }
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state } = req.query as { code?: string; state?: string }

        logger.debug("Gmail OAuth callback received")

        if (!code || !state) {
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        try {
            const stateData = verifyOAuthState(req, res, state)
            const userId = stateData.userId
            const organizationId = stateData.organizationId

            if (!userId) {
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            if (!organizationId || typeof organizationId !== "string") {
                logger.error("Gmail OAuth: organizationId is required in state", {
                    userId
                })
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            const oauth2Client = getOAuth2Client()

            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code)
            oauth2Client.setCredentials(tokens)

            if (!tokens.access_token || !tokens.refresh_token) {
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Get user's email address
            const gmail = createGmailClient({ version: "v1", auth: oauth2Client })
            const profile = await gmail.users.getProfile({ userId: "me" })
            const emailAddress = profile.data.emailAddress

            if (!emailAddress) {
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Set up Gmail watch
            const watchResponse = await gmail.users.watch({
                userId: "me",
                requestBody: {
                    topicName: gmailConfig.pubsubTopic,
                    labelIds: ["INBOX"],
                    labelFilterAction: "include"
                }
            })

            const historyId = watchResponse.data.historyId
            const expiration = watchResponse.data.expiration

            if (!historyId || !expiration) {
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Calculate token expiry
            const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000) // Default 1 hour

            // Store in database and set is_active to true
            const integration = await db().gmail_integrations.upsert({
                where: {
                    user_id_email: {
                        user_id: userId,
                        email: emailAddress
                    }
                },
                create: {
                    user_id: userId,
                    organization_id: organizationId,
                    email: emailAddress,
                    history_id: historyId,
                    watch_expiration: new Date(parseInt(expiration)),
                    token_expiry: tokenExpiry,
                    is_active: true,
                    last_processed_message_date: new Date() // Set initial date to prevent processing historical messages
                },
                update: {
                    organization_id: organizationId,
                    history_id: historyId,
                    watch_expiration: new Date(parseInt(expiration)),
                    token_expiry: tokenExpiry,
                    is_active: true
                }
            })

            await this.secretService.createSecrets({
                type: "integration",
                secret: { integrationType: IntegrationType.GMAIL, recordId: integration.id, value: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token } }
            })

            logger.info(`Gmail integration activated for ${emailAddress}`, {
                emailAddress,
                userId
            })

            // Emit integration completed task (includes full state payload for chat metadata detection)
            integrationTaskQueue.emit(new IntegrationCompletedTask(IntegrationType.GMAIL, integration.id, userId, stateData, new Date()))

            // Redirect to success page which will auto-close the popup
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (error) {
            logger.error("Gmail OAuth error", { error })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return db()
            .$transaction(async tx => {
                await tx.gmail_integrations.delete({ where: { id: integrationId } })
            })
            .then(async () => {
                await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.GMAIL, recordId: integrationId } })
            })
    }

    async setupAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Gmail doesn't require any setup for channel inputs
        // Webhooks are managed at the integration level
    }

    async teardownAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Gmail doesn't require any teardown for channel inputs
        // Webhooks are managed at the integration level
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        try {
            const integration = await db().gmail_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration || !integration.is_active) {
                logger.warn(`Gmail integration ${integrationId} not found or inactive`, { integrationId })
                return false
            }

            // Store the original token expiry to detect if refresh happened
            const originalTokenExpiry = integration.token_expiry

            // Use getAccessToken which internally handles token refresh via refreshAccessTokenIfNeeded
            const accessToken = await this.getAccessToken(integrationId)
            if (!accessToken) {
                logger.error(`Failed to get access token for Gmail integration ${integrationId}`, { integrationId })
                return false
            }

            // Check if token was refreshed by comparing expiry dates
            const updatedIntegration = await db().gmail_integrations.findUnique({
                where: { id: integrationId },
                select: { token_expiry: true }
            })

            const tokenRefreshed = updatedIntegration && originalTokenExpiry && updatedIntegration.token_expiry ? updatedIntegration.token_expiry.getTime() !== originalTokenExpiry.getTime() : false

            // Also refresh the Gmail watch if it's expiring soon (within 24 hours) or if token was refreshed
            const now = new Date()
            const watchNeedsRefresh = !integration.watch_expiration || integration.watch_expiration <= new Date(now.getTime() + 24 * 60 * 60 * 1000)

            if (watchNeedsRefresh || tokenRefreshed) {
                logger.info(`Refreshing Gmail watch for integration ${integrationId}`, {
                    integrationId,
                    watchNeedsRefresh,
                    tokenRefreshed
                })

                // Set up OAuth client with current credentials
                const oauth2Client = getOAuth2Client()
                const currentExpiry = updatedIntegration?.token_expiry || integration.token_expiry
                const secrets = await this.secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.GMAIL, recordId: integration.id } })
                oauth2Client.setCredentials({
                    access_token: accessToken,
                    refresh_token: secrets.refreshToken,
                    expiry_date: currentExpiry?.getTime()
                })

                // Get Gmail client
                const gmail = createGmailClient({ version: "v1", auth: oauth2Client })

                // Refresh the watch
                const watchResponse = await gmail.users.watch({
                    userId: "me",
                    requestBody: {
                        topicName: gmailConfig.pubsubTopic,
                        labelIds: ["INBOX"],
                        labelFilterAction: "include"
                    }
                })

                const historyId = watchResponse.data.historyId
                const expiration = watchResponse.data.expiration

                if (!historyId || !expiration) {
                    logger.error(`Failed to refresh watch for ${integrationId}: Missing historyId or expiration`, { integrationId })
                    // Don't fail the whole operation if watch refresh fails
                } else {
                    // Update the database with new watch information
                    await db().gmail_integrations.update({
                        where: { id: integration.id },
                        data: {
                            history_id: historyId,
                            watch_expiration: new Date(parseInt(expiration))
                        }
                    })

                    logger.info(`Successfully refreshed Gmail watch for ${integrationId}. New expiration: ${new Date(parseInt(expiration)).toISOString()}`, {
                        integrationId,
                        expiration: new Date(parseInt(expiration)).toISOString()
                    })
                }
            }

            return tokenRefreshed
        } catch (error) {
            logger.error(`Error refreshing Gmail token for integration ${integrationId}`, { error, integrationId })
            return false
        }
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        try {
            const integration = await db().gmail_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration || !integration.is_active) {
                logger.error(`Gmail integration ${integrationId} not found or inactive`, { integrationId })
                return null
            }

            // Use the existing helper function to ensure token is refreshed if needed
            return await refreshAccessTokenIfNeeded(integration)
        } catch (error) {
            logger.error(`Error getting Gmail access token for integration ${integrationId}`, { error, integrationId })
            return null
        }
    }

    async getSampleEvents(integrationId: string, organizationId: string, _userId: string, triggerConfig: ConfigData, options?: { limit?: number }): Promise<TriggerRuntime[]> {
        if (triggerConfig.configType !== ConfigType.GMAIL) {
            return []
        }

        const limit = Math.min(options?.limit ?? 5, 10)
        const gmailIntegration = await db().gmail_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId }
        })
        if (!gmailIntegration) {
            throw new Error(`Gmail integration ${integrationId} not found`)
        }

        const accessToken = await refreshAccessTokenIfNeeded(gmailIntegration)
        const secrets = await this.secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.GMAIL, recordId: gmailIntegration.id } })
        const oauth2Client = getOAuth2Client()
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: secrets.refreshToken
        })
        const gmail = createGmailClient({ version: "v1", auth: oauth2Client })

        const listResponse = await gmail.users.messages.list({
            userId: "me",
            labelIds: ["INBOX"],
            maxResults: limit
        })
        const messageIds = (listResponse.data.messages?.map(m => m.id).filter(Boolean) as string[]) || []
        const events: TriggerRuntime[] = []
        for (const messageId of messageIds) {
            const eventData = await fetchAndParseEmail(gmail, messageId)
            if (eventData) {
                events.push(new GmailTriggerRuntime(eventData, integrationId))
            }
        }
        return events
    }
}

export class GmailTriggerRuntime extends TriggerRuntime<GmailTrigger> implements Identifiable {
    readonly integrationType = IntegrationType.GMAIL
    readonly entityType = "gmail_event"
    entityId: string
    data: GmailTrigger
    private integrationId: string
    private storedFiles: StoredFile[]

    constructor(data: GmailMessagePayload, integrationId: string, storedFiles: StoredFile[] = []) {
        super()
        this.data = {
            integrationType: IntegrationType.GMAIL,
            eventType: GmailEventType.EMAIL_RECEIVED,
            ...data
        }
        this.integrationId = integrationId
        this.entityId = `${integrationId}:${data.id}`
        this.storedFiles = storedFiles
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        // Check if integration type matches
        if (agentTrigger.config_type !== InputConfigType.GMAIL) {
            return false
        }

        // If the event is not in the INBOX, it doesn't match the channel input
        if (!this.data.labelIds.includes("INBOX")) {
            logger.debug(`Skipping email ${this.data.messageId} because it is not in the INBOX with label ids: ${this.data.labelIds}`, { messageId: this.data.messageId, labelIds: this.data.labelIds })
            return false
        }

        // If integrationId is set, it must match the automation's integration_id
        // This ensures automations are only triggered by emails from their configured integration
        if (this.integrationId && agentTrigger.integration_id !== this.integrationId) {
            logger.debug(`Skipping email ${this.data.messageId} - integration ID mismatch: event from ${this.integrationId}, channel expects ${agentTrigger.integration_id}`, {
                messageId: this.data.messageId,
                eventIntegrationId: this.integrationId,
                channelIntegrationId: agentTrigger.integration_id
            })
            return false
        }

        return true
    }

    createTriggerMetadata(): RunHistoryTrigger {
        // Construct Gmail message URL using the thread ID with #all
        // Format: https://mail.google.com/mail/u/0/#all/{threadId}
        // Using #all instead of #inbox ensures the link works regardless of label
        const gmailUrl = this.data.threadId ? `https://mail.google.com/mail/u/0/#all/${this.data.threadId}` : undefined

        return {
            event: "email_received",
            integration: IntegrationType.GMAIL,
            source: this.data.to || "Gmail",
            title: this.data.subject,
            subheader: this.data.from,
            url: gmailUrl
        }
    }

    getFiles(): StoredFile[] {
        return this.storedFiles || []
    }
}

// Create OAuth2 client
export function getOAuth2Client(): OAuth2Client {
    return new OAuth2Client(gmailConfig.clientId, gmailConfig.clientSecret, gmailConfig.redirectUri)
}

/**
 * Refresh access token if expired
 */
async function refreshAccessTokenIfNeeded(integration: PrismaGmailIntegration): Promise<string> {
    const now = new Date()
    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({
        type: "integration",
        secret: { integrationType: IntegrationType.GMAIL, recordId: integration.id }
    })
    const currentAccessToken = secrets.accessToken
    const refreshToken = secrets.refreshToken

    // Google access tokens last ~1 hour; only refresh when within 5 minutes of expiry
    const GMAIL_TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000
    if (integration.token_expiry && integration.token_expiry <= new Date(now.getTime() + GMAIL_TOKEN_REFRESH_THRESHOLD_MS)) {
        logger.info("Access token expired or expiring soon, refreshing...", {
            integrationId: integration.id,
            tokenExpiry: integration.token_expiry
        })

        if (!refreshToken) {
            logger.error("No refresh token available for Gmail integration", { integrationId: integration.id })
            return currentAccessToken
        }

        const oauth2Client = getOAuth2Client()
        oauth2Client.setCredentials({
            refresh_token: refreshToken
        })

        const { credentials } = await oauth2Client.refreshAccessToken()

        const newTokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000)
        await secretService.createSecrets({
            type: "integration",
            secret: {
                integrationType: IntegrationType.GMAIL,
                recordId: integration.id,
                value: credentials.refresh_token ? { accessToken: credentials.access_token!, refreshToken: credentials.refresh_token } : { accessToken: credentials.access_token! }
            }
        })

        // Update the database with new tokens
        await db().gmail_integrations.update({
            where: { id: integration.id },
            data: {
                token_expiry: newTokenExpiry
            }
        })

        logger.info("Access token refreshed successfully", {
            integrationId: integration.id,
            newTokenExpiry
        })

        return credentials.access_token!
    }

    return currentAccessToken
}

/**
 * Atomically claim a history ID update within an existing transaction
 * Returns null if the webhook should be skipped (already processed or no integration)
 */
async function claimHistoryIdUpdateInTransaction(
    tx: any,
    emailAddress: string, // This is the email belonging to the gmail watch webhook
    newHistoryId: number
): Promise<ProcessedWebhookClaim[]> {
    const newHistoryIdString = newHistoryId.toString()

    logger.debug("Getting Integrations associated with email", {
        emailAddress,
        newHistoryId: newHistoryIdString
    })
    const integrations = await tx.gmail_integrations.findMany({
        where: {
            email: emailAddress,
            is_active: true
        }
    })

    if (!integrations || integrations.length === 0) {
        logger.debug("No active integrations found for email", { emailAddress })
        return [
            {
                shouldProcess: false,
                integration: null,
                user: null,
                oldHistoryId: null
            }
        ]
    }

    const claims: ProcessedWebhookClaim[] = await Promise.all(
        integrations.map(async (integration: PrismaGmailIntegration) => {
            const oldHistoryId = integration.history_id
            const currentHistoryId = parseInt(integration.history_id, 10)
            if (newHistoryId <= currentHistoryId) {
                logger.debug(`Skipping webhook: historyId ${newHistoryId} is not newer than current ${currentHistoryId}`, { newHistoryId, currentHistoryId, integrationId: integration.id })
                return {
                    shouldProcess: false,
                    integration: null,
                    user: null,
                    oldHistoryId: null
                }
            }

            // Atomically update the history ID to claim this batch
            // This prevents other concurrent webhooks from processing the same messages
            const updatedIntegration = await tx.gmail_integrations.update({
                where: { id: integration.id },
                data: { history_id: newHistoryIdString }
            })

            const user = await tx.users.findUnique({
                where: {
                    id: integration.user_id
                }
            })

            if (!user) {
                logger.warn("No user found for integration", {
                    userId: integration.user_id,
                    integrationId: integration.id
                })
                return {
                    shouldProcess: false,
                    integration: null,
                    user: null,
                    oldHistoryId: null
                }
            }

            return {
                shouldProcess: true,
                integration: updatedIntegration,
                user: user,
                oldHistoryId: oldHistoryId
            }
        })
    )
    return claims
}

/**
 * Mark a message as processed in the database
 * Returns true if the message was newly marked, false if it was already processed
 * Uses unique constraint to prevent duplicates (fast, non-blocking)
 */
async function markMessageAsProcessed(integrationId: string, messageId: string, internalDate: string): Promise<boolean> {
    try {
        await db().processed_gmail_messages.create({
            data: {
                gmail_integration_id: integrationId,
                gmail_message_id: messageId,
                internal_date: internalDate
            }
        })
        return true
    } catch (error: any) {
        // If unique constraint fails, this message was already processed
        if (error.code === "P2002") {
            return false
        }
        // Re-throw other errors
        throw error
    }
}

/**
 * Fetch new message IDs from Gmail history
 */
async function fetchNewMessageIds(integration: PrismaGmailIntegration, oldHistoryId: string): Promise<string[]> {
    // Refresh token if needed
    const accessToken = await refreshAccessTokenIfNeeded(integration)
    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.GMAIL, recordId: integration.id } })

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: secrets.refreshToken
    })

    const gmail = createGmailClient({ version: "v1", auth: oauth2Client })

    logger.debug(`Fetching Gmail history from ${oldHistoryId}`, {
        oldHistoryId,
        integrationId: integration.id
    })

    const historyResponse = await gmail.users.history.list({
        userId: "me",
        startHistoryId: oldHistoryId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX"
    })

    const history = historyResponse.data.history || []

    if (history.length === 0) {
        logger.debug("No new messages in history", {
            oldHistoryId,
            integrationId: integration.id
        })
        return []
    }

    // Extract message IDs from history
    const messageIds: string[] = []
    for (const record of history) {
        if (record.messagesAdded) {
            for (const added of record.messagesAdded) {
                if (added.message?.id) {
                    messageIds.push(added.message.id)
                }
            }
        }
    }

    logger.debug(`Found ${messageIds.length} new messages`, {
        messageCount: messageIds.length,
        oldHistoryId,
        integrationId: integration.id
    })

    return messageIds
}

export async function fetchAndParseEmail(gmail: gmail_v1.Gmail, messageId: string): Promise<GmailMessagePayload | null> {
    try {
        const messageResponse = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
            format: "full"
        })

        const message = messageResponse.data
        const headers = message.payload?.headers || []
        const getHeader = (name: string) => {
            const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase())
            return header?.value || ""
        }

        const subject = getHeader("Subject")
        const from = getHeader("From")
        const to = getHeader("To")
        const date = getHeader("Date")
        const messageIdHeader = getHeader("Message-ID")
        const labelIds = message.labelIds || []

        const getBody = (payload: gmail_v1.Schema$MessagePart): string => {
            if (payload.body?.data) {
                return Buffer.from(payload.body.data, "base64").toString("utf-8")
            }
            if (payload.parts) {
                for (const part of payload.parts) {
                    if (part.mimeType === "text/plain" && part.body?.data) {
                        return Buffer.from(part.body.data, "base64").toString("utf-8")
                    }
                    const nestedBody = getBody(part)
                    if (nestedBody) return nestedBody
                }
            }
            return ""
        }

        const extractAttachments = (payload: gmail_v1.Schema$MessagePart): GmailParsedAttachment[] => {
            const attachments: GmailParsedAttachment[] = []
            const partHeaders = payload.headers || []
            const getPartHeader = (name: string) => {
                const header = partHeaders.find(h => h.name?.toLowerCase() === name.toLowerCase())
                return header?.value || ""
            }
            if (payload.body?.attachmentId && payload.mimeType) {
                const contentDisposition = getPartHeader("Content-Disposition")
                const contentId = getPartHeader("Content-ID")
                const isInline = contentDisposition.toLowerCase().includes("inline") || !!contentId
                attachments.push({
                    attachmentId: payload.body.attachmentId,
                    filename: payload.filename || "attachment",
                    mimeType: payload.mimeType,
                    contentId: contentId ? contentId.replace(/[<>]/g, "") : undefined,
                    isInline
                })
            }
            if (payload.parts) {
                for (const part of payload.parts) {
                    attachments.push(...extractAttachments(part))
                }
            }
            return attachments
        }

        const body = getBody(message.payload || {})
        const attachments = extractAttachments(message.payload || {})

        return {
            id: message.id || messageId,
            threadId: message.threadId || "",
            subject,
            from,
            to,
            date,
            internalDate: message.internalDate || "",
            messageId: messageIdHeader,
            body,
            snippet: message.snippet || "",
            labelIds,
            attachments: attachments.length > 0 ? attachments : undefined
        }
    } catch (error: any) {
        if (error?.code === 404 || error?.message?.includes("Requested entity was not found")) {
            logger.debug(`Message ${messageId} not found (likely deleted or moved)`, {
                messageId
            })
        } else {
            logger.error(`Error fetching message ${messageId}`, { error, messageId })
        }
        return null
    }
}

export type GmailWebhookEvent = {
    emailAddress: string
    historyId: number
}

type ProcessedWebhookClaim =
    | {
          shouldProcess: true
          integration: PrismaGmailIntegration
          user: User
          oldHistoryId: string
      }
    | {
          shouldProcess: false
          integration: null
          user: null
          oldHistoryId: null
      }

/**
 * Decode base64url string (Gmail uses base64url encoding)
 */
function decodeBase64Url(str: string): Buffer {
    // Replace URL-safe characters and add padding
    const urlSafe = str.replace(/-/g, "+").replace(/_/g, "/")
    const padded = urlSafe.padEnd(urlSafe.length + ((4 - (urlSafe.length % 4)) % 4), "=")
    return Buffer.from(padded, "base64")
}

/**
 * Downloads attachments from Gmail and stores them in GCS
 * Returns array of StoredFile with metadata (url, mimeType, category)
 */
async function downloadGmailAttachments(gmail: gmail_v1.Gmail, messageId: string, attachments: GmailParsedAttachment[], integrationId: string): Promise<StoredFile[]> {
    try {
        const supportedAttachments = attachments.filter(att => isSupportedFileType(att.mimeType, att.filename))

        if (supportedAttachments.length === 0) return []

        logger.info(`📎 [GMAIL] Found ${supportedAttachments.length} supported attachment(s) for message ${messageId}`, {
            messageId,
            integrationId,
            totalAttachments: attachments.length,
            supportedCount: supportedAttachments.length
        })

        const results = await Promise.all(supportedAttachments.map(attachment => processGmailAttachment(gmail, messageId, attachment, integrationId)))

        const storedFiles = results.filter((f): f is StoredFile => f !== null)

        return storedFiles
    } catch (error) {
        // Don't let attachment download failures break the entire event
        logger.error(`Failed to download Gmail attachments`, {
            error,
            messageId,
            integrationId,
            attachmentCount: attachments.length
        })
        return []
    }
}

async function processGmailAttachment(gmail: gmail_v1.Gmail, messageId: string, attachment: GmailParsedAttachment, integrationId: string): Promise<StoredFile | null> {
    try {
        const primaryKey = buildGmailFileKey(integrationId, messageId, attachment.attachmentId)
        const storedFile = await ensureStoredWithMetadata(primaryKey, async (): Promise<FileDownloadResult> => {
            const attachmentResponse = await gmail.users.messages.attachments.get({
                userId: "me",
                messageId: messageId,
                id: attachment.attachmentId
            })

            const attachmentData = attachmentResponse.data
            if (!attachmentData.data) {
                throw new Error("No data in attachment response")
            }

            const buffer = decodeBase64Url(attachmentData.data)
            return {
                data: buffer,
                mimeType: attachment.mimeType || "application/octet-stream",
                filename: attachment.filename
            }
        })

        if (storedFile) {
            logger.debug(`✅ Stored Gmail attachment in GCS`, {
                messageId,
                attachmentId: attachment.attachmentId,
                filename: attachment.filename,
                category: storedFile.category,
                isInline: attachment.isInline
            })
        }

        return storedFile ?? null
    } catch (error) {
        logger.error(`Error storing Gmail attachment`, {
            error,
            messageId,
            attachmentId: attachment.attachmentId,
            filename: attachment.filename
        })
        return null
    }
}
