import { MessageCircle } from "lucide-react";
import { SectionLayout } from "./components/SectionLayout";
import { BackgroundAgentCard } from "./components/BackgroundAgentCard";

export function PromptSection() {
    return (
        <SectionLayout title="Prompt" subtitle="The AI will use this prompt to generate the output" icon={<MessageCircle className="w-5 h-5 text-sidebar-primary" />}>
            <BackgroundAgentCard />
        </SectionLayout>
    )
}