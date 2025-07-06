import { User } from "./prisma.js";
import { TicketManager } from "src/ticketing/TicketIntegration";
export declare function login(email: string, password: string): Promise<User | null>;
export declare function findUserByEmail(email: string): Promise<User | null>;
export declare function findUserByGitHubUsername(githubUsername: string): Promise<User | null>;
export declare function findUserById(id: string): Promise<User | null>;
export declare function createUser(displayName: string, email: string, githubUsername: string): Promise<User>;
export declare function getOrCreateUserForImport(email: string, displayName?: string): Promise<User>;
export declare function updateUserGitHubUsername(userId: string, githubUsername: string): Promise<User>;
export declare function createPlaceholderUser(email: string, displayName?: string): Promise<User>;
export declare function getUserTicketManager(userId: string): Promise<TicketManager | null>;
//# sourceMappingURL=user.d.ts.map