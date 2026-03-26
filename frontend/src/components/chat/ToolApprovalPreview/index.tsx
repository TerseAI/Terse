import AttioUpsertRecordPreview from "./AttioUpsertRecordPreview"

const TOOL_PREVIEW_REGISTRY: Record<string, React.ComponentType<{ parameters: string }>> = {
    attio_upsert_record: AttioUpsertRecordPreview
}

interface ToolApprovalPreviewProps {
    toolName: string
    parameters?: string
}

export default function ToolApprovalPreview({ toolName, parameters }: ToolApprovalPreviewProps) {
    if (!parameters) return null

    const PreviewComponent = TOOL_PREVIEW_REGISTRY[toolName]
    if (!PreviewComponent) return null

    return <PreviewComponent parameters={parameters} />
}

export function hasCustomPreview(toolName: string): boolean {
    return toolName in TOOL_PREVIEW_REGISTRY
}
