import { PrismaClient } from '@prisma/client';
// import { PrismaClient } from './generated/prisma'


let prisma: PrismaClient | undefined;

export function db(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// Export the PrismaClient type for convenience
export type { PrismaClient }; 