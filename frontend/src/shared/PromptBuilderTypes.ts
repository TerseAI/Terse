import { ConfigType } from './Configs';

export type SurveyQuestionType = 'single' | 'multiple';

export interface SurveyQuestion {
  question: string;
  type: SurveyQuestionType; // 'single' for radio buttons, 'multiple' for checkboxes
  allowWriteIn?: boolean; // If true, user can provide a custom text answer
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
    e: string; // Always "Skip this question"
  };
}

export interface SurveyConfigContext {
  type: ConfigType;
  details?: string;
}

export interface GenerateSurveyQuestionsRequest {
  description: string;
  existingPrompt?: string;
  inputConfigs?: SurveyConfigContext[];
  outputConfig?: SurveyConfigContext;
}

export interface GenerateSurveyQuestionsResponse {
  questions: SurveyQuestion[];
}

export interface GenerateSurveyPromptRequest {
  description: string;
  answers: Record<string, string | string[]>; // question index -> answer(s) - string for single choice, string[] for multiple choice
  writeInAnswers?: Record<string, string>; // question index -> write-in text answer
  existingPrompt?: string;
  inputConfigs?: SurveyConfigContext[];
  outputConfig?: SurveyConfigContext;
}

export interface GenerateSurveyPromptResponse {
  prompt: string;
}

