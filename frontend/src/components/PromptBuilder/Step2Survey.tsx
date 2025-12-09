import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { Step2SurveyProps } from "./types";
import { LoadingAnimation } from "./LoadingAnimation";

export function Step2Survey({
    questions,
    answers,
    writeInAnswers,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    onAnswerChange,
    onWriteInChange,
    isLoading,
    onBack,
    onContinue
}: Step2SurveyProps) {
    if (questions.length === 0) {
        return (
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold mb-4">Answer clarifying questions</h3>
                    <LoadingAnimation />
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold mb-4">Answer clarifying questions</h3>
                    <LoadingAnimation />
                </div>
            </div>
        );
    }

    const [api, setApi] = useState<CarouselApi>();
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        if (!api) {
            return;
        }

        setCurrent(api.selectedScrollSnap() + 1);

        api.on("select", () => {
            setCurrent(api.selectedScrollSnap() + 1);
            setCurrentQuestionIndex(api.selectedScrollSnap());
        });
    }, [api, setCurrentQuestionIndex]);

    useEffect(() => {
        if (api && currentQuestionIndex !== api.selectedScrollSnap()) {
            api.scrollTo(currentQuestionIndex);
        }
    }, [api, currentQuestionIndex]);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Answer clarifying questions</h3>
                <div className="mt-2">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-muted-foreground">
                            Question {current} of {questions.length}
                        </span>
                    </div>

                    <Carousel
                        setApi={setApi}
                        opts={{
                            align: "start",
                        }}
                        className="w-full"
                    >
                        <CarouselContent>
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
                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium">
                                                {idx + 1}. {question.question}
                                                {isMultiple && (
                                                    <span className="text-xs text-muted-foreground ml-2">(Select all that apply)</span>
                                                )}
                                            </Label>
                                            <div className="space-y-2 pl-4">
                                                {isMultiple ? (
                                                    (['a', 'b', 'c', 'd', 'e'] as const).map((option) => {
                                                        const isChecked = Array.isArray(selectedAnswers) && selectedAnswers.includes(option);
                                                        const optionId = `question-${idx}-${option}`;
                                                        
                                                        return (
                                                            <div
                                                                key={option}
                                                                className="flex items-center gap-3 hover:bg-accent p-2 rounded-md cursor-pointer"
                                                                onClick={() => onAnswerChange(idx, option, question.type)}
                                                            >
                                                                <Checkbox
                                                                    id={optionId}
                                                                    checked={isChecked}
                                                                    onCheckedChange={() => onAnswerChange(idx, option, question.type)}
                                                                />
                                                                <Label htmlFor={optionId} className="text-sm cursor-pointer">
                                                                    <span className="font-medium">{option.toUpperCase()})</span> {question.options[option]}
                                                                </Label>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <RadioGroup
                                                        value={radioValue}
                                                        onValueChange={(value: string) => onAnswerChange(idx, value, question.type)}
                                                    >
                                                        {(['a', 'b', 'c', 'd', 'e'] as const).map((option) => {
                                                            const optionId = `question-${idx}-${option}`;
                                                            return (
                                                                <div
                                                                    key={option}
                                                                    className="flex items-center gap-3 hover:bg-accent p-2 rounded-md cursor-pointer"
                                                                >
                                                                    <RadioGroupItem value={option} id={optionId} />
                                                                    <Label htmlFor={optionId} className="text-sm cursor-pointer">
                                                                        <span className="font-medium">{option.toUpperCase()})</span> {question.options[option]}
                                                                    </Label>
                                                                </div>
                                                            );
                                                        })}
                                                    </RadioGroup>
                                                )}
                                            </div>
                                            {question.allowWriteIn && (
                                                <div className="pl-4 mt-3">
                                                    <Label className="text-sm font-medium mb-2 block">
                                                        Or provide your own answer:
                                                    </Label>
                                                    <Textarea
                                                        value={writeInValue}
                                                        onChange={(e) => onWriteInChange(idx, e.target.value)}
                                                        placeholder="Type your custom answer here..."
                                                        className="min-h-[80px]"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </CarouselItem>
                                );
                            })}
                        </CarouselContent>
                        <CarouselPrevious />
                        <CarouselNext />
                    </Carousel>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onBack}>
                    Back
                </Button>
                <Button
                    onClick={onContinue}
                    disabled={isLoading || questions.length === 0}
                >
                    {isLoading ? (
                        <>
                            Generating...
                        </>
                    ) : (
                        'Continue'
                    )}
                </Button>
            </div>
        </div>
    );
}

