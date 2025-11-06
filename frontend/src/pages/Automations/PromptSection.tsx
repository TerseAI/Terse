import { MessageCircle } from "lucide-react";
import { useAutomationContext } from "@/context/AutomationContext";
import { SectionLayout } from "./components/SectionLayout";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Brain } from "lucide-react";

export function PromptSection() {
    return (
        <SectionLayout title="Prompt" subtitle="The AI will use this prompt to generate the output" icon={<MessageCircle className="w-5 h-5 text-sidebar-primary" />}>
            <PromptDialog />
        </SectionLayout>
    )
}

// Need to think about this more....
function PromptDialog() {
    const { prompt, setPrompt } = useAutomationContext();
    const [content, setContent] = useState(prompt?.text || '');
    const [open, setOpen] = useState(false);
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Brain className="w-5 h-5 text-sidebar-primary" /> Background Agent
                </Button>   
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Prompt</DialogTitle>
                </DialogHeader>
                <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder='e.g., "Summarize all commits and update the changelog", "Create a weekly progress report", etc.'
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="default" onClick={() => {
                        setPrompt({ text: content });
                        setOpen(false);
                        toast.success('Prompt saved successfully');
                    }}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}