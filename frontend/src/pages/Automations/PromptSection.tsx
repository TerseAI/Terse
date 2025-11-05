import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAutomationContext } from "@/context/AutomationContext";
import { SectionLayout } from "./components/SectionLayout";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PromptSection() {
    const { isLoading } = useAutomationContext();
    return (
        <SectionLayout title="Prompt" subtitle="The AI will use this prompt to generate the output" icon={<MessageCircle className="w-5 h-5 text-sidebar-primary" />}>
            <PromptDialog />
        </SectionLayout>
    )
}

function PromptDialog() {
    const { prompt, setPrompt } = useAutomationContext();
    const [content, setContent] = useState(prompt?.text || '');
    const [open, setOpen] = useState(false);
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <MessageCircle className="w-5 h-5 text-sidebar-primary" /> Edit Prompt
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Prompt</DialogTitle>
                </DialogHeader>
                <Textarea
                    value={prompt?.text || ''}
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