import { PrismaClient } from "@prisma/client"

import { PrismaClient as LocalAuthPrismaClient } from "../generated/local-auth-prisma"
import { settings } from "../settings"

let prisma: PrismaClient | undefined
let localAuthPrisma: LocalAuthPrismaClient | undefined

export function db(): PrismaClient {
    if (!prisma) {
        prisma = new PrismaClient()
    }
    return prisma
}

export function localAuthDb(): LocalAuthPrismaClient {
    if (!localAuthPrisma) {
        localAuthPrisma = new LocalAuthPrismaClient({
            datasources: { db: { url: settings.localAuth.dbUrl } }
        })
    }
    return localAuthPrisma
}

// Export the PrismaClient types for convenience
export type { PrismaClient }
export type { LocalAuthPrismaClient }
