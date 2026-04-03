/**
 * Frontend route path constants.
 *
 * Generated from JSON into TypeScript with `as const` so route strings remain
 * literal types and `buildRoute()` can infer required params like `:id`.
 */
export { FrontendRoutes } from "./FrontendRoutes.generated"

/** Query param added when redirecting from Home/AgentBuilderLayout chat to agent page; AgentSetupTab clears session when present */
export const FROM_SETUP_CHAT_PARAM = "fromSetupChat"
