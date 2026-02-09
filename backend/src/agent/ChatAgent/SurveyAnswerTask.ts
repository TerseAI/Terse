import { Task } from "../../tasks/abstract/tasks"

export const SURVEY_ANSWER_TASK_NAME = "SURVEY_ANSWER_TASK" as const

export class SurveyAnswerTask implements Task {
    readonly taskName = SURVEY_ANSWER_TASK_NAME
    constructor(
        public questionId: string,
        public answer: string,
        public userId: string,
        public sessionId: string,
        public timestamp: Date = new Date()
    ) {}
}
