import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BackendProvider } from "@/services/backend";
import { SurveyQuestion, GenerateSurveyQuestionsRequest, GenerateSurveyPromptRequest, SurveyConfigContext, SurveyAnswers, SurveyWriteInAnswers, SKIP_OPTION } from "@/shared/PromptBuilderTypes";
import { PromptBuilderModalProps } from "./types";
import { Step1Description } from "./Step1Description";
import { Step2Survey } from "./Step2Survey";
import { Step3Review } from "./Step3Review";
import Stepper, { Step } from "@/components/Stepper";


export function PromptBuilderModal({
    isOpen,
    onClose,
    inputs,
    output,
    existingPrompt,
    onPromptGenerated
}: PromptBuilderModalProps) {
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
    const [answers, setAnswers] = useState<SurveyAnswers>({});
    const [writeInAnswers, setWriteInAnswers] = useState<SurveyWriteInAnswers>({});
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [completedSteps, setCompletedSteps] = useState<Set<1 | 2 | 3>>(new Set());

    const prepareConfigContext = (): { inputConfigs?: SurveyConfigContext[]; outputConfig?: SurveyConfigContext } => {
        const inputConfigs: SurveyConfigContext[] = inputs.map(input => ({
            type: input.config.configType
        }));
        
        const outputConfig: SurveyConfigContext | undefined = output ? {
            type: output.config.configType
        } : undefined;

        return { inputConfigs, outputConfig };
    };

    // Check if all questions are answered
    const areAllQuestionsAnswered = () => {
        if (questions.length === 0) return false;
        return questions.every((_, idx) => {
            const key = String(idx);
            const answer = answers[key];
            const writeIn = writeInAnswers[key];
            const hasAnswer = answer !== undefined && answer !== null && answer !== '' && 
                             (Array.isArray(answer) ? answer.length > 0 : true);
            const hasWriteIn = writeIn !== undefined && writeIn !== null && writeIn.trim() !== '';
            return hasAnswer || hasWriteIn;
        });
    }

    const handleGenerateQuestions = async () => {
        if (!description.trim() || questions.length > 0) return;
        
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
            setCompletedSteps(prev => new Set([...prev, 1]));
            
            // Automatically navigate to step 2 after questions are generated
            if (response.questions.length > 0) {
                setCurrentStep(2);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to generate questions. Please try again.');
        } finally {
            setIsLoadingQuestions(false);
        }
    }

    const handleGeneratePrompt = async () => {
        if (generatedPrompt || questions.length === 0) return;

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
            setCompletedSteps(prev => new Set([...prev, 2, 3]));
            setCurrentStep(3);
        } catch (err: any) {
            setError(err.message || 'Failed to generate prompt. Please try again.');
        } finally {
            setIsLoadingPrompt(false);
        }
    }

    // Update completed steps when answers change
    useEffect(() => {
        if (questions.length > 0 && areAllQuestionsAnswered() && !completedSteps.has(2)) {
            setCompletedSteps(prev => new Set([...prev, 2]));
        }
    }, [questions.length, completedSteps]);


    const handleRestart = () => {
        setDescription('');
        setQuestions([]);
        setAnswers({});
        setWriteInAnswers({});
        setGeneratedPrompt('');
        setError(null);
        setCurrentStep(1);
        setCompletedSteps(new Set());
    };

    const canProceedToStep = (step: number): boolean => {
        if (step === 1) return true;
        if (step === 2) return completedSteps.has(1);
        if (step === 3) return completedSteps.has(2);
        return false;
    };

    const handleStepChange = (step: number) => {
        setCurrentStep(step);
    };

    const handleStep2Continue = async () => {
        if (areAllQuestionsAnswered()) {
            await handleGeneratePrompt();
            // Step will advance automatically via handleStepperStepChange after prompt is generated
        }
    };

    const handleStep1Continue = async () => {
        await handleGenerateQuestions();
        // Step will advance automatically via handleStepperStepChange after questions are generated
    };

    const handleAnswerChange = (questionIndex: number, answer: string, questionType: 'single' | 'multiple') => {
        const key = String(questionIndex);
        if (questionType === 'single') {
            setAnswers(prev => ({ ...prev, [key]: answer }));
        } else {
            setAnswers(prev => {
                const current = prev[key];
                const currentArray = Array.isArray(current) ? current : (current ? [current] : []);
                
                if (answer === SKIP_OPTION) {
                    return { ...prev, [key]: [SKIP_OPTION] };
                }
                
                let newArray = currentArray.filter(a => a !== SKIP_OPTION);
                
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
        } else {
            // Reset to first step when opening
            setCurrentStep(1);
            setCompletedSteps(new Set());
        }
    }, [isOpen]);

    // Prevent Stepper navigation if step is not completed
    const handleStepperStepChange = (step: number) => {
        if (!canProceedToStep(step)) {
            return; // Prevent navigation
        }
        handleStepChange(step);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[50%] max-w-none sm:max-w-none max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Prompt Builder
                        <span className="text-sm font-normal text-muted-foreground">
                            Step {currentStep} of 3
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm mb-4">
                        {error}
                    </div>
                )}

                <div>
                    <Stepper
                    key={currentStep} // Force re-render when step changes programmatically
                    initialStep={currentStep}
                    onStepChange={handleStepperStepChange}
                    onFinalStepCompleted={() => {}}
                    backButtonText="Previous"
                    nextButtonText="Next"
                    disableStepIndicators={false}
                    stepCircleContainerClassName="!max-w-none !border-none !shadow-none"
                    stepContainerClassName="!p-4"
                    footerClassName="!pb-2 !pt-0"
                    nextButtonProps={{
                        disabled: 
                            (currentStep === 1 && (!description.trim() || isLoadingQuestions)) ||
                            (currentStep === 2 && (!areAllQuestionsAnswered() || isLoadingPrompt)) ||
                            isLoadingQuestions || isLoadingPrompt,
                        onClick: async (e: React.MouseEvent) => {
                            e.preventDefault();
                            if (currentStep === 1) {
                                await handleStep1Continue();
                            } else if (currentStep === 2) {
                                await handleStep2Continue();
                            } else if (currentStep === 3) {
                                handleDone();
                            }
                        }
                    }}
                    backButtonProps={{
                        disabled: isLoadingQuestions || isLoadingPrompt
                    }}
                >
                    <Step>
                        <Step1Description
                            description={description}
                            setDescription={setDescription}
                            isLoading={isLoadingQuestions}
                        />
                    </Step>
                    <Step>
                        <Step2Survey
                            questions={questions}
                            answers={answers}
                            writeInAnswers={writeInAnswers}
                            onAnswerChange={handleAnswerChange}
                            onWriteInChange={handleWriteInChange}
                            isLoading={isLoadingPrompt}
                            allQuestionsAnswered={areAllQuestionsAnswered()}
                            onBack={() => handleStepChange(1)}
                            onContinue={handleStep2Continue}
                        />
                    </Step>
                    <Step>
                        <Step3Review
                            generatedPrompt={generatedPrompt}
                            isLoading={isLoadingPrompt}
                            onRestart={handleRestart}
                            onDone={handleDone}
                        />
                    </Step>
                    </Stepper>
                </div>
            </DialogContent>
        </Dialog>
    );
}

