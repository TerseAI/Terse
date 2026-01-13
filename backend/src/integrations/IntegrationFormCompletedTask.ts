import { Task } from '../tasks/abstract/tasks';
import { IntegrationType } from '../shared/Integrations';

const INTEGRATION_FORM_COMPLETED_TASK_NAME = 'INTEGRATION_FORM_COMPLETED_TASK' as const;

export class IntegrationFormCompletedTask implements Task {
    readonly taskName = INTEGRATION_FORM_COMPLETED_TASK_NAME;

    constructor(
        public integrationType: IntegrationType,
        public integrationId: string,
        public userId: string,
        public statePayload: any, // Decoded JWT state token (may contain chat metadata)
        public timestamp: Date = new Date()
    ) {}
}
