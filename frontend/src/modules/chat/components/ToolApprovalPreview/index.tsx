import { AttioCreateRecordPreview, AttioDeleteRecordPreview, AttioUpdateRecordPreview, AttioUpsertRecordPreview } from "./AttioRecordsPreview"

export interface ToolPreviewProps {
    parameters: string
    onSendMessage?: (message: string) => void
}

const TOOL_PREVIEW_REGISTRY: Record<string, React.ComponentType<ToolPreviewProps>> = {
    attio_create_record: AttioCreateRecordPreview,
    attio_update_record: AttioUpdateRecordPreview,
    attio_upsert_record: AttioUpsertRecordPreview,
    attio_delete_record: AttioDeleteRecordPreview
}

interface ToolApprovalPreviewProps {
    toolName: string
    parameters?: string
    onSendMessage?: (message: string) => void
}

export default function ToolApprovalPreview({ toolName, parameters, onSendMessage }: ToolApprovalPreviewProps) {
    if (!parameters) return null

    const PreviewComponent = TOOL_PREVIEW_REGISTRY[toolName]
    if (!PreviewComponent) return null

    return <PreviewComponent parameters={parameters} onSendMessage={onSendMessage} />
}

export function hasCustomPreview(toolName: string): boolean {
    return toolName in TOOL_PREVIEW_REGISTRY
}
