// import { PrismaClient } from '@prisma/client';
import { PrismaClient } from './generated/prisma';
let prisma;
export function db() {
    if (!prisma) {
        prisma = new PrismaClient();
    }
    return prisma;
}
//# sourceMappingURL=prismaClient.js.map