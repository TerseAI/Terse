import { MessageCircle } from "lucide-react";
import { SectionLayout } from "./components/SectionLayout";
import { BackgroundAgentCard } from "./components/BackgroundAgentCard";
import { forwardRef, ReactNode } from "react";
import { AutomationPrompt } from "../../shared/types";

type PromptSectionProps = {
    subtitle?: string;
    children?: ReactNode;
    icon?: ReactNode;
    isLoading?: boolean;
    prompt: AutomationPrompt | undefined;
    setPrompt: (prompt: AutomationPrompt | undefined) => void;
    readonly?: boolean;
}
export const PromptSection = forwardRef<HTMLDivElement, PromptSectionProps>(({ prompt, setPrompt, readonly = false }, ref) => {
    return (
        <SectionLayout ref={ref} subtitle="The AI will use this prompt to generate the output" icon={<MessageCircle className="w-5 h-5 text-sidebar-primary" />}>
            <BackgroundAgentCard prompt={prompt} setPrompt={setPrompt} readonly={readonly} />
        </SectionLayout>
    )
})