import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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

    const currentQuestion = questions[currentQuestionIndex];
    const isMultiple = currentQuestion.type === 'multiple';
    const questionKey = String(currentQuestionIndex);
    const currentAnswer = answers[questionKey];
    const selectedAnswers = isMultiple 
        ? (Array.isArray(currentAnswer) ? currentAnswer : [])
        : (typeof currentAnswer === 'string' ? currentAnswer : null);
    const writeInValue = writeInAnswers[questionKey] || '';

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Answer clarifying questions</h3>
                <div className="mt-2">
                    {/* Question Progress Indicator */}
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-muted-foreground">
                            Question {currentQuestionIndex + 1} of {questions.length}
                        </span>
                        <div className="flex gap-1">
                            {questions.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "h-2 w-2 rounded-full transition-colors",
                                        idx === currentQuestionIndex
                                            ? "bg-primary"
                                            : "bg-muted"
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Carousel Container */}
                    <div className="relative">
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">
                                {currentQuestionIndex + 1}. {currentQuestion.question}
                                {isMultiple && (
                                    <span className="text-xs text-muted-foreground ml-2">(Select all that apply)</span>
                                )}
                            </Label>
                            <div className="space-y-2 pl-4">
                                {(['a', 'b', 'c', 'd', 'e'] as const).map((option) => {
                                    const isChecked = isMultiple
                                        ? Array.isArray(selectedAnswers) && selectedAnswers.includes(option)
                                        : selectedAnswers === option;
                                    
                                    return (
                                        <label
                                            key={option}
                                            className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded-md"
                                        >
                                            <input
                                                type={isMultiple ? "checkbox" : "radio"}
                                                name={`question-${currentQuestionIndex}`}
                                                value={option}
                                                checked={isChecked}
                                                onChange={() => onAnswerChange(currentQuestionIndex, option, currentQuestion.type)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm">
                                                <span className="font-medium">{option.toUpperCase()})</span> {currentQuestion.options[option]}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            {currentQuestion.allowWriteIn && (
                                <div className="pl-4 mt-3">
                                    <Label className="text-sm font-medium mb-2 block">
                                        Or provide your own answer:
                                    </Label>
                                    <Textarea
                                        value={writeInValue}
                                        onChange={(e) => onWriteInChange(currentQuestionIndex, e.target.value)}
                                        placeholder="Type your custom answer here..."
                                        className="min-h-[80px]"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex items-center justify-between mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                                disabled={currentQuestionIndex === 0}
                                className="flex items-center gap-2"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                                disabled={currentQuestionIndex === questions.length - 1}
                                className="flex items-center gap-2"
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
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

