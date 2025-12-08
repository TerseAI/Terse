import { ChannelInput, ChannelOutput } from "@/shared/types";
import { SurveyQuestion } from "@/shared/PromptBuilderTypes";

export interface PromptBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    inputs: ChannelInput[];
    output: ChannelOutput | undefined;
    existingPrompt?: string;
    onPromptGenerated?: (prompt: string) => void;
}

export interface Step1DescriptionProps {
    description: string;
    setDescription: (description: string) => void;
    isLoading: boolean;
    onContinue: () => void;
}

export interface Step2SurveyProps {
    questions: SurveyQuestion[];
    answers: Record<number, string | string[]>;
    writeInAnswers: Record<number, string>;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: (index: number) => void;
    onAnswerChange: (questionIndex: number, answer: string, questionType: 'single' | 'multiple') => void;
    onWriteInChange: (questionIndex: number, value: string) => void;
    isLoading: boolean;
    onBack: () => void;
    onContinue: () => void;
}

export interface Step3ReviewProps {
    generatedPrompt: string;
    onRestart: () => void;
    onDone: () => void;
}

