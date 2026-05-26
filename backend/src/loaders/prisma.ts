import { PrismaClient } from "@prisma/client"

import { PrismaClient as LocalPrismaClient } from "../generated/local-prisma/index.js"
import { settings } from "../settings"

let prisma: PrismaClient | undefined
let localPrisma: LocalPrismaClient | undefined

export function db(): PrismaClient {
    if (!prisma) {
        prisma = new PrismaClient()
    }
    return prisma
}

export function localDb(): LocalPrismaClient {
    if (!localPrisma) {
        localPrisma = new LocalPrismaClient({
            datasources: { db: { url: settings.local.dbUrl } }
        })
    }
    return localPrisma
}

export type { PrismaClient }
export type { LocalPrismaClient }
