/**
 * Centralized environment variable configuration
 *
 * This module validates all required environment variables at startup
 * and provides a single source of truth for environment configuration.
 * The application will fail to start if any required variables are missing.
 */

export abstract class SettingsDependant {
    readonly settingsKey: keyof typeof settings | null = null

    get isAvailable(): boolean {
        return this.settingsKey === null || settings[this.settingsKey] !== undefined
    }

    get config(): NonNullable<(typeof settings)[Exclude<this["settingsKey"], null>]> {
        if (this.settingsKey === null) {
            throw new Error(`SettingsDependant ${this.settingsKey} has no settings key`)
        }
        const value = settings[this.settingsKey]
        if (value === undefined) {
            throw new Error(`SettingsDependant ${this.settingsKey} is not configured`)
        }
        return value as NonNullable<(typeof settings)[Exclude<this["settingsKey"], null>]>
    }
}

// Core configuration
export const settings = {
    // Core secrets and keys
    jwt: {
        secret: requireSecretMinLength("JWT_SECRET")
    },

    // Database connections
    database: {
        url: requireEnv("DATABASE_URL")
    },

    // Dedicated Redis for BullMQ queues + RedisTaskQueue pub/sub. REQUIRED — the backend and worker
    // refuse to start without it. Must be configured with maxmemory-policy=noeviction (BullMQ drops
    // queued jobs under any eviction policy). Kept separate from REDIS_URL (cache/socket adapter).
    queue: {
        redisUrl: requireEnv("BULLMQ_REDIS_URL")
    },

    // WorkOS — opt-in. Present means AuthProvider picks WorkOS; absent means LocalAuthProvider.
    workos: optionalIntegrationSettings(["WORKOS_CLIENT_ID", "WORKOS_API_KEY", "WORKOS_COOKIE_PASSWORD", "WORKOS_REDIRECT_URI", "WORKOS_WEBHOOK_SECRET"], () => ({
        clientId: requireEnv("WORKOS_CLIENT_ID"),
        apiKey: requireEnv("WORKOS_API_KEY"),
        cookiePassword: requireSecretMinLength("WORKOS_COOKIE_PASSWORD"),
        redirectUri: requireEnv("WORKOS_REDIRECT_URI"),
        webhookSecret: requireSecretMinLength("WORKOS_WEBHOOK_SECRET")
    })),

    // Local SQLite — holds everything cloud delegates to external services (auth, secrets, ...).
    // Used by Local* providers when the cloud equivalent isn't configured.
    // Note: Prisma CLI also needs LOCAL_DB_URL set in .env for migration commands (it can't
    // read this TS default). The runtime default below is a defensive fallback only.
    local: {
        dbUrl: optionalEnv("LOCAL_DB_URL", "file:./prisma/local/local.db"),
        secretsEncryptionKey: optionalEnv("LOCAL_SECRETS_ENCRYPTION_KEY")
    },

    openai: {
        apiKey: optionalEnv("OPENAI_API_KEY")
    },

    tavily: {
        apiKey: optionalEnv("TAVILY_API_KEY")
    },

    gemini: {
        apiKey: optionalEnv("GEMINI_API_KEY")
    },

    // Application URLs
    urls: {
        socketFrontend: optionalEnv("SOCKET_FRONTEND_URL"),
        frontend: requireEnv("FRONTEND_URL"),
        backend: requireEnv("BACKEND_URL"),
        backendProxy: optionalEnv("BACKEND_PROXY_URL"),
        internalBackend: optionalEnv("INTERNAL_BACKEND_URL", "http://localhost:3001")
    },

    // Environment
    nodeEnv: optionalEnv("NODE_ENV", "development") as "development" | "production" | "test",

    health: {
        checkPath: optionalEnv("HEALTH_CHECK_PATH", "/healthz")
    },

    // Gmail OAuth — opt-in
    gmail: optionalIntegrationSettings(["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REDIRECT_URI", "GMAIL_PUBSUB_TOPIC", "GMAIL_FRONTEND_REDIRECT"], () => ({
        clientId: requireEnv("GMAIL_CLIENT_ID"),
        clientSecret: requireEnv("GMAIL_CLIENT_SECRET"),
        redirectUri: requireEnv("GMAIL_REDIRECT_URI"),
        pubsubTopic: requireEnv("GMAIL_PUBSUB_TOPIC"),
        frontendRedirect: requireEnv("GMAIL_FRONTEND_REDIRECT"),

        // OIDC verification for inbound Pub/Sub push deliveries.
        pubsubAudience: optionalEnv("GMAIL_PUBSUB_AUDIENCE"),
        pubsubServiceAccountEmail: optionalEnv("GMAIL_PUBSUB_SERVICE_ACCOUNT_EMAIL")
    })),

    // GitHub App (for repository integration and OAuth) — opt-in
    githubApp: optionalIntegrationSettings(["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_APP_CALLBACK_URL", "GITHUB_APP_NAME"], () => ({
        clientId: requireEnv("GITHUB_CLIENT_ID"),
        clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
        integrateCallbackUrl: requireEnv("GITHUB_APP_CALLBACK_URL"),
        loginCallbackUrl: optionalEnv("GITHUB_LOGIN_CALLBACK_URL"),
        appName: requireEnv("GITHUB_APP_NAME"),
        loginRedirect: optionalEnv("GITHUB_LOGIN_REDIRECT")
    })),

    // Notion OAuth — opt-in
    notion: optionalIntegrationSettings(["NOTION_OAUTH_CLIENT_ID", "NOTION_OAUTH_CLIENT_SECRET", "NOTION_OAUTH_REDIRECT_URI"], () => ({
        clientId: requireEnv("NOTION_OAUTH_CLIENT_ID"),
        clientSecret: requireEnv("NOTION_OAUTH_CLIENT_SECRET"),
        redirectUri: requireEnv("NOTION_OAUTH_REDIRECT_URI")
    })),

    // Slack OAuth — opt-in
    slack: optionalIntegrationSettings(["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "SLACK_OAUTH_CALLBACK_URL"], () => ({
        clientId: requireEnv("SLACK_CLIENT_ID"),
        clientSecret: requireEnv("SLACK_CLIENT_SECRET"),
        oauthCallbackUrl: requireEnv("SLACK_OAUTH_CALLBACK_URL"),
        signingSecret: optionalEnv("SLACK_SIGNING_SECRET")
    })),

    // Linear OAuth — opt-in
    linear: optionalIntegrationSettings(["LINEAR_CLIENT_ID", "LINEAR_CLIENT_SECRET_ID", "LINEAR_OAUTH_CALLBACK_URL", "LINEAR_WEBHOOK_SIGNING_SECRET"], () => ({
        clientId: requireEnv("LINEAR_CLIENT_ID"),
        clientSecret: requireEnv("LINEAR_CLIENT_SECRET_ID"),
        oauthCallbackUrl: requireEnv("LINEAR_OAUTH_CALLBACK_URL"),
        signingSecret: requireSecretMinLength("LINEAR_WEBHOOK_SIGNING_SECRET")
    })),

    // Attio OAuth — opt-in
    attio: optionalIntegrationSettings(["ATTIO_CLIENT_ID", "ATTIO_CLIENT_SECRET", "ATTIO_REDIRECT_URI"], () => ({
        clientId: requireEnv("ATTIO_CLIENT_ID"),
        clientSecret: requireEnv("ATTIO_CLIENT_SECRET"),
        redirectUri: requireEnv("ATTIO_REDIRECT_URI")
    })),

    // Google Cloud Platform — opt-in. Powers GoogleSecretManagerClient, Cloud Scheduler, GCS uploads.
    gcp: optionalIntegrationSettings(["GCP_SERVICE_ACCOUNT_BASE64", "GCP_PROJECT_ID"], () => ({
        serviceAccountBase64: requireEnv("GCP_SERVICE_ACCOUNT_BASE64"),
        projectId: requireEnv("GCP_PROJECT_ID"),
        region: optionalEnv("GCP_REGION", "us-central1")
    })),

    // Google Cloud Storage
    gcs: {
        imageBucket: optionalEnv("GCS_IMAGE_BUCKET", "terse-documents"),
        imagePrefix: optionalEnv("GCS_IMAGE_PREFIX", "events/images")
    },

    // Posthog Logs
    posthog: {
        apiKey: optionalEnv("POSTHOG_API_KEY"),
        serviceName: optionalEnv("POSTHOG_SERVICE_NAME", "terse-backend"),
        enableInDevelopment: optionalEnv("POSTHOG_ENABLE_IN_DEV", "false") === "true",
        host: optionalEnv("POSTHOG_HOST", "https://us.i.posthog.com")
    },

    anthropic: {
        apiKey: optionalEnv("ANTHROPIC_API_KEY"),
        improvementApiKey: optionalEnv("ANTHROPIC_IMPROVEMENT_API_KEY"),
        improvementWorkspaceId: optionalEnv("ANTHROPIC_IMPROVEMENT_WORKSPACE_ID")
    },

    // LiteLLM proxy — opt-in. When set, improvement reviews mint a per-job virtual key instead of handing out the platform key.
    litellm: optionalIntegrationSettings(["LITELLM_BASE_URL", "LITELLM_MASTER_KEY"], () => ({
        baseUrl: requireEnv("LITELLM_BASE_URL"),
        masterKey: requireSecretMinLength("LITELLM_MASTER_KEY"),
        perJobBudgetUsd: Number(optionalEnv("LITELLM_PER_JOB_BUDGET_USD", "5")),
        keyTtl: optionalEnv("LITELLM_KEY_TTL", "20m"),
        rpm: Number(optionalEnv("LITELLM_KEY_RPM", "60"))
    })),

    // Modal — opt-in. Used by ModalSandboxService; absent falls through to LocalSandboxService.
    modal: optionalIntegrationSettings(["MODAL_TOKEN_ID", "MODAL_TOKEN_SECRET"], () => ({
        tokenId: requireEnv("MODAL_TOKEN_ID"),
        tokenSecret: requireEnv("MODAL_TOKEN_SECRET")
    })),

    // Dev-only: hoist locally-built terse-types/terse-sdk/terse-cli into sandboxes instead of
    // installing from npm. Requires a monorepo checkout on the same machine as the backend.
    // MUST never be set in production — it is the sole gate for the local-package code path.
    devLocalPackages: optionalBoolEnv("TERSE_DEV_LOCAL_PACKAGES") ? { monorepoRoot: requireEnv("TERSE_LOCAL_PACKAGES_ROOT") } : undefined,

    // Resend — opt-in. Used by ResendEmailProvider; absent falls through to NoOpEmailProvider.
    resend: optionalIntegrationSettings(["RESEND_API_KEY"], () => ({
        apiKey: requireEnv("RESEND_API_KEY"),
        fromEmail: optionalEnv("RESEND_FROM_EMAIL", "notifications@updates.useterse.ai")
    })),

    // Optional configuration
    optional: {
        redisUrl: optionalEnv("REDIS_URL"),
        cookieDomain: optionalEnv("COOKIE_DOMAIN"),
        corsAllowedOrigins: optionalEnv("CORS_ALLOWED_ORIGINS")
    },

    // Parallel (Web Event monitors + webhook verification) — opt-in
    parallel: optionalIntegrationSettings(["PARALLEL_API_KEY", "PARALLEL_WEBHOOK_SECRET"], () => ({
        apiKey: requireEnv("PARALLEL_API_KEY"),
        webhookSecret: requireSecretMinLength("PARALLEL_WEBHOOK_SECRET")
    })),

    aisdk: {
        default: optionalEnv("MODEL_DEFAULT", "anthropic:claude-opus-4-7")
    },

    billing: {
        enabled: optionalBoolEnv("BILLING_ENABLED"),
        url: optionalEnv("BILLING_SERVICE_URL"),
        jwtSecret: optionalEnv("BILLING_JWT_SECRET")
    }
} as const

