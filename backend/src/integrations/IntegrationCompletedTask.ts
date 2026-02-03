import { IntegrationType } from "../shared/Integrations"
import { Task } from "../tasks/abstract/tasks"
import { OAuthStatePayload } from "../utility/oauth"

const INTEGRATION_COMPLETED_TASK_NAME = "INTEGRATION_COMPLETED_TASK" as const

export class IntegrationCompletedTask implements Task {
    readonly taskName = INTEGRATION_COMPLETED_TASK_NAME

    constructor(
        public integrationType: IntegrationType,
        public integrationId: string,
        public userId: string,
        public statePayload: OAuthStatePayload,
        public timestamp: Date = new Date()
    ) {}
}
