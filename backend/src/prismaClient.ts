import { PrismaClient } from "@prisma/client"
import { IntegrationType } from "terse-types"

import { createSecrets, deleteSecrets, getSecrets } from "./services/SecretService"

let prisma: PrismaClient | undefined

export function db(): PrismaClient {
    if (!prisma) {
        prisma = new PrismaClient()
    }
    return prisma
}

// Export the PrismaClient type for convenience
export type { PrismaClient }
