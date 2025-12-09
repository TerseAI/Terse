import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SurveyQuestion } from "@/shared/PromptBuilderTypes";

interface Step2SurveyProps {
    question: SurveyQuestion;
    questionIndex: number;
    totalQuestions: number;
    selectedAnswers: string | string[] | undefined;
    radioValue: string | undefined;
    writeInValue: string;
    onAnswerChange: (questionIndex: number, answer: string, questionType: 'single' | 'multiple') => void;
    onWriteInChange: (questionIndex: number, value: string) => void;
}

export function Step2Survey({
    question,
    questionIndex,
    totalQuestions,
    selectedAnswers,
    radioValue,
    writeInValue,
    onAnswerChange,
    onWriteInChange
}: Step2SurveyProps) {
    const isMultiple = question.type === 'multiple';

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold mb-2">Answer clarifying questions</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Question {questionIndex + 1} of {totalQuestions}
                </p>
                    </div>

                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium">
                    {question.question}
                                                {isMultiple && (
                                                    <span className="text-xs text-muted-foreground ml-2">(Select all that apply)</span>
                                                )}
                                            </Label>
                                            <div className="space-y-2 pl-4">
                                                {isMultiple ? (
                                                    (['a', 'b', 'c', 'd', 'e'] as const).map((option) => {
                                                        const isChecked = Array.isArray(selectedAnswers) && selectedAnswers.includes(option);
                            const optionId = `question-${questionIndex}-${option}`;
                                                        
                                                        return (
                                                            <div
                                                                key={option}
                                                                className="flex items-center gap-3 hover:bg-accent p-2 rounded-md cursor-pointer"
                                    onClick={() => onAnswerChange(questionIndex, option, question.type)}
                                                            >
                                                                <Checkbox
                                                                    id={optionId}
                                                                    checked={isChecked}
                                        onCheckedChange={() => onAnswerChange(questionIndex, option, question.type)}
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
                            onValueChange={(value: string) => onAnswerChange(questionIndex, value, question.type)}
                                                    >
                                                        {(['a', 'b', 'c', 'd', 'e'] as const).map((option) => {
                                const optionId = `question-${questionIndex}-${option}`;
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
                                                        onChange={(e) => onWriteInChange(questionIndex, e.target.value)}
                                                        placeholder="Type your custom answer here..."
                                                        className="min-h-[80px] resize-none"
                                                    />
                                                </div>
                                            )}
            </div>
        </div>
    );
}

