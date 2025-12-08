import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EditableTextField from '../../../components/ui/EditableTextField';
import { ChannelUpdate, TransientChannelInput, TransientChannelOutput } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultChannelName, toChannelInput, toChannelOutput } from "@/utility/ChannelUtils";
import { useChannelCount } from "@/hooks/api/useChannelCount";
import { useChannelMutations } from "@/hooks/api/useChannels";
import { type KeyedMutator } from 'swr';
import { Channel, ChannelInput, ChannelOutput, ChannelPrompt } from "@/shared/types";
import { Textarea } from "../../../components/ui/textarea";
import { ConfigTitle } from "../components/ConfigTitle";
import { AddInputModal } from "../components/AddInputModal";
import { ConfigInstance, ConfigType } from "../../../shared/Configs";
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { InputConfigSelectorProps, IntegrationSelector } from "../../../components/IntegrationSelector";
import { AlertTriangleIcon, FileText, PlusIcon, Sparkles, XIcon, Copy, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Card, CardContent } from "../../../components/ui/card";
import { AddOutputModal } from "../components/AddOutputModal";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../components/ui/empty";
import { Badge } from "../../../components/ui/badge";
import { BackendProvider } from "../../../services/backend";
import { Spinner } from "../../../components/ui/spinner";
import { Label } from "../../../components/ui/label";

export type ChannelSetupTabProps = {
    channelId: string | null;
    name: string | null;
    setName: (name: string) => void;
    inputs: TransientChannelInput[];
    setInputs: (inputs: TransientChannelInput[]) => void;
    output: TransientChannelOutput | undefined;
    setOutput: (output: TransientChannelOutput | undefined) => void;
    prompt: ChannelPrompt | undefined;
    setPrompt: (prompt: ChannelPrompt | undefined) => void;
    isActive: boolean;
    setIsActive: (isActive: boolean) => void;
    isLoading: boolean;
    mutate: KeyedMutator<Channel>;
};

function SaveChannelButton({
    defaultName,
    channelId,
    name,
    inputs,
    output,
    prompt,
    isActive,
    mutate
}: {
    defaultName: string;
    channelId: string | null;
    name: string | null;
    inputs: ChannelInput[];
    output: ChannelOutput | undefined;
    prompt: ChannelPrompt | undefined;
    isActive: boolean;
    mutate: KeyedMutator<Channel>;
}) {
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const { createChannel, updateChannel } = useChannelMutations();

    // Validation: all required fields must be present
    // Each integration reports its own completeness
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => i.config != null && i.config.isComplete()) &&
        !!output && output.config.isComplete() &&
        !!prompt?.text; // Ensure prompt is not empty

    const isEditMode = !!channelId;

    const handleSave = async () => {
        if (!isComplete || !inputs.length || !output) return;

        setIsSaving(true);
        try {
            const channelData: ChannelUpdate = {
                name: name || defaultName || '',
                inputs,
                output,
                prompt,
                isActive
            };

            if (isEditMode) {
                // Update existing channel
                await updateChannel({
                    id: channelId!,
                    data: channelData,
                    mutateChannel: mutate,
                });
            } else if (isComplete && channelData.output && channelData.inputs && channelData.inputs.length > 0) {
                // Create new channel
                const creation = await createChannel({
                    name: channelData.name || '',
                    inputs: channelData.inputs || [],
                    output: channelData.output,
                    prompt: channelData.prompt || { text: '' },
                    isActive: channelData.isActive || true,
                });

                if (creation?.id) {
                    navigate(`/app/channels/${creation.id}`, { replace: true });
                }
            }

            toast.success('Channel saved successfully');

            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
            }, 1000);
        } catch (error) {
            console.error('Error saving channel:', error);
            alert('Failed to save channel. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Button
            onClick={handleSave}
            disabled={!isComplete || isSaving}
        >
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : isComplete ? (isEditMode ? 'Update Channel' : 'Save Channel') : 'Complete All Steps'}
        </Button>
    )
}

const instructionsPlaceholder = `Describe what you want the AI to do with incoming events from your sources.

For example:
- "Monitor all new GitHub issues and create Linear tickets for bugs, adding appropriate labels and priority"
- "Watch for Notion database updates and post summaries to Slack with key changes highlighted"
- "Track customer feedback from multiple channels and synthesize weekly reports"

Be specific about:
• What information to extract or focus on
• How to format or structure the output
• Any rules for filtering or prioritizing events
• The tone or style for generated content`;

export default function ChannelSetupTab({
    channelId,
    name,
    setName,
    inputs,
    output,
    prompt,
    setInputs,
    setOutput,
    setPrompt,
    isActive,
    mutate,
}: ChannelSetupTabProps) {
    const { totalCount } = useChannelCount();
    const defaultName = getDefaultChannelName(totalCount);
    const [showPromptBuilder, setShowPromptBuilder] = useState(false);
    const isEmpty = !prompt?.text || prompt.text.trim() === '';
    const [showOverlay, setShowOverlay] = useState(isEmpty);

    // Sync overlay state when prompt changes externally
    useEffect(() => {
        setShowOverlay(isEmpty);
    }, [isEmpty]);

    const channelInputs = inputs.map(toChannelInput).filter((i): i is ChannelInput => i !== null);
    const channelOutput = toChannelOutput(output)

    return (
        <div className="grid grid-flow-row place-items-center gap-8">
            <div className="flex justify-between items-center w-full p-2">
                <EditableTextField value={name || ''} placeholder={defaultName} onSave={(value) => setName(value)} />
                <SaveChannelButton
                    defaultName={defaultName}
                    channelId={channelId}
                    name={name}
                    inputs={channelInputs}
                    output={channelOutput}
                    prompt={prompt}
                    isActive={isActive}
                    mutate={mutate}
                />
            </div>

            <div className="flex flex-row gap-12 h-full">
                <div className="flex flex-col gap-4 justify-between">
                    <div className="flex flex-row gap-4 min-w-md max-w-md">
                        <InputLayout inputs={inputs} setInputs={setInputs} />
                    </div>

                    <div className="min-w-md max-w-md overflow-hidden">
                        <OutputLayout output={output} setOutput={setOutput} />
                    </div>
                </div>

                <div className="min-w-md max-w-md flex flex-col h-full">
                    <div className="flex flex-row gap-2 items-center mb-2">
                        <h2 className="text-lg">Instructions</h2>
                        {(!prompt?.text || prompt.text.trim() === '') && (
                            <AlertTriangleIcon className="size-4 text-yellow-500" />
                        )}
                    </div>
                    <div className="relative flex-1">
                        <Textarea 
                            value={prompt?.text || ''} 
                            onChange={(e) => {
                                setPrompt({ ...prompt, text: e.target.value });
                                if (e.target.value.trim() !== '') {
                                    setShowOverlay(false);
                                } else {
                                    setShowOverlay(true);
                                }
                            }}
                            onFocus={() => {
                                if (prompt?.text && prompt.text.trim() !== '') {
                                    setShowOverlay(false);
                                }
                            }}
                            className="flex-1 h-full" 
                            placeholder={instructionsPlaceholder} 
                        />
                        {(!prompt?.text || prompt.text.trim() === '') && showOverlay && (
                            <div 
                                className="absolute inset-0 bg-background/30 backdrop-blur-[1px] flex items-center justify-center rounded-md border border-border/50"
                                onClick={(e) => {
                                    // Don't close overlay if clicking the button
                                    if ((e.target as HTMLElement).closest('button')) {
                                        return;
                                    }
                                    setShowOverlay(false);
                                }}
                            >
                                <Button
                                    variant="default"
                                    size="lg"
                                    onClick={() => setShowPromptBuilder(true)}
                                    className="shadow-lg"
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Open Prompt Builder
                                </Button>
                            </div>
                        )}
                    </div>
                    <PromptBuilderModal
                        isOpen={showPromptBuilder}
                        onClose={() => setShowPromptBuilder(false)}
                        inputs={channelInputs}
                        output={channelOutput}
                        existingPrompt={prompt?.text}
                        onPromptGenerated={(generatedPrompt) => {
                            setPrompt({ ...prompt, text: generatedPrompt });
                        }}
                    />
                </div>
            </div>
        </div >
    )
}

