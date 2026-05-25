export const FRONTEND_URL = process.env.TERSE_FRONTEND_URL || "https://app.useterse.ai"
export const DOCS_URL = process.env.TERSE_DOCS_URL || "https://docs.useterse.ai"
export const BACKEND_URL = process.env.TERSE_BACKEND_URL || "https://api.useterse.ai"
export const WORKOS_CLIENT_ID = process.env.TERSE_WORKOS_CLIENT_ID || "client_01KG311KNK0QM1J09RJ6R8DSC5"

// Self-hosted backends don't run WorkOS. Skip the device-code flow when the
// user is pointed at a custom backend and hasn't explicitly set a client ID
// (staging users override TERSE_WORKOS_CLIENT_ID to force the WorkOS path).
export const USE_WORKOS = !!process.env.TERSE_WORKOS_CLIENT_ID || BACKEND_URL === "https://api.useterse.ai"
