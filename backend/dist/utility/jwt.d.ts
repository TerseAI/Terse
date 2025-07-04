import { users } from '../generated/prisma';
export declare class Jwt {
    sign(userId: string): Promise<string>;
    verify(token: string): Promise<users | null>;
}
//# sourceMappingURL=jwt.d.ts.map