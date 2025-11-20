import { MessageCircle } from "lucide-react";
import { SectionLayout } from "./components/SectionLayout";
import { BackgroundAgentCard } from "./components/BackgroundAgentCard";
import { forwardRef, ReactNode } from "react";
import { ChannelPrompt } from "../../shared/types";

type PromptSectionProps = {
    subtitle?: string;
    children?: ReactNode;
    icon?: ReactNode;
    isLoading?: boolean;
    prompt: ChannelPrompt | undefined;
    setPrompt: (prompt: ChannelPrompt | undefined) => void;
}
export const PromptSection = forwardRef<HTMLDivElement, PromptSectionProps>(({ prompt, setPrompt }, ref) => {
    return (
        <SectionLayout ref={ref} subtitle="The AI will use this prompt to generate the output" icon={<MessageCircle className="w-5 h-5 text-sidebar-primary" />}>
            <BackgroundAgentCard prompt={prompt} setPrompt={setPrompt} />
        </SectionLayout>
    )
})