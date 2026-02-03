import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AgentTemplate } from "@/shared/types"

import { TemplateAppsList } from "./TemplateAppsList"

interface TemplateCardProps {
    template: AgentTemplate
    onSelect: (template: AgentTemplate) => void
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
    const handleClick = () => {
        onSelect(template)
    }

    return (
        <Card className="cursor-pointer transition-colors hover:bg-accent/50 py-4" onClick={handleClick}>
            <CardHeader className="pb-2 gap-1">
                <CardTitle className="text-base">{template.name}</CardTitle>
                {template.description && <CardDescription className="line-clamp-2">{template.description}</CardDescription>}
            </CardHeader>
            <CardContent className="pt-0">
                <TemplateAppsList template={template} />
            </CardContent>
        </Card>
    )
}
