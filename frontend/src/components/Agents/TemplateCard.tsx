import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AgentTemplate } from '@/shared/types';
import { TemplateAppsList } from './TemplateAppsList';
import { FrontendRoutes } from '@/shared/FrontendRoutes';

interface TemplateCardProps {
    template: AgentTemplate;
    templateIndex: number;
}

export function TemplateCard({ template, templateIndex }: TemplateCardProps) {
    const navigate = useNavigate();

    const handleClick = () => {
        navigate(FrontendRoutes.AGENTS.NEW_WITH_TEMPLATE.build(templateIndex.toString()));
    };

    return (
        <Card
            className="cursor-pointer transition-colors hover:bg-accent/50 py-4"
            onClick={handleClick}
        >
            <CardHeader className="pb-2 gap-1">
                <CardTitle className="text-base">{template.name}</CardTitle>
                {template.description && (
                    <CardDescription className="line-clamp-2">
                        {template.description}
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="pt-0">
                <TemplateAppsList template={template} />
            </CardContent>
        </Card>
    );
}