function InputLayout({ inputs, setInputs }: { inputs: TransientChannelInput[], setInputs: (inputs: TransientChannelInput[]) => void }) {
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectPlatform = (config: ConfigType) => {
        const newInputId = uuidv4(); // We need to mint a placeholder ID for the new input so that we can identify it later.
        const newInput: TransientChannelInput = { id: newInputId, config: undefined, configType: config };
        const newInputs: TransientChannelInput[] = [...inputs, newInput];
        setInputs(newInputs);
        setShowAddModal(false);
    };

    const handleRemove = (id: string) => {
        setInputs(inputs.filter(input => input.id !== id));
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-row gap-2 items-center mb-2">
                <h2 className="text-lg">Event Sources</h2>
                {inputs.length === 0 && (
                    <AlertTriangleIcon className="size-4 text-yellow-500" />
                )}
            </div>
            <div className="flex flex-row flex-wrap gap-2 items-stretch">
                {inputs.map((input) => (
                    <Input key={input.id} input={input} inputs={inputs} setInputs={setInputs} handleRemove={handleRemove} />
                ))}
                <Button variant="outline" onClick={() => setShowAddModal(true)} className="h-auto aspect-square">
                    <PlusIcon className={cn("size-4", inputs.length > 0 ? "text-primary" : "text-muted-foreground")} />
                </Button>
                <AddInputModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSelectIntegration={handleSelectPlatform}
                />
            </div>
        </div>
    )
}

function Input({ input, inputs, setInputs, handleRemove }: { input: TransientChannelInput, inputs: TransientChannelInput[], setInputs: (inputs: TransientChannelInput[]) => void, handleRemove: (id: string) => void }) {
    const isPlaceholder = input.config === undefined;
    const needsConfiguration = !input.config || !input.config.isComplete();
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    const selectorProps: InputConfigSelectorProps = {
        input: input,
        setConfig: (config: ConfigInstance) => setInputs(inputs.map(i => i.id === input.id ? { ...i, config, configType: config.configType } : i)),
        variant: "card",
    };

    let cardContent;
    if (isPlaceholder) {
        cardContent = (
            <div className="p-2 border rounded-md cursor-pointer" onClick={() => setShowDetailsDialog(true)}>
                <div className="flex flex-row justify-between items-center">
                    <ConfigTitle configType={input.configType} iconSize="md" />
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(input.id); }} className="hover:text-destructive">
                        <XIcon />
                    </Button>
                </div>
                <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-500">
                    <IntegrationSelector {...selectorProps} variant="card" />
                </Badge>
            </div>
        );
    } else {
        cardContent = (
            <div className="p-2 border rounded-md cursor-pointer" onClick={() => setShowDetailsDialog(true)}>
                <div className="flex flex-row justify-between pb-2">
                    <ConfigTitle configType={input.configType} iconSize="md" />
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(input.id); }} className="hover:text-destructive">
                        <XIcon />
                    </Button>
                </div>
                <Badge variant="outline" className="max-w-40 truncate">
                    <IntegrationSelector {...selectorProps} variant="card" />
                </Badge>
            </div>
        );
    }

    return (
        <>
            {cardContent}

            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{needsConfiguration ? "Configure Integration" : "Integration Details"}</DialogTitle>
                    </DialogHeader>
                    <IntegrationSelector {...selectorProps} variant="dialog" />
                </DialogContent>
            </Dialog>
        </>
    )
}

function OutputLayout({ output, setOutput }: { output: TransientChannelOutput | undefined, setOutput: (output: TransientChannelOutput | undefined) => void }) {
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectPlatform = (configType: ConfigType) => {
        // Clear all configs when switching platform (new integration type)
        const newOutput: TransientChannelOutput = {
            id: uuidv4(),
            config: undefined,
            configType: configType,
        };
        setOutput(newOutput);
        setShowAddModal(false);
    };

    const onSelect = (config: ConfigInstance) => {
        setOutput({ id: output?.id || uuidv4(), config: config, configType: config.configType });
    };

    const needsConfiguration = !output || !output.config || !output.config.isComplete();

    let cardContent;
    if (!output) {
        cardContent = (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <FileText className="text-destructive" />
                        </EmptyMedia>
                        <EmptyTitle>No output yet</EmptyTitle>
                        <EmptyDescription>
                            No output yet. Add an integration to get started.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button onClick={() => setShowAddModal(true)}>
                            <PlusIcon className="h-4 w-4" />
                            Add Output
                        </Button>
                    </EmptyContent>
                </Empty>
        )
    } else {
        cardContent = (
            <IntegrationSelector input={output} variant="dialog" setConfig={onSelect} />
        );
    }

    let headerContent;
    if (needsConfiguration && output) {
        headerContent = (
            <div className="flex flex-row gap-2">
                <h2 className="text-lg">Output</h2>
                <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-500">
                    <AlertTriangleIcon className="size-4 text-yellow-500" />
                    Needs Configuration
                </Badge>
            </div>
        );
    } else {
        headerContent = (
            <h2 className="text-lg">Output</h2>
        );
    }

    return (
        <>
            <div className="flex flex-row justify-between items-center mb-4">
                {headerContent}
                {output && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
                        Change output
                    </Button>
                )}
            </div>
            <div className="flex flex-row gap-2">
                <Card className="flex flex-row gap-2 w-full min-w-0 overflow-hidden">
                    <CardContent className="min-w-0 overflow-hidden">
                        {cardContent}
                    </CardContent>
                </Card>
            </div>

            <AddOutputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
        </>
    )
}

type Question = {
    question: string;
    type: 'single' | 'multiple';
    allowWriteIn?: boolean;
    options: {
        a: string;
        b: string;
        c: string;
        d: string;
        e: string;
    };
};

function PromptBuilderModal({ 
    isOpen, 
    onClose,
    inputs,
    output,
    existingPrompt,
    onPromptGenerated
}: { 
    isOpen: boolean; 
    onClose: () => void;
    inputs: ChannelInput[];
    output: ChannelOutput | undefined;
    existingPrompt?: string;
    onPromptGenerated?: (prompt: string) => void;
}) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
    const [writeInAnswers, setWriteInAnswers] = useState<Record<number, string>>({});
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    const handleStep1Continue = async () => {
        if (!description.trim()) return;
        
        setIsLoadingQuestions(true);
        setError(null);
        
        try {
            // Prepare input/output configs for context
            const inputConfigs = inputs.map(input => ({
                type: input.config.configType,
                details: input.config.formatForAgent ? input.config.formatForAgent() : undefined
            }));
            
            const outputConfig = output ? {
                type: output.config.configType,
                details: output.config.formatForAgent ? output.config.formatForAgent() : undefined
            } : undefined;

            const response = await BackendProvider.generatePromptBuilderQuestions(
                description,
                existingPrompt,
                inputConfigs,
                outputConfig
            );
            
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
            // Prepare input/output configs for context
            const inputConfigs = inputs.map(input => ({
                type: input.config.configType,
                details: input.config.formatForAgent ? input.config.formatForAgent() : undefined
            }));
            
            const outputConfig = output ? {
                type: output.config.configType,
                details: output.config.formatForAgent ? output.config.formatForAgent() : undefined
            } : undefined;

            const response = await BackendProvider.generatePromptBuilderPrompt(
                description,
                answers,
                writeInAnswers,
                existingPrompt,
                inputConfigs,
                outputConfig
            );
            
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

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generatedPrompt);
            toast.success('Prompt copied to clipboard!');
        } catch (err) {
            toast.error('Failed to copy prompt');
        }
    };

    const handleAnswerChange = (questionIndex: number, answer: string, questionType: 'single' | 'multiple') => {
        if (questionType === 'single') {
            setAnswers(prev => ({ ...prev, [questionIndex]: answer }));
        } else {
            // Multiple choice - toggle the answer
            setAnswers(prev => {
                const current = prev[questionIndex];
                const currentArray = Array.isArray(current) ? current : (current ? [current] : []);
                
                if (answer === 'e') {
                    // If selecting 'e', clear all other selections
                    return { ...prev, [questionIndex]: ['e'] };
                }
                
                // Remove 'e' if it was selected and we're selecting something else
                let newArray = currentArray.filter(a => a !== 'e');
                
                if (newArray.includes(answer)) {
                    // Deselect if already selected
                    newArray = newArray.filter(a => a !== answer);
                } else {
                    // Select if not already selected
                    newArray.push(answer);
                }
                
                // If nothing selected, return empty array
                return { ...prev, [questionIndex]: newArray.length > 0 ? newArray : [] };
            });
        }
    };

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            handleRestart();
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        Prompt Builder
                        <span className="text-sm font-normal text-muted-foreground ml-auto">
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
                    {/* Step 1: High-Level Description */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium mb-2 block">
                                    Describe at a high level what you are looking for
                                </Label>
                                <div className="flex gap-2">
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="e.g., Monitor all new GitHub issues and create Linear tickets for bugs, adding appropriate labels and priority"
                                        className="flex-1 min-h-[100px]"
                                    />
                                    <Button
                                        onClick={handleStep1Continue}
                                        disabled={!description.trim() || isLoadingQuestions}
                                        className="self-start"
                                    >
                                        {isLoadingQuestions ? (
                                            <>
                                                <Spinner className="mr-2" />
                                                Generating...
                                            </>
                                        ) : (
                                            'Continue'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Answer Clarifying Questions */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Answer clarifying questions</h3>
                                {questions.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Spinner className="mx-auto mb-2" />
                                        <p className="text-muted-foreground">Generating questions...</p>
                                    </div>
                                ) : (
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
                                            {questions.map((q, index) => {
                                                if (index !== currentQuestionIndex) return null;
                                                
                                                const isMultiple = q.type === 'multiple';
                                                const currentAnswer = answers[index];
                                                const selectedAnswers = isMultiple 
                                                    ? (Array.isArray(currentAnswer) ? currentAnswer : [])
                                                    : (typeof currentAnswer === 'string' ? currentAnswer : null);
                                                const writeInValue = writeInAnswers[index] || '';
                                                
                                                return (
                                                    <div key={index} className="space-y-3">
                                                        <Label className="text-sm font-medium">
                                                            {index + 1}. {q.question}
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
                                                                            name={`question-${index}`}
                                                                            value={option}
                                                                            checked={isChecked}
                                                                            onChange={() => handleAnswerChange(index, option, q.type)}
                                                                            className="w-4 h-4"
                                                                        />
                                                                        <span className="text-sm">
                                                                            <span className="font-medium">{option.toUpperCase()})</span> {q.options[option]}
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                        {q.allowWriteIn && (
                                                            <div className="pl-4 mt-3">
                                                                <Label className="text-sm font-medium mb-2 block">
                                                                    Or provide your own answer:
                                                                </Label>
                                                                <Textarea
                                                                    value={writeInValue}
                                                                    onChange={(e) => {
                                                                        setWriteInAnswers(prev => ({
                                                                            ...prev,
                                                                            [index]: e.target.value
                                                                        }));
                                                                    }}
                                                                    placeholder="Type your custom answer here..."
                                                                    className="min-h-[80px]"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Navigation Buttons */}
                                            <div className="flex items-center justify-between mt-6">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                                    disabled={currentQuestionIndex === 0}
                                                    className="flex items-center gap-2"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                                                    disabled={currentQuestionIndex === questions.length - 1}
                                                    className="flex items-center gap-2"
                                                >
                                                    Next
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setStep(1)}>
                                    Back
                                </Button>
                                <Button
                                    onClick={handleStep2Continue}
                                    disabled={isLoadingPrompt || questions.length === 0}
                                >
                                    {isLoadingPrompt ? (
                                        <>
                                            <Spinner className="mr-2" />
                                            Generating...
                                        </>
                                    ) : (
                                        'Continue'
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Review Your Prompt */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Review your prompt</h3>
                                <div className="space-y-2">
                                    <Textarea
                                        value={generatedPrompt}
                                        readOnly
                                        className="min-h-[300px] font-mono text-sm"
                                    />
                                    <div className="flex justify-end">
                                        <Button variant="outline" onClick={handleCopy} size="sm">
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Click "Done" to use this prompt in the Instructions field.
                                </p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={handleRestart}>
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Restart
                                </Button>
                                <Button onClick={() => {
                                    if (generatedPrompt && onPromptGenerated) {
                                        onPromptGenerated(generatedPrompt);
                                    }
                                    onClose();
                                }}>
                                    Done
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}