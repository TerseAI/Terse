import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { BackendProvider } from "@/services/backend";
import { SurveyQuestion, GenerateSurveyQuestionsRequest, GenerateSurveyPromptRequest, SurveyConfigContext, SurveyAnswers, SurveyWriteInAnswers } from "@/shared/PromptBuilderTypes";
import { PromptBuilderModalProps } from "./types";
import { Step1Description } from "./Step1Description";
import { Step2Survey } from "./Step2Survey";
import { Step3Review } from "./Step3Review";

export function PromptBuilderModal({
    isOpen,
    onClose,
    inputs,
    output,
    existingPrompt,
    onPromptGenerated
}: PromptBuilderModalProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
    const [answers, setAnswers] = useState<SurveyAnswers>({});
    const [writeInAnswers, setWriteInAnswers] = useState<SurveyWriteInAnswers>({});
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    const prepareConfigContext = (): { inputConfigs?: SurveyConfigContext[]; outputConfig?: SurveyConfigContext } => {
        const inputConfigs: SurveyConfigContext[] = inputs.map(input => ({
            type: input.config.configType
        }));
        
        const outputConfig: SurveyConfigContext | undefined = output ? {
            type: output.config.configType
        } : undefined;

        return { inputConfigs, outputConfig };
    };

    const handleStep1Continue = async () => {
        if (!description.trim()) return;
        
        setIsLoadingQuestions(true);
        setError(null);
        
        try {
            const { inputConfigs, outputConfig } = prepareConfigContext();

            const request: GenerateSurveyQuestionsRequest = {
                description: description.trim(),
                existingPrompt,
                inputConfigs,
                outputConfig
            };

            const response = await BackendProvider.generatePromptBuilderQuestions(request);
            
            setQuestions(response.questions);
            setAnswers({});
            setCurrentQuestionIndex(0);
            setStep(2);
        } catch (err: any) {
            setError(err.message || 'Failed to generate questions. Please try again.');
        } finally {
            setIsLoadingQuestions(false);
        }
    };

    const handleStep2Continue = async () => {
        setIsLoadingPrompt(true);
        setError(null);
        
        try {
            const { inputConfigs, outputConfig } = prepareConfigContext();

            const request: GenerateSurveyPromptRequest = {
                description: description.trim(),
                questions,
                answers,
                writeInAnswers,
                existingPrompt,
                inputConfigs,
                outputConfig
            };

            const response = await BackendProvider.generatePromptBuilderPrompt(request);
            
            setGeneratedPrompt(response.prompt);
            setStep(3);
        } catch (err: any) {
            setError(err.message || 'Failed to generate prompt. Please try again.');
        } finally {
            setIsLoadingPrompt(false);
        }
    };

    const handleRestart = () => {
        setStep(1);
        setDescription('');
        setQuestions([]);
        setAnswers({});
        setWriteInAnswers({});
        setGeneratedPrompt('');
        setError(null);
        setCurrentQuestionIndex(0);
    };

    const handleAnswerChange = (questionIndex: number, answer: string, questionType: 'single' | 'multiple') => {
        const key = String(questionIndex);
        if (questionType === 'single') {
            setAnswers(prev => ({ ...prev, [key]: answer }));
        } else {
            setAnswers(prev => {
                const current = prev[key];
                const currentArray = Array.isArray(current) ? current : (current ? [current] : []);
                
                if (answer === 'e') {
                    return { ...prev, [key]: ['e'] };
                }
                
                let newArray = currentArray.filter(a => a !== 'e');
                
                if (newArray.includes(answer)) {
                    newArray = newArray.filter(a => a !== answer);
                } else {
                    newArray.push(answer);
                }
                
                return { ...prev, [key]: newArray.length > 0 ? newArray : [] };
            });
        }
    };

    const handleWriteInChange = (questionIndex: number, value: string) => {
        setWriteInAnswers(prev => ({
            ...prev,
            [String(questionIndex)]: value
        }));
    };

    const handleDone = () => {
        if (generatedPrompt && onPromptGenerated) {
            onPromptGenerated(generatedPrompt);
        }
        onClose();
    };

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            handleRestart();
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[75%] max-w-none sm:max-w-none max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Prompt Builder
                        <span className="text-sm font-normal text-muted-foreground">
                            Step {step} of 3
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div className="py-4">
                    {step === 1 && (
                        <Step1Description
                            description={description}
                            setDescription={setDescription}
                            isLoading={isLoadingQuestions}
                            onContinue={handleStep1Continue}
                        />
                    )}

                    {step === 2 && (
                        <Step2Survey
                            questions={questions}
                            answers={answers}
                            writeInAnswers={writeInAnswers}
                            currentQuestionIndex={currentQuestionIndex}
                            setCurrentQuestionIndex={setCurrentQuestionIndex}
                            onAnswerChange={handleAnswerChange}
                            onWriteInChange={handleWriteInChange}
                            isLoading={isLoadingPrompt}
                            onBack={() => setStep(1)}
                            onContinue={handleStep2Continue}
                        />
                    )}

                    {step === 3 && (
                        <Step3Review
                            generatedPrompt={generatedPrompt}
                            onRestart={handleRestart}
                            onDone={handleDone}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

