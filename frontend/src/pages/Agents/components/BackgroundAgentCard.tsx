import { useEffect, useState } from "react"

import { Brain } from "lucide-react"
import { HelpCircle } from "lucide-react"
import { toast } from "sonner"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog } from "@/components/ui/dialog"
import { DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { AgentPrompt } from "@/shared/types"

type BackgroundAgentCardProps = {
    prompt: AgentPrompt | undefined
    setPrompt: (prompt: AgentPrompt | undefined) => void
}

export function BackgroundAgentCard({ prompt, setPrompt }: BackgroundAgentCardProps) {
    return (
        <>
            <style>{`
                @keyframes pulseGlow {
                    0%, 100% {
                        opacity: 0.3;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.5;
                        transform: scale(1.02);
                    }
                }
                @keyframes pulseBorder {
                    0%, 100% {
                        border-color: oklch(0.7 0.17 172 / 0.25);
                        box-shadow: 
                            0 0 0 1px oklch(0.7 0.17 172 / 0.1),
                            0 0 12px oklch(0.7 0.17 172 / 0.08),
                            0 0 24px oklch(0.577 0.245 27.325 / 0.06),
                            inset 0 0 12px oklch(0.7 0.17 172 / 0.03);
                    }
                    50% {
                        border-color: oklch(0.7 0.17 172 / 0.4);
                        box-shadow: 
                            0 0 0 1px oklch(0.7 0.17 172 / 0.15),
                            0 0 16px oklch(0.7 0.17 172 / 0.12),
                            0 0 32px oklch(0.577 0.245 27.325 / 0.08),
                            inset 0 0 16px oklch(0.7 0.17 172 / 0.05);
                    }
                }
            `}</style>
            <div className="relative">
                {/* Subtle gradient glow shadow effect */}
                <div
                    className="absolute inset-0 rounded-lg blur-lg -z-10"
                    style={{
                        background: "linear-gradient(135deg, oklch(0.7 0.17 172 / 0.2), oklch(0.577 0.245 27.325 / 0.15))",
                        boxShadow: "0 0 20px oklch(0.7 0.17 172 / 0.15), 0 0 40px oklch(0.577 0.245 27.325 / 0.1)",
                        animation: "pulseGlow 3s ease-in-out infinite"
                    }}
                />
                <Card
                    className="min-w-64 relative border"
                    style={{
                        borderColor: "oklch(0.7 0.17 172 / 0.25)",
                        boxShadow: `
                            0 0 0 1px oklch(0.7 0.17 172 / 0.1),
                            0 0 12px oklch(0.7 0.17 172 / 0.08),
                            0 0 24px oklch(0.577 0.245 27.325 / 0.06),
                            inset 0 0 12px oklch(0.7 0.17 172 / 0.03)
                        `,
                        animation: "pulseBorder 3s ease-in-out infinite"
                    }}
                >
                    <CardHeader>
                        <CardTitle>
                            <div className={`flex items-center gap-2`}>
                                <div className={`w-5 h-5 flex items-center justify-center`}>
                                    <Brain className="w-5 h-5 text-sidebar-primary" />
                                </div>
                                Background Agent
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PromptDialog prompt={prompt} setPrompt={setPrompt} />
                    </CardContent>
                </Card>
            </div>
        </>
    )
}

function PromptDialog({ prompt, setPrompt }: BackgroundAgentCardProps) {
    const [content, setContent] = useState(prompt?.text || "")
    const [open, setOpen] = useState(false)

    // Sync content when prompt changes from parent
    useEffect(() => {
        setContent(prompt?.text || "")
    }, [prompt])

    // Update content when prompt changes externally
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
            // Reset content to current prompt when dialog closes without saving
            setContent(prompt?.text || "")
        }
    }
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">Modify Instructions</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Prompt</DialogTitle>
                </DialogHeader>
                <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder='e.g., "Summarize all commits and update the changelog", "Create a weekly progress report", etc.' />
                <PromptDialogTip />
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="default"
                        onClick={() => {
                            setPrompt({ text: content })
                            setOpen(false)
                            toast.success("Prompt saved successfully")
                        }}
                    >
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function PromptDialogTip() {
    return (
        <Accordion type="single" collapsible>
            <AccordionItem value="item-1">
                <AccordionTrigger>
                    <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-sidebar-primary" />
                        <p className="text-sm font-medium">Tips</p>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <p className="mb-2 text-muted-foreground">
                        This prompt will be used in <span className="text-foreground">conjunction</span> with our standard background agent system prompt. You should use this space to describe what
                        you want the Background agent to do. Pretend you are asking a colleague to do the task.
                    </p>
                    <p className="text-muted-foreground">
                        Ex: "Every time a new decision in made in Figma comments that conflicts with what we have in our PRD, leave a comment in the PRD pointing to the Figma discussion."
                    </p>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}
