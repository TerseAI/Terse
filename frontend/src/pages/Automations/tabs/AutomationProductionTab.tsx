import { useRef } from "react";
import { InputsSection } from "../InputSection";
import { OutputSection } from "../OutputSection";
import { AutomationVersion } from "@/shared/types";
import { Conn, SVGFlowArrows } from "../components/FlowArrow";
import { PromptSection } from "../PromptSection";
import EditableTextField from '../../../components/ui/EditableTextField';
import { Badge } from "@/components/ui/badge";
import { useAutomationVersions } from "@/hooks/api/useAutomations";

type AutomationProductionTabProps = {
    automationId: string | null;
    productionVersion: AutomationVersion | undefined;
    automationName?: string;
};

export default function AutomationProductionTab({ automationId, productionVersion, automationName }: AutomationProductionTabProps) {
    const { versions } = useAutomationVersions(automationId);
    
    // Calculate version number by counting production versions
    const productionVersions = versions.filter(v => v.status === 'PRODUCTION');
    const versionNumber = productionVersions.length;

    const containerRef = useRef<HTMLDivElement>(null);
    const inputsSectionRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const PromptSectionRef = useRef<HTMLDivElement>(null);
    const OutputSectionRef = useRef<HTMLDivElement>(null);

    const createMapElementRef = (mapRef: React.RefObject<Map<string, HTMLDivElement>>, inputId: string): React.RefObject<HTMLDivElement | null> => {
        return {
            get current() {
                return mapRef.current?.get(inputId) || null;
            }
        } as React.RefObject<HTMLDivElement | null>;
    };

    const connections: Conn[] = []
    
    if (productionVersion?.inputs && productionVersion.inputs.length > 0 && inputsSectionRef.current != null && inputsSectionRef.current.size > 0) {
        productionVersion.inputs.forEach((input) => {
            if (input.integration != null && input.integrationId != null) {
                const inputId = input.id || input.integrationId || '';
                const inputCardRef = createMapElementRef(inputsSectionRef, inputId);
                connections.push({ 
                    id: `input-to-prompt-${input.integration}-${input.integrationId}`, 
                    from: inputCardRef, 
                    to: PromptSectionRef 
                });
            }
        });
    }
    if (productionVersion?.prompt != null && PromptSectionRef.current != null && OutputSectionRef.current != null && productionVersion?.output != null) {
        connections.push({ id: 'prompt-to-output', from: PromptSectionRef, to: OutputSectionRef });
    }

    if (!productionVersion) {
        return (
            <div className="flex flex-col h-full p-4 overflow-y-auto gap-6 items-center justify-center">
                <p className="text-muted-foreground">No production version available</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full p-4 overflow-y-auto gap-6">
            <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                    <EditableTextField 
                        value={automationName || 'Production Automation'} 
                        onSave={() => {}} 
                        readonly={true}
                    />
                    <Badge variant="secondary" className="text-sm">
                        Version {versionNumber}
                    </Badge>
                </div>
            </div>

            <div ref={containerRef} className="grid grid-flow-col place-items-center gap-3 relative">
                <InputsSection 
                    ref={inputsSectionRef} 
                    inputs={productionVersion.inputs} 
                    setInputs={() => {}} 
                    isLoading={false}
                    readonly={true}
                />

                <PromptSection 
                    ref={PromptSectionRef} 
                    prompt={productionVersion.prompt} 
                    setPrompt={() => {}} 
                    readonly={true}
                />

                <OutputSection 
                    ref={OutputSectionRef} 
                    output={productionVersion.output} 
                    setOutput={() => {}} 
                    isLoading={false}
                    readonly={true}
                />

                {connections.length > 0 && (
                    <SVGFlowArrows containerRef={containerRef} connections={connections} />
                )}
            </div>
        </div>
    );
}
