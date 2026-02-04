export const POST_LOGIN_REDIRECT_KEY = "terse_post_login_redirect"

export function isSafeRedirectPath(path: string): boolean {
    return path.startsWith("/") && !path.startsWith("//")
}
