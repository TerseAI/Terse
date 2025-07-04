import { PrismaClient } from '@prisma/client';
let prisma;
export function db() {
    if (!prisma) {
        prisma = new PrismaClient();
    }
    return prisma;
}
//# sourceMappingURL=prismaClient.js.map