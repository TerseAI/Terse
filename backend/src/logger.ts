import { Logger as OpenTelemetryLogger, logs } from "@opentelemetry/api-logs"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { AsyncLocalStorage } from "async_hooks"
import chalk from "chalk"

import { settings } from "./config/settings"
import { User } from "./shared/types"

const config: LoggerConfig = {
    isDevelopment: settings.nodeEnv === "development",
    usePostHog: !(settings.nodeEnv === "development") || settings.posthog.enableInDevelopment,
    posthog: {
        url: "https://us.i.posthog.com/i/v1/logs",
        apiKey: settings.posthog.apiKey,
        serviceName: settings.posthog.serviceName || "terse-backend"
    },
    batchProcessor: {
        maxQueueSize: 2048,
        scheduledDelayMillis: 5000,
        exportTimeoutMillis: 30000
    },
    service: {
        name: settings.posthog.serviceName || "terse-backend",
        version: process.env.npm_package_version || "1.0.0",
        environment: settings.nodeEnv || "development"
    }
}

let sdk: NodeSDK | null = null
let logRecordProcessor: BatchLogRecordProcessor | null = null

function getOpenTelemetryLogger(): OpenTelemetryLogger | null {
    if (!config.usePostHog) {
        return null
    }
    try {
        return logs.getLogger(config.posthog.serviceName)
    } catch (error) {
        console.error("[Logger] Failed to get OpenTelemetry logger:", error)
        return null
    }
}

if (config.usePostHog) {
    try {
        const exporter = new OTLPLogExporter({
            url: config.posthog.url,
            headers: {
                Authorization: `Bearer ${config.posthog.apiKey}`,
                "Content-Type": "application/json"
            }
        })

        logRecordProcessor = new BatchLogRecordProcessor(exporter, {
            maxQueueSize: config.batchProcessor.maxQueueSize,
            scheduledDelayMillis: config.batchProcessor.scheduledDelayMillis,
            exportTimeoutMillis: config.batchProcessor.exportTimeoutMillis
        })

        sdk = new NodeSDK({
            resource: resourceFromAttributes({
                "service.name": config.service.name,
                "service.version": config.service.version,
                "deployment.environment": config.service.environment
            }),
            logRecordProcessor: logRecordProcessor
        })

        sdk.start()
    } catch (error) {
        console.error("[Logger] Failed to initialize PostHog logging:", error)
        console.error("[Logger] Server cannot start without logging. Exiting...")
        process.exit(1)
    }
}

// Validate that PostHog is properly initialized if it's enabled
if (config.usePostHog && (!sdk || !logRecordProcessor)) {
    const errorMessage = "[Logger] PostHog logging is enabled but SDK or LogRecordProcessor is not initialized. Server cannot start."
    console.error(errorMessage)
    throw new Error(errorMessage)
}

// Graceful shutdown handler to flush logs
const gracefulShutdown = async () => {
    if (logRecordProcessor) {
        try {
            await logRecordProcessor.forceFlush()
            console.log("[Logger] Flushed pending logs to PostHog")
        } catch (error) {
            console.error("[Logger] Error flushing logs:", error)
        }
    }
    if (sdk) {
        try {
            await sdk.shutdown()
            console.log("[Logger] OpenTelemetry SDK shut down")
        } catch (error) {
            console.error("[Logger] Error shutting down SDK:", error)
        }
    }
}
process.on("SIGTERM", gracefulShutdown)
process.on("SIGINT", gracefulShutdown)
process.on("beforeExit", gracefulShutdown)

// AsyncLocalStorage to store user context for logging
interface UserContext {
    userId?: string
    organizationId?: string
    userEmail?: string
}

const userContextStorage = new AsyncLocalStorage<UserContext>()

/**
 * Runs a function with the specified user context.
 * Useful for background jobs or non-request contexts.
 */
export function runWithUserContext<T>(user: User, fn: () => T): T {
    return userContextStorage.run(
        {
            userId: user.id,
            organizationId: user.organizationId,
            userEmail: user.email
        },
        fn
    )
}

/**
 * Gets the current user context from AsyncLocalStorage.
 */
function getUserContext(): UserContext | undefined {
    return userContextStorage.getStore()
}

class Logger {
    private static instance: Logger

    private constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger()
        }
        return Logger.instance
    }

    private logToConsole(level: string, message: string, attributes?: Record<string, any>): void {
        const time = new Date().toLocaleTimeString("en-US", { hour12: false })
        const upperLevel = level.toUpperCase()

        const levelColors: Record<string, (text: string) => string> = {
            DEBUG: chalk.gray,
            INFO: chalk.blue,
            WARN: chalk.yellow,
            ERROR: chalk.red
        }

        const colorFn = levelColors[upperLevel] || chalk.white
        const levelTag = colorFn(`[${upperLevel}]`)

        if (upperLevel === "ERROR" || upperLevel === "FATAL" || upperLevel === "WARN") {
            console.log(`${chalk.dim(time)} ${levelTag} ${message}, ${JSON.stringify(attributes, null, 2)}`)
        } else {
            console.log(`${chalk.dim(time)} ${levelTag} ${message}, ${JSON.stringify(attributes, null, 2)}`)
        }
    }

    private emitToPostHog(severityText: string, message: string, attributes?: Record<string, any>): void {
        const openTelemetryLogger = getOpenTelemetryLogger()

        if (!openTelemetryLogger) {
            // Fallback to console if PostHog is not initialized
            this.logToConsole(severityText, message, attributes)
            return
        }
        try {
            // Map severity text to OpenTelemetry severity number
            const severityNumber = this.getSeverityNumber(severityText)

            // Flatten attributes - OpenTelemetry/PostHog expects primitive values
            // Stringify complex objects to avoid serialization issues
            const flattenedAttributes: Record<string, string | number | boolean> = {
                "log.level": severityText,
                timestamp: new Date().toISOString()
            }

            if (attributes) {
                for (const [key, value] of Object.entries(attributes)) {
                    if (value === null || value === undefined) {
                        continue // Skip null/undefined values
                    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                        flattenedAttributes[key] = value
                    } else {
                        // Stringify complex objects/arrays
                        try {
                            flattenedAttributes[key] = JSON.stringify(value)
                        } catch (e) {
                            // If stringification fails, convert to string
                            flattenedAttributes[key] = String(value)
                        }
                    }
                }
            }

            openTelemetryLogger.emit({
                severityNumber,
                severityText: severityText.toUpperCase(),
                body: message,
                attributes: flattenedAttributes
            })
        } catch (error) {
            // Fallback to console if PostHog fails
            console.error("[Logger] Failed to emit log to PostHog:", error)
            this.logToConsole(severityText, message, attributes)
        }
    }

    private getSeverityNumber(severityText: string): number {
        const severityMap: Record<string, number> = {
            trace: 1,
            debug: 5,
            info: 9,
            warn: 13,
            error: 17,
            fatal: 21
        }
        return severityMap[severityText.toLowerCase()] || 9 // Default to INFO
    }

    /**
     * Processes attributes and automatically extracts error information if an 'error' field exists.
     * If the error field contains an Error object, it extracts the message and stack trace.
     * This allows callers to pass error objects directly without manual parsing.
     */
    private processAttributes(attributes?: Record<string, any>): Record<string, any> {
        if (!attributes) {
            return {}
        }

        const processed = { ...attributes }

        // If there's an 'error' field, process it
        if ("error" in processed) {
            const error = processed.error

            // If it's already a string (manually parsed), keep it as is
            if (typeof error === "string") {
                // Check if stack was already provided separately
                if (!("stack" in processed)) {
                    // No stack available if error is already a string
                    processed.stack = undefined
                }
            } else {
                // Process the error object
                processed.error = error instanceof Error ? error.message : String(error)
                processed.stack = error instanceof Error ? error.stack : undefined
            }
        }

        return processed
    }

    public async flush(): Promise<void> {
        if (logRecordProcessor) {
            try {
                await logRecordProcessor.forceFlush()
            } catch (error) {
                console.error("[Logger] Error flushing logs:", error)
            }
        }
    }

    private log(severityText: string, message: string, attributes?: Record<string, any>): void {
        // Get user context from AsyncLocalStorage and merge with provided attributes
        const userContext = getUserContext()
        const mergedAttributes = {
            ...(userContext?.userId && { userId: userContext.userId }),
            ...(userContext?.organizationId && {
                organizationId: userContext.organizationId
            }),
            ...(userContext?.userEmail && { userEmail: userContext.userEmail }),
            ...this.processAttributes(attributes)
        }
        if (config.usePostHog) {
            this.emitToPostHog(severityText, message, mergedAttributes)
        } else {
            this.logToConsole(severityText, message, mergedAttributes)
        }
    }

    public debug(message: string, attributes?: Record<string, any>): void {
        this.log("debug", message, attributes)
    }

    public info(message: string, attributes?: Record<string, any>): void {
        this.log("info", message, attributes)
    }

    public warn(message: string, attributes?: Record<string, any>): void {
        this.log("warn", message, attributes)
    }

    public error(message: string, attributes?: Record<string, any>): void {
        this.log("error", message, attributes)
    }
}

interface LoggerConfig {
    isDevelopment: boolean
    usePostHog: boolean
    posthog: {
        url: string
        apiKey: string
        serviceName: string
    }
    batchProcessor: {
        maxQueueSize: number
        scheduledDelayMillis: number
        exportTimeoutMillis: number
    }
    service: {
        name: string
        version: string
        environment: string
    }
}

export default Logger.getInstance()
