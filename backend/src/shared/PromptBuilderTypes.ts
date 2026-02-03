import { ConfigType } from "./Configs"

export const SKIP_OPTION = "e" as const

export type SurveyQuestionType = "single" | "multiple"

export interface SurveyQuestion {
    question: string
    type: SurveyQuestionType // 'single' for radio buttons, 'multiple' for checkboxes
    allowWriteIn?: boolean // If true, user can provide a custom text answer
    options: {
        a: string
        b: string
        c: string
        d: string
        e: string // Always "Skip this question"
    }
}

export interface SurveyConfigContext {
    type: ConfigType
}

export type SurveyAnswers = Record<string, string | string[]>
export type SurveyWriteInAnswers = Record<string, string>

export interface GenerateSurveyQuestionsRequest {
    description: string
    existingPrompt?: string
    inputConfigs?: SurveyConfigContext[]
    outputConfigs?: SurveyConfigContext[]
    knowledgeBaseConfigs?: SurveyConfigContext[]
}

export interface GenerateSurveyQuestionsResponse {
    questions: SurveyQuestion[]
}

export interface GenerateSurveyPromptRequest {
    description: string
    questions: SurveyQuestion[]
    answers: SurveyAnswers
    writeInAnswers?: SurveyWriteInAnswers
    existingPrompt?: string
    inputConfigs?: SurveyConfigContext[]
    outputConfigs?: SurveyConfigContext[]
    knowledgeBaseConfigs?: SurveyConfigContext[]
}

export interface GenerateSurveyPromptResponse {
    prompt: string
}
