import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChannelTemplate } from '@/shared/types';
import { TemplateAppsList } from './TemplateAppsList';

interface TemplateCardProps {
    template: ChannelTemplate;
    templateIndex: number;
}

export function TemplateCard({ template, templateIndex }: TemplateCardProps) {
    const navigate = useNavigate();

    const handleClick = () => {
        navigate(`/app/channels/new/template/${templateIndex}`);
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
