// Barrel re-export — auth has moved to src/domains/auth/.
// Kept here so existing importers (utility/authDispatch, utility/authMiddleware,
// agent/socket, domains/organizations/controller) continue to resolve.
export {
    WORKOS_OAUTH_STATE_COOKIE_NAME,
    WORKOS_OAUTH_STATE_COOKIE_OPTIONS,
    WORKOS_SESSION_COOKIE_NAME,
    WORKOS_SESSION_COOKIE_OPTIONS,
    clearSessionCookies,
    getOrCreateDbUserFromWorkOS,
    setSessionCookie
} from "../domains/auth/service"
export type { WorkOSAuthContext } from "../domains/auth/service"
export { callback, getWorkOSWidgetToken, login, loginUrl, logout, logoutUrl, me } from "../domains/auth/controller"
