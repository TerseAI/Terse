import logger from "../logger"
import { SnowflakePrivateKeyValidationError, normalizeSnowflakePrivateKey, validateSnowflakeCredentials } from "../outputs/snowflake/snowflakeClient"
import { db } from "../prismaClient"
import { SecretField, deleteSecretsBestEffort, storeSecret } from "../services/SecretService"
import { IntegrationType, SnowflakeIntegration, SnowflakeIntegrationMetadata } from "../shared/Integrations"
import { AgentTriggerWithConfigs } from "../types/prisma"

import { FormFieldDefinition, FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration } from "./abstract/Integration"

export class SnowflakeIntegrationManager implements Integration<SnowflakeIntegration, never, typeof SnowflakeIntegrationMetadata, never>, FormIntegrationInstallation<IntegrationType.SNOWFLAKE> {
    constructor() {}
    integrationType: IntegrationType = IntegrationType.SNOWFLAKE

    getFormFields(): FormFieldDefinition[] {
        return [
            {
                name: "accountIdentifier",
                type: "text",
                label: "Account Identifier",
                placeholder: "myorg-myaccount",
                required: true,
                hint: "Your Snowflake account identifier (e.g. myorg-myaccount or xy12345.us-east-1)."
            },
            {
                name: "username",
                type: "text",
                label: "Username",
                placeholder: "TERSE_USER",
                required: true,
                hint: "The Snowflake username for authentication."
            },
            {
                name: "privateKey",
                type: "textarea",
                label: "Private Key (PEM)",
                placeholder: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
                required: true,
                hint: "RSA private key in PEM format for key-pair authentication."
            },
            {
                name: "passphrase",
                type: "password",
                label: "Private Key Passphrase",
                required: false,
                hint: "Required only if the private key is encrypted. Use the PEM passphrase, not the Snowflake user password."
            },
            {
                name: "warehouse",
                type: "text",
                label: "Warehouse",
                placeholder: "COMPUTE_WH",
                required: true,
                hint: "Default Snowflake warehouse to use for queries."
            }
        ]
    }

    async getInstancesForOrganization(organizationId: string): Promise<SnowflakeIntegration[]> {
        const integrations = await db().snowflake_integrations.findMany({
            where: { organization_id: organizationId },
            select: {
                id: true,
                account_identifier: true,
                username: true,
                warehouse: true,
                database_name: true,
                schema_name: true
            }
        })
        return integrations.map(i => ({
            id: i.id,
            accountIdentifier: i.account_identifier,
            username: i.username,
            warehouse: i.warehouse,
            databaseName: i.database_name,
            schemaName: i.schema_name
        }))
    }

    formatIntegrationInstanceForAgent(instance: SnowflakeIntegration): string {
        return `Snowflake (account: ${instance.accountIdentifier}, warehouse: ${instance.warehouse}) [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<SnowflakeIntegration[]> {
        const integrations = await db().snowflake_integrations.findMany({
            select: {
                id: true,
                account_identifier: true,
                username: true,
                warehouse: true,
                database_name: true,
                schema_name: true
            }
        })
        return integrations.map(i => ({
            id: i.id,
            accountIdentifier: i.account_identifier,
            username: i.username,
            warehouse: i.warehouse,
            databaseName: i.database_name,
            schemaName: i.schema_name
        }))
    }

    async processWebhookEvent(event: never): Promise<void> {
        throw new Error("Snowflake webhooks are not processed through this integration manager")
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve()
    }

    async setupAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {}

    async teardownAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {}

    async processFormSubmission(input: FormSubmissionInput): Promise<FormSubmissionResult> {
        const { userId, organizationId, formValues } = input
        const { accountIdentifier, username, privateKey, passphrase, warehouse } = formValues
        const normalizedAccountIdentifier = typeof accountIdentifier === "string" ? accountIdentifier.trim() : accountIdentifier
        const normalizedUsername = typeof username === "string" ? username.trim() : username
        const normalizedWarehouse = typeof warehouse === "string" ? warehouse.trim() : warehouse

        if (!normalizedAccountIdentifier || typeof normalizedAccountIdentifier !== "string") {
            return { success: false, error: "Account identifier is required", statusCode: 400 }
        }
        if (!normalizedUsername || typeof normalizedUsername !== "string") {
            return { success: false, error: "Username is required", statusCode: 400 }
        }
        if (!privateKey || typeof privateKey !== "string") {
            return { success: false, error: "Private key is required", statusCode: 400 }
        }
        if (!normalizedWarehouse || typeof normalizedWarehouse !== "string") {
            return { success: false, error: "Warehouse is required", statusCode: 400 }
        }

        const normalizedPassphrase = typeof passphrase === "string" && passphrase.length > 0 ? passphrase : undefined
        let normalizedPrivateKey: string

        try {
            normalizedPrivateKey = normalizeSnowflakePrivateKey(privateKey, normalizedPassphrase)
        } catch (err) {
            if (err instanceof SnowflakePrivateKeyValidationError) {
                logger.warn("Snowflake private key validation failed", { error: err.message, code: err.code })

                if (err.code === "missing_passphrase") {
                    return {
                        success: false,
                        error: "This private key is encrypted and requires its PEM passphrase. Use the private key passphrase, not the Snowflake user password.",
                        statusCode: 400
                    }
                }

                if (err.code === "invalid_passphrase") {
                    return {
                        success: false,
                        error: "The private key passphrase could not decrypt this PEM. Check that you used the PEM passphrase and pasted it exactly.",
                        statusCode: 400
                    }
                }

                if (err.code === "invalid_key_type") {
                    return {
                        success: false,
                        error: "Snowflake key-pair auth requires an RSA private key in PEM format.",
                        statusCode: 400
                    }
                }
            }

            const message = err instanceof Error ? err.message : String(err)
            logger.warn("Snowflake private key validation failed", { error: message })

            return {
                success: false,
                error: "Invalid private key. Please provide a valid PEM-formatted RSA private key.",
                statusCode: 400
            }
        }

        try {
            // Ensure the Snowflake SDK can authenticate and execute a trivial query before saving.
            await validateSnowflakeCredentials({
                accountIdentifier: normalizedAccountIdentifier,
                username: normalizedUsername,
                privateKey: normalizedPrivateKey,
                warehouse: normalizedWarehouse
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            logger.warn("Snowflake connection validation failed", {
                error: message,
                accountIdentifier: normalizedAccountIdentifier,
                username: normalizedUsername
            })

            return {
                success: false,
                error: `Failed to validate Snowflake connection: ${message}`,
                statusCode: 400
            }
        }

        try {
            const existing = await db().snowflake_integrations.findFirst({
                where: { organization_id: organizationId }
            })

            let integrationId: string

            if (existing) {
                await db().snowflake_integrations.update({
                    where: { id: existing.id },
                    data: {
                        account_identifier: normalizedAccountIdentifier,
                        username: normalizedUsername,
                        warehouse: normalizedWarehouse
                    }
                })
                integrationId = existing.id
                logger.info("✅ Updated Snowflake integration", { integrationId, userId })
            } else {
                const integration = await db().snowflake_integrations.create({
                    data: {
                        user_id: userId,
                        organization_id: organizationId,
                        account_identifier: normalizedAccountIdentifier,
                        username: normalizedUsername,
                        warehouse: normalizedWarehouse
                    }
                })
                integrationId = integration.id
                logger.info("✅ Created Snowflake integration", { integrationId, userId })
            }

            await storeSecret(IntegrationType.SNOWFLAKE, integrationId, SecretField.PrivateKey, normalizedPrivateKey)
            await deleteSecretsBestEffort([{ integrationType: IntegrationType.SNOWFLAKE, recordId: integrationId, field: SecretField.PrivateKeyPassphrase }])

            return {
                success: true,
                statusCode: 200,
                data: { accountIdentifier: normalizedAccountIdentifier, warehouse: normalizedWarehouse }
            }
        } catch (error) {
            logger.error("Error processing Snowflake form submission", { error })
            return { success: false, error: "Failed to process integration", statusCode: 500 }
        }
    }
}
