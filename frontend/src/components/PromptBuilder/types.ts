import { SurveyAnswers, SurveyQuestion, SurveyWriteInAnswers } from "@/shared/PromptBuilderTypes"
import { AgentKnowledgeBase, AgentOutput, AgentTrigger } from "@/shared/types"

export interface PromptBuilderModalProps {
    isOpen: boolean
    onClose: () => void
    inputs: AgentTrigger[]
    outputs: AgentOutput[]
    knowledgeBases?: AgentKnowledgeBase[]
    existingPrompt?: string
    onPromptGenerated?: (prompt: string) => void
}

export interface Step1DescriptionProps {
    description: string
    setDescription: (description: string) => void
    isLoading: boolean
}

export interface Step2SurveyProps {
    questions: SurveyQuestion[]
    answers: SurveyAnswers
    writeInAnswers: SurveyWriteInAnswers
    onAnswerChange: (questionIndex: number, answer: string, questionType: "single" | "multiple") => void
    onWriteInChange: (questionIndex: number, value: string) => void
    isLoading: boolean
    allQuestionsAnswered: boolean
    onBack: () => void
    onContinue: () => void
}

export interface Step3ReviewProps {
    generatedPrompt: string
    isLoading: boolean
    onRestart: () => void
    onDone: () => void
}
