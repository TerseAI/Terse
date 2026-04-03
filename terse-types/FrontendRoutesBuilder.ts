/**
 * Frontend route path constants
 *
 * These constants standardize frontend route paths across the application,
 * preventing magic strings and making refactoring easier.
 *
 * Dynamic routes use route objects with both React Router patterns and URL builders
 * to ensure consistency across navigation calls and route definitions.
 */
import frontendRoutes from "./FrontendRoutes.json" with { type: "json" }

/** Query param added when redirecting from Home/AgentBuilderLayout chat to agent page; AgentSetupTab clears session when present */
export const FROM_SETUP_CHAT_PARAM = "fromSetupChat"

export const FrontendRoutes = frontendRoutes
