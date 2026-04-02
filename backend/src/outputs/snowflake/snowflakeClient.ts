import crypto from "crypto"
import snowflake from "snowflake-sdk"
import { IntegrationType } from "terse-types"

import logger from "../../logger"
import { db } from "../../prismaClient"
import { SecretField, getSecret } from "../../services/SecretService"
import { extractErrorMessage } from "../../utility/strings"

snowflake.configure({ logLevel: "OFF" })

export interface SnowflakeCredentials {
    accountIdentifier: string
    username: string
    privateKey: string
    passphrase?: string
    warehouse: string
    databaseName?: string | null
    schemaName?: string | null
    roleName?: string | null
}

type SnowflakePrivateKeyValidationCode = "missing_passphrase" | "invalid_passphrase" | "invalid_key_type" | "invalid_format"

export class SnowflakePrivateKeyValidationError extends Error {
    constructor(
        message: string,
        public readonly code: SnowflakePrivateKeyValidationCode
    ) {
        super(message)
        this.name = "SnowflakePrivateKeyValidationError"
    }
}

function isEncryptedPrivateKeyPem(privateKey: string): boolean {
    return privateKey.includes("BEGIN ENCRYPTED PRIVATE KEY") || /Proc-Type:\s*4,ENCRYPTED/i.test(privateKey)
}

function looksLikeInvalidPassphraseError(message: string): boolean {
    return /bad decrypt|bad password read|interrupted or cancelled|maybe wrong password|pkcs12 cipherfinal error/i.test(message)
}

export function normalizeSnowflakePrivateKey(privateKey: string, passphrase?: string): string {
    const normalizedPrivateKey = privateKey.replace(/\r\n/g, "\n").trim()
    const normalizedPassphrase = typeof passphrase === "string" && passphrase.length > 0 ? passphrase : undefined
    const encryptedPrivateKey = isEncryptedPrivateKeyPem(normalizedPrivateKey)

    if (encryptedPrivateKey && !normalizedPassphrase) {
        throw new SnowflakePrivateKeyValidationError("Encrypted private key requires a PEM passphrase.", "missing_passphrase")
    }

    try {
        const keyObject = crypto.createPrivateKey(
            encryptedPrivateKey && normalizedPassphrase
                ? {
                      key: normalizedPrivateKey,
                      format: "pem",
                      passphrase: normalizedPassphrase
                  }
                : {
                      key: normalizedPrivateKey,
                      format: "pem"
                  }
        )

        if (keyObject.asymmetricKeyType !== "rsa") {
            throw new SnowflakePrivateKeyValidationError("Snowflake key-pair auth requires an RSA private key.", "invalid_key_type")
        }

        const exportedPrivateKey = keyObject.export({
            format: "pem",
            type: "pkcs8"
        })

        return (typeof exportedPrivateKey === "string" ? exportedPrivateKey : exportedPrivateKey.toString("utf8")).replace(/\r\n/g, "\n").trim()
    } catch (error) {
        if (error instanceof SnowflakePrivateKeyValidationError) {
            throw error
        }

        const message = extractErrorMessage(error)

        if (encryptedPrivateKey && looksLikeInvalidPassphraseError(message)) {
            throw new SnowflakePrivateKeyValidationError("The provided private key passphrase could not decrypt the PEM.", "invalid_passphrase")
        }

        throw new SnowflakePrivateKeyValidationError("Invalid private key. Expected a PEM-formatted RSA private key.", "invalid_format")
    }
}

export async function getSnowflakeCredentials(integrationId: string, organizationId: string): Promise<SnowflakeCredentials> {
    const integration = await db().snowflake_integrations.findUnique({
        where: { id: integrationId, organization_id: organizationId }
    })

    if (!integration) {
        throw new Error(`Snowflake integration not found for integrationId: ${integrationId}`)
    }

    const privateKey = await getSecret(IntegrationType.SNOWFLAKE, integrationId, SecretField.PrivateKey)
    if (!privateKey) {
        throw new Error(`Snowflake private key not found for integrationId: ${integrationId}`)
    }

    const passphrase = await getSecret(IntegrationType.SNOWFLAKE, integrationId, SecretField.PrivateKeyPassphrase)

    return {
        accountIdentifier: integration.account_identifier,
        username: integration.username,
        privateKey,
        passphrase: passphrase ?? undefined,
        warehouse: integration.warehouse,
        databaseName: integration.database_name,
        schemaName: integration.schema_name,
        roleName: integration.role_name
    }
}

export function createSnowflakeConnection(credentials: SnowflakeCredentials): snowflake.Connection {
    const normalizedPrivateKey = normalizeSnowflakePrivateKey(credentials.privateKey, credentials.passphrase)
    const connectionOptions: snowflake.ConnectionOptions = {
        account: credentials.accountIdentifier,
        username: credentials.username,
        authenticator: "SNOWFLAKE_JWT",
        privateKey: normalizedPrivateKey,
        warehouse: credentials.warehouse || undefined,
        database: credentials.databaseName || undefined,
        schema: credentials.schemaName || undefined,
        role: credentials.roleName || undefined
    }

    return snowflake.createConnection(connectionOptions)
}

export function connectAsync(connection: snowflake.Connection): Promise<snowflake.Connection> {
    return new Promise((resolve, reject) => {
        connection.connect((err, conn) => {
            if (err) {
                reject(new Error(`Snowflake connection failed: ${err.message}`))
            } else {
                resolve(conn)
            }
        })
    })
}

export interface QueryResult {
    rows: Record<string, any>[]
    columns: string[]
    rowCount: number
}

export function executeQuery(connection: snowflake.Connection, sql: string): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
        connection.execute({
            sqlText: sql,
            complete: (err, stmt, rows) => {
                if (err) {
                    reject(new Error(`Query execution failed: ${err.message}`))
                    return
                }
                const columns = (stmt.getColumns() ?? []).map((col: any) => col.getName())
                resolve({
                    rows: rows ?? [],
                    columns,
                    rowCount: rows?.length ?? 0
                })
            }
        })
    })
}

/**
 * Creates a connection, executes a query, then destroys the connection.
 * This is the recommended pattern for Terse - fresh connection per tool call.
 */
export async function runSnowflakeQuery(credentials: SnowflakeCredentials, sql: string): Promise<QueryResult> {
    const connection = createSnowflakeConnection(credentials)
    await connectAsync(connection)
    return await executeQuery(connection, sql)
}

export async function validateSnowflakeCredentials(credentials: SnowflakeCredentials): Promise<void> {
    await runSnowflakeQuery(credentials, "SELECT 1")
}
