import { RunStreamEvent } from "@openai/agents"

import { INTEGRATION_COMPLETED_TASK_NAME, type IntegrationCompletedTask } from "../../../integrations/IntegrationCompletedTask"
import { INTEGRATION_FORM_COMPLETED_TASK_NAME, type IntegrationFormCompletedTask } from "../../../integrations/IntegrationFormCompletedTask"
import { integrationFormTaskQueue, integrationTaskQueue } from "../../../integrations/IntegrationTaskQueues"
import { ConfigType } from "../../../shared/Configs"
import { IntegrationType } from "../../../shared/Integrations"
import type { MultipleChoiceQuestion } from "../../../shared/Survey"
import { SURVEY_ANSWER_TASK_NAME, type SurveyAnswerTask } from "../SurveyAnswerTask"
import { surveyAnswerTaskQueue } from "../SurveyAnswerTaskQueue"

abstract class ChatInterface {
    abstract name: string
    protected readonly sessionId: string
    protected readonly userId: string
    protected readonly organizationId: string | undefined

    constructor(sessionId: string, userId: string, organizationId?: string) {
        this.sessionId = sessionId
        this.userId = userId
        this.organizationId = organizationId
    }

    abstract promptForIntegration(integration: IntegrationType): Promise<string>
    abstract promptForConfig(config: ConfigType): Promise<string>
    abstract askSurveyQuestion(multipleChoiceQuestion: MultipleChoiceQuestion): Promise<string>
    abstract processStreamEvent(sessionId: string, event: RunStreamEvent): void
    abstract processMessageEnd(sessionId: string, finalOutput: string): Promise<void>
    abstract buildButton(label: string, url: string): Promise<void>
    abstract navigate(path: string): Promise<void>

    async getUserTimezone(): Promise<string | null> {
        return null
    }

    /**
     * Blocks until the user completes the integration (OAuth or form) or the timeout expires.
     * Resolves on the first matching completion across both queues.
     */
    protected async waitForIntegrationCompletion(integration: IntegrationType, options?: { timeoutMs?: number }): Promise<{ integrationId: string; integrationType: IntegrationType }> {
        const timeoutMs = options?.timeoutMs ?? 120_000
        const org = this.organizationId ?? ""

        const oauthPredicate = (task: IntegrationCompletedTask) => task.integrationType === integration && task.userId === this.userId && (task.statePayload?.organizationId ?? "") === org

        const formPredicate = (task: IntegrationFormCompletedTask) => task.integrationType === integration && task.userId === this.userId && task.organizationId === (this.organizationId ?? "")

        const oauthPromise = integrationTaskQueue
            .waitFor(INTEGRATION_COMPLETED_TASK_NAME, oauthPredicate, { timeoutMs })
            .then(t => ({ integrationId: t.integrationId, integrationType: t.integrationType }))
            .catch(() => undefined)

        const formPromise = integrationFormTaskQueue
            .waitFor(INTEGRATION_FORM_COMPLETED_TASK_NAME, formPredicate, { timeoutMs })
            .then(t => ({ integrationId: t.integrationId, integrationType: t.integrationType }))
            .catch(() => undefined)

        const result = await Promise.any([oauthPromise, formPromise])
        if (result === undefined) {
            throw new Error("Integration timed out")
        }
        return result
    }

    /**
     * Blocks until the user answers the survey question or the timeout expires.
     * Resolves with the answer string on success, throws on timeout.
     */
    protected async waitForSurveyAnswer(questionId: string, options?: { timeoutMs?: number }): Promise<string> {
        const timeoutMs = options?.timeoutMs ?? 120_000

        const predicate = (task: SurveyAnswerTask) => task.questionId === questionId && task.userId === this.userId && task.sessionId === this.sessionId

        const task = await surveyAnswerTaskQueue.waitFor(SURVEY_ANSWER_TASK_NAME, predicate, { timeoutMs })
        return task.answer
    }
}

export default ChatInterface