if (settings.billing.enabled && (!settings.billing.url || !settings.billing.jwtSecret)) {
    throw new Error("BILLING_ENABLED is true but BILLING_SERVICE_URL or BILLING_JWT_SECRET is missing. Set both, or unset BILLING_ENABLED.")
}

// Export individual always-on settings for convenience. Opt-in integration blocks
// (gmail, githubApp, notion, slack, linear, attio, parallel) must be
// accessed via `settings.<name>` so the `T | undefined` type forces narrowing.
export const { jwt, gemini, urls, gcs, optional, queue } = settings

// OAuth token refresh threshold
// If a token is expiring within this time window, it will be refreshed proactively
export const OAUTH_TOKEN_REFRESH_THRESHOLD_MS = 12 * 60 * 60 * 1000 // 12 hours in milliseconds

// Helpers

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value || value.trim() === "") {
        throw new Error(`Missing required environment variable: ${name}. ` + `Please set ${name} in your environment configuration.`)
    }
    return value
}

function requireSecretMinLength(name: string, minLen = 16): string {
    const value = requireEnv(name)
    if (value.length < minLen) {
        throw new Error(`Environment variable ${name} is too short (got ${value.length} chars, need at least ${minLen}).`)
    }
    return value
}

function optionalEnv(name: string): string | undefined
function optionalEnv(name: string, defaultValue: string): string
function optionalEnv(name: string, defaultValue?: string): string | undefined {
    const value = process.env[name]
    if (value && value.trim() !== "") {
        return value
    }
    return defaultValue
}

function optionalBoolEnv(name: string, defaultValue = false): boolean {
    const value = optionalEnv(name)

    if (value === undefined) {
        return defaultValue
    }

    if (value === "true") {
        return true
    }

    if (value === "false") {
        return false
    }

    throw new Error(`Invalid boolean environment variable: ${name}. Expected "true" or "false".`)
}

/**
 * Builds an opt-in integration config block. If none of the listed env vars are set, returns `undefined`
 * so the integration registers as "unavailable" and self-hosters can skip it. If any are set but the
 * builder throws (e.g. a missing requireEnv), the error propagates — partial configuration is misconfig.
 */
function optionalIntegrationSettings<T>(envNames: readonly string[], build: () => T): T | undefined {
    const anySet = envNames.some(n => {
        const v = process.env[n]
        return v !== undefined && v.trim() !== ""
    })
    if (!anySet) return undefined
    return build()
}
