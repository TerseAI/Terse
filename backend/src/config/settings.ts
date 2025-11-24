/**
 * Centralized environment variable configuration
 * 
 * This module validates all required environment variables at startup
 * and provides a single source of truth for environment configuration.
 * The application will fail to start if any required variables are missing.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Please set ${name} in your environment configuration.`
    );
  }
  return value;
}

function optionalEnv(name: string, defaultValue?: string): string | undefined {
  const value = process.env[name];
  if (value && value.trim() !== '') {
    return value;
  }
  return defaultValue;
}

// Core configuration
export const settings = {
  // Core secrets and keys
  jwt: {
    secret: requireEnv('JWT_SECRET'),
  },

  // Database connections
  database: {
    url: requireEnv('DATABASE_URL'),
    searchUrl: requireEnv('SEARCH_DATABASE_URL'),
  },

  // API keys
  openai: {
    apiKey: requireEnv('OPENAI_API_KEY'),
  },

  // Application URLs
  urls: {
    socketFrontend: optionalEnv('SOCKET_FRONTEND_URL'),
    frontend: requireEnv('FRONTEND_URL'),
    backend: optionalEnv('BACKEND_URL', 'http://localhost:3001'),
  },

  // Environment
  nodeEnv: optionalEnv('NODE_ENV', 'development') as 'development' | 'production' | 'test',

  // Gmail OAuth
  gmail: {
    clientId: requireEnv('GMAIL_CLIENT_ID'),
    clientSecret: requireEnv('GMAIL_CLIENT_SECRET'),
    redirectUri: requireEnv('GMAIL_REDIRECT_URI'),
    pubsubTopic: requireEnv('GMAIL_PUBSUB_TOPIC'),
    frontendRedirect: requireEnv('GMAIL_FRONTEND_REDIRECT'),
  },

  // GitHub Auth (for login)
  // githubAuth: {
  //   clientId: requireEnv('GITHUB_AUTH_CLIENT_ID'),
  //   clientSecret: requireEnv('GITHUB_AUTH_CLIENT_SECRET'),
  //   callbackUrl: requireEnv('GITHUB_CALLBACK_URL'),
  //   loginRedirect: requireEnv('GITHUB_LOGIN_REDIRECT'),
  // },

  // GitHub App (for repository integration)
  githubApp: {
    clientId: requireEnv('GITHUB_CLIENT_ID'),
    clientSecret: requireEnv('GITHUB_CLIENT_SECRET'),
    integrateCallbackUrl: requireEnv('GITHUB_APP_CALLBACK_URL'),
    loginCallbackUrl: requireEnv('GITHUB_LOGIN_CALLBACK_URL'),
    appName: requireEnv('GITHUB_APP_NAME'),
    loginRedirect: requireEnv('GITHUB_LOGIN_REDIRECT'),
  },

  // Google Auth (reuses Gmail client credentials)
  googleAuth: {
    callbackUrl: requireEnv('GOOGLE_AUTH_CALLBACK_URL'),
    loginRedirect: requireEnv('GOOGLE_LOGIN_REDIRECT'),
  },

  // Notion OAuth
  notion: {
    clientId: requireEnv('NOTION_OAUTH_CLIENT_ID'),
    clientSecret: requireEnv('NOTION_OAUTH_CLIENT_SECRET'),
    redirectUri: requireEnv('NOTION_OAUTH_REDIRECT_URI'),
  },

  // Figma OAuth
  figma: {
    clientId: requireEnv('FIGMA_CLIENT_ID'),
    clientSecret: requireEnv('FIGMA_CLIENT_SECRET'),
    redirectUrl: requireEnv('FIGMA_REDIRECT_URL'),
  },

  // Slack OAuth
  slack: {
    clientId: requireEnv('SLACK_CLIENT_ID'),
    clientSecret: requireEnv('SLACK_CLIENT_SECRET'),
    oauthCallbackUrl: requireEnv('SLACK_OAUTH_CALLBACK_URL'),
    signingSecret: optionalEnv('SLACK_SIGNING_SECRET'),
  },

  // Linear OAuth
  linear: {
    clientId: requireEnv('LINEAR_CLIENT_ID'),
    clientSecret: requireEnv('LINEAR_CLIENT_SECRET_ID'),
    oauthCallbackUrl: requireEnv('LINEAR_OAUTH_CALLBACK_URL'),
    signingSecret: requireEnv('LINEAR_WEBHOOK_SIGNING_SECRET'),
  },

  // Atlassian OAuth
  atlassian: {
    clientId: requireEnv('ATLASSIAN_CLIENT_ID'),
    clientSecret: requireEnv('ATLASSIAN_CLIENT_SECRET'),
    callbackUrl: requireEnv('ATLASSIAN_CALLBACK_URL'),
  },

  // Cloud Scheduler (for cron jobs)
  cloudScheduler: {
    secret: requireEnv('CLOUD_SCHEDULER_SECRET'),
  },

  // Optional configuration
  optional: {
    redisUrl: optionalEnv('REDIS_URL'),
    cookieDomain: optionalEnv('COOKIE_DOMAIN'),
  },
} as const;

// Export individual settings for convenience
export const {
  jwt,
  database,
  openai,
  urls,
  nodeEnv,
  gmail,
  githubApp,
  googleAuth,
  notion,
  figma,
  slack,
  cloudScheduler,
  optional,
} = settings;

// Type exports
export type Settings = typeof settings;


