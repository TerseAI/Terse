import { useState } from "react"

import { ExternalLink, Settings } from "lucide-react"

import { buildFigmaFileUrl } from "../utility/figmaUtils"

import { FigmaConfigDialog } from "./FigmaTeamIdDialog"
import { Button } from "./ui/button"

interface FigmaFileSelectorProps {
    selectedFileKey?: string
    selectedFileName?: string
    selectedTeamId?: string
    onSelect: (fileKey: string, fileName?: string, teamId?: string) => void
}

export function FigmaFileSelector({ selectedFileKey, selectedFileName, selectedTeamId, onSelect }: FigmaFileSelectorProps) {
    const [showDialog, setShowDialog] = useState(false)

    const hasConfiguration = selectedFileKey && selectedTeamId

    return (
        <div className="flex flex-col gap-3">
            {hasConfiguration ? (
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-[theme(border)] bg-[theme(background-light)]">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1 flex-1">
                            <span className="text-sm font-medium text-[theme(text-primary)]">{selectedFileName || "Design File"}</span>
                            <span className="text-xs text-[theme(text-secondary)] font-mono">File ID: {selectedFileKey}</span>
                            <span className="text-xs text-[theme(text-secondary)] font-mono">Team ID: {selectedTeamId}</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-[theme(text-secondary)] shrink-0" />
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={buildFigmaFileUrl(selectedFileKey)} target="_blank" rel="noopener noreferrer" className="text-sm text-[theme(--color-accent)] hover:underline flex items-center gap-1">
                            View in Figma
                            <ExternalLink className="w-3 h-3" />
                        </a>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowDialog(true)} className="ml-auto">
                            <Settings className="w-4 h-4" />
                            Edit
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowDialog(true)} className="w-full">
                        <Settings className="w-4 h-4 mr-2" />
                        Configure Figma File
                    </Button>
                    <p className="text-xs text-[theme(text-secondary)] text-center">Click to configure your Figma file and team ID</p>
                </div>
            )}

            <FigmaConfigDialog
                open={showDialog}
                onClose={() => setShowDialog(false)}
                onSave={onSelect}
                currentFileKey={selectedFileKey}
                currentFileName={selectedFileName}
                currentTeamId={selectedTeamId}
            />
        </div>
    )
}
