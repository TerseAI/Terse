import { useNavigate } from "react-router-dom"

import { Loader2 } from "lucide-react"

import { useTemplates } from "@/hooks/api/useTemplates"

import { FrontendRoutes } from "../../shared/FrontendRoutes"

import { TemplateCard } from "./TemplateCard"

export function TemplatesGrid() {
    const { templates, isLoading } = useTemplates()
    const navigate = useNavigate()

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (templates.length === 0) {
        return null
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold">Get started with a template</h3>
                <p className="text-sm text-muted-foreground">Choose a template to quickly set up a new channel</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template, index) => (
                    <TemplateCard key={index} template={template} onSelect={() => navigate(FrontendRoutes.AGENTS.SETUP, { state: { template } })} />
                ))}
            </div>
        </div>
    )
}
