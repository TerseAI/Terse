import { Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import { LinearIntegration } from "../shared/types";

export class LinearIntegrationManager implements Integration<LinearIntegration, never> {
    constructor() { }

    async getInstancesForUser(userId: string): Promise<LinearIntegration[]> {
        const linearKeys = await db().linear_api_keys.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                workspace_id: true,
                workspace_name: true,
                team_id: true,
                team_name: true,
            }
        });
        return linearKeys.map(lk => ({
            id: lk.id,
            workspaceName: lk.workspace_name || undefined,
            linearTeamId: lk.team_id || undefined,
            linearTeamName: lk.team_name || undefined,
        }));
    }

    async processWebhookEvent(event: never): Promise<void> {
        // Linear webhooks are handled elsewhere
        throw new Error("Linear webhooks are not processed through this integration manager");
    }
}

