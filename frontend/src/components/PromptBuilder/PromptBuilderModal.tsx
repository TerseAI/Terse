import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { BackendProvider } from "@/services/backend";
import { SurveyQuestion, GenerateSurveyQuestionsRequest, GenerateSurveyPromptRequest, SurveyConfigContext, SurveyAnswers, SurveyWriteInAnswers, SKIP_OPTION } from "@/shared/PromptBuilderTypes";
import { PromptBuilderModalProps } from "./types";
import { Step1Description } from "./Step1Description";
import { Step2Survey } from "./Step2Survey";
import { Step3Review } from "./Step3Review";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";

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
    const [carouselApi, setCarouselApi] = useState<CarouselApi>();
    const [currentIndex, setCurrentIndex] = useState(0);

    const prepareConfigContext = (): { inputConfigs?: SurveyConfigContext[]; outputConfig?: SurveyConfigContext } => {
        const inputConfigs: SurveyConfigContext[] = inputs.map(input => ({
            type: input.config.configType
        }));
        
        const outputConfig: SurveyConfigContext | undefined = output ? {
            type: output.config.configType
        } : undefined;

        return { inputConfigs, outputConfig };
    };

    // Carousel indices: Step 1 = 0, Questions = 1 to N, Review = N+1
    const step1Index = 0;
    const firstQuestionIndex = 1;
    const reviewIndex = 1 + questions.length;

    // Get current step based on carousel index
    const getCurrentStep = (index: number): 1 | 2 | 3 => {
        if (index === step1Index) return 1;
        if (index >= firstQuestionIndex && index < reviewIndex) return 2;
        return 3;
    };

    const currentStep = getCurrentStep(currentIndex);
    const currentQuestionIndex = currentIndex - firstQuestionIndex;

    const handleGenerateQuestions = useCallback(async () => {
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
            
            // Automatically navigate to first question after questions are generated
            if (carouselApi && response.questions.length > 0) {
                // Wait a bit for the carousel to update with new items
                setTimeout(() => {
                    if (carouselApi) {
                        carouselApi.scrollTo(firstQuestionIndex);
                    }
                }, 100);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to generate questions. Please try again.');
        } finally {
            setIsLoadingQuestions(false);
        }
    }, [description, existingPrompt, inputs, output, questions.length, carouselApi, firstQuestionIndex]);

    const handleGeneratePrompt = useCallback(async () => {
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
        } catch (err: any) {
            setError(err.message || 'Failed to generate prompt. Please try again.');
            // Go back to last question on error
            if (carouselApi && questions.length > 0) {
                const lastQuestionIndex = questions.length;
                carouselApi.scrollTo(lastQuestionIndex);
            }
        } finally {
            setIsLoadingPrompt(false);
        }
    }, [description, questions, answers, writeInAnswers, existingPrompt, inputs, output, generatedPrompt, carouselApi]);

    // Handle carousel navigation
    useEffect(() => {
        if (!carouselApi) return;

        setCurrentIndex(carouselApi.selectedScrollSnap());

        const handleSelect = () => {
            // Prevent navigation when loading
            if (isLoadingQuestions || isLoadingPrompt) {
                // Revert to previous position
                setTimeout(() => {
                    if (carouselApi) {
                        carouselApi.scrollTo(currentIndex);
                    }
                }, 0);
                return;
            }

            const newIndex = carouselApi.selectedScrollSnap();
            const prevIndex = carouselApi.previousScrollSnap();
            
            // Prevent navigation from Step 1 to Step 2 - must use Continue button
            if (prevIndex === step1Index && newIndex === firstQuestionIndex && questions.length === 0) {
                // Revert to Step 1
                setTimeout(() => {
                    if (carouselApi) {
                        carouselApi.scrollTo(step1Index);
                    }
                }, 0);
                return;
            }
            
            setCurrentIndex(newIndex);
            
            // Auto-generate prompt when moving from last question to review
            const currentReviewIndex = 1 + questions.length;
            if (newIndex === currentReviewIndex && questions.length > 0 && !generatedPrompt && !isLoadingPrompt) {
                handleGeneratePrompt();
            }
        };

        carouselApi.on("select", handleSelect);
        return () => {
            carouselApi.off("select", handleSelect);
        };
    }, [carouselApi, description, questions.length, generatedPrompt, isLoadingQuestions, isLoadingPrompt, handleGenerateQuestions, handleGeneratePrompt, firstQuestionIndex, step1Index, currentIndex]);


    const handleRestart = () => {
        setDescription('');
        setQuestions([]);
        setAnswers({});
        setWriteInAnswers({});
        setGeneratedPrompt('');
        setError(null);
        if (carouselApi) {
            carouselApi.scrollTo(step1Index);
        }
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
            if (carouselApi) {
                carouselApi.scrollTo(step1Index);
            }
        }
    }, [isOpen, carouselApi]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[75%] max-w-none sm:max-w-none max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Prompt Builder
                        <span className="text-sm font-normal text-muted-foreground">
                            {currentStep === 1 && "Step 1 of 3"}
                            {currentStep === 2 && `Question ${currentQuestionIndex + 1} of ${questions.length}`}
                            {currentStep === 3 && "Step 3 of 3"}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {error && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div className="py-4 relative">
                    <Carousel
                        setApi={setCarouselApi}
                        opts={{
                            align: "start",
                            skipSnaps: false,
                        }}
                        className="w-full"
                    >
                        <CarouselContent>
                            {/* Step 1: Description */}
                            <CarouselItem>
                                <Step1Description
                                    description={description}
                                    setDescription={setDescription}
                                    isLoading={isLoadingQuestions}
                                    onContinue={handleGenerateQuestions}
                                />
                            </CarouselItem>

                            {/* Step 2: Survey Questions */}
                            {questions.map((question, idx) => {
                                const questionKey = String(idx);
                                const currentAnswer = answers[questionKey];
                                const isMultiple = question.type === 'multiple';
                                const selectedAnswers = isMultiple 
                                    ? (Array.isArray(currentAnswer) ? currentAnswer : [])
                                    : (typeof currentAnswer === 'string' ? currentAnswer : undefined);
                                const radioValue = isMultiple ? undefined : (typeof currentAnswer === 'string' ? currentAnswer : undefined);
                                const writeInValue = writeInAnswers[questionKey] || '';

                                return (
                                    <CarouselItem key={idx}>
                        <Step2Survey
                                            question={question}
                                            questionIndex={idx}
                                            totalQuestions={questions.length}
                                            selectedAnswers={selectedAnswers}
                                            radioValue={radioValue}
                                            writeInValue={writeInValue}
                            onAnswerChange={handleAnswerChange}
                            onWriteInChange={handleWriteInChange}
                        />
                                    </CarouselItem>
                                );
                            })}

                            {/* Step 3: Review */}
                            <CarouselItem>
                        <Step3Review
                            generatedPrompt={generatedPrompt}
                                    isLoading={isLoadingPrompt}
                            onRestart={handleRestart}
                            onDone={handleDone}
                        />
                            </CarouselItem>
                        </CarouselContent>
                        {currentStep !== 1 && (
                            <CarouselPrevious 
                                className="left-2" 
                                disabled={isLoadingQuestions || isLoadingPrompt}
                            />
                        )}
                        <CarouselNext 
                            className="right-2" 
                            disabled={
                                currentStep === 1 || 
                                isLoadingQuestions || 
                                isLoadingPrompt
                            }
                        />
                    </Carousel>
                </div>
            </DialogContent>
        </Dialog>
    );
}

