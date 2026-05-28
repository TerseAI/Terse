export const PRODUCTION_FRONTEND_URL = "https://app.useterse.ai"
export const PRODUCTION_BACKEND_URL = "https://api.useterse.ai"
export const PRODUCTION_DOCS_URL = "https://docs.useterse.ai"

export const FRONTEND_URL = process.env.TERSE_FRONTEND_URL || PRODUCTION_FRONTEND_URL
export const DOCS_URL = process.env.TERSE_DOCS_URL || PRODUCTION_DOCS_URL
export const BACKEND_URL = process.env.TERSE_BACKEND_URL || PRODUCTION_BACKEND_URL
export const WORKOS_CLIENT_ID = process.env.TERSE_WORKOS_CLIENT_ID || "client_01KG311KNK0QM1J09RJ6R8DSC5"
