import AttioUpsertRecordPreview from "./AttioUpsertRecordPreview"

export interface ToolPreviewProps {
    parameters: string
    editedArguments?: string
    onEditedArgumentsChange?: (editedArguments?: string) => void
    onSendMessage?: (message: string) => void
}

const TOOL_PREVIEW_REGISTRY: Record<string, React.ComponentType<ToolPreviewProps>> = {
    attio_upsert_record: AttioUpsertRecordPreview
}

interface ToolApprovalPreviewProps {
    toolName: string
    parameters?: string
    editedArguments?: string
    onEditedArgumentsChange?: (editedArguments?: string) => void
    onSendMessage?: (message: string) => void
}

export default function ToolApprovalPreview({ toolName, parameters, editedArguments, onEditedArgumentsChange, onSendMessage }: ToolApprovalPreviewProps) {
    if (!parameters) return null

    const PreviewComponent = TOOL_PREVIEW_REGISTRY[toolName]
    if (!PreviewComponent) return null

    return <PreviewComponent parameters={parameters} editedArguments={editedArguments} onEditedArgumentsChange={onEditedArgumentsChange} onSendMessage={onSendMessage} />
}

export function hasCustomPreview(toolName: string): boolean {
    return toolName in TOOL_PREVIEW_REGISTRY
}
