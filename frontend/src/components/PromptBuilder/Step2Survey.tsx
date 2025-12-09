import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Step2SurveyProps } from "./types";
import { LoadingAnimation } from "./LoadingAnimation";

export function Step2Survey({
    questions,
    answers,
    writeInAnswers,
    onAnswerChange,
    onWriteInChange,
    isLoading,
}: Step2SurveyProps) {
    if (isLoading) {
        return <LoadingAnimation message="Generating your prompt..." />;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-2">Answer clarifying questions</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Please answer all questions below
                </p>
            </div>

            <div className="space-y-8">
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
                        <div key={idx} className="space-y-3 border-b pb-6 last:border-b-0">
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
                                        className="min-h-[80px] resize-none"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

