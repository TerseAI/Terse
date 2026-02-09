import { IntegrationType } from "../shared/Integrations"
import { Task } from "../tasks/abstract/tasks"
import { OAuthStatePayload } from "../utility/oauth"

export const INTEGRATION_FORM_COMPLETED_TASK_NAME = "INTEGRATION_FORM_COMPLETED_TASK" as const

export class IntegrationFormCompletedTask implements Task {
    readonly taskName = INTEGRATION_FORM_COMPLETED_TASK_NAME

    constructor(
        public integrationType: IntegrationType,
        public integrationId: string,
        public userId: string,
        public organizationId: string,
        public statePayload: OAuthStatePayload,
        public timestamp: Date = new Date()
    ) {}
}
