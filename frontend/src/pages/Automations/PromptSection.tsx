import { MessageCircle } from "lucide-react";
import { SectionLayout } from "./components/SectionLayout";
import { BackgroundAgentCard } from "./components/BackgroundAgentCard";
import { forwardRef, ReactNode } from "react";

type PromptSectionProps = {
    subtitle?: string;
    children?: ReactNode;
    icon?: ReactNode;
    isLoading?: boolean;
}
export const PromptSection = forwardRef<HTMLDivElement, PromptSectionProps>((_, ref) => {
    return (
        <SectionLayout ref={ref} subtitle="The AI will use this prompt to generate the output" icon={<MessageCircle className="w-5 h-5 text-sidebar-primary" />}>
            <BackgroundAgentCard />
        </SectionLayout>
    )
})