import { users } from '../generated/prisma';
export declare class Jwt {
    sign(userId: string): Promise<string>;
    verify(token: string): Promise<users | null>;
    verifyGitHubApp(token: string): Promise<boolean>;
}
//# sourceMappingURL=jwt.d.ts.map