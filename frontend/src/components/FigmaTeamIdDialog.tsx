import { useEffect, useState } from "react"

import { Check } from "lucide-react"

import { buildFigmaFileUrl, extractFileKeyFromFigmaUrl, extractTeamIdFromFigmaUrl } from "../utility/figmaUtils"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

interface FigmaConfigDialogProps {
    open: boolean
    onClose: () => void
    onSave: (fileKey: string, fileName?: string, teamId?: string) => void
    currentFileKey?: string
    currentFileName?: string
    currentTeamId?: string
}

// Rename export for backward compatibility
export const FigmaTeamIdDialog = FigmaConfigDialog

export function FigmaConfigDialog({ open, onClose, onSave, currentFileKey, currentTeamId }: FigmaConfigDialogProps) {
    const [fileUrl, setFileUrl] = useState("")
    const [teamUrl, setTeamUrl] = useState("")
    const [extractedFileKey, setExtractedFileKey] = useState<string | null>(null)
    const [extractedTeamId, setExtractedTeamId] = useState<string | null>(null)
    const [fileError, setFileError] = useState<string | null>(null)
    const [teamError, setTeamError] = useState<string | null>(null)

    // Initialize URLs from current values when dialog opens
    useEffect(() => {
        if (open) {
            // Reset and reload values when dialog opens
            if (currentFileKey) {
                setFileUrl(buildFigmaFileUrl(currentFileKey))
                setExtractedFileKey(currentFileKey)
            } else {
                setFileUrl("")
                setExtractedFileKey(null)
            }

            if (currentTeamId) {
                // Set teamUrl to the team ID (it can be just the ID or a URL)
                setTeamUrl(currentTeamId)
                setExtractedTeamId(currentTeamId)
            } else {
                setTeamUrl("")
                setExtractedTeamId(null)
            }

            // Clear errors when dialog opens
            setFileError(null)
            setTeamError(null)
        } else {
            // Reset when dialog closes
            setFileUrl("")
            setTeamUrl("")
            setExtractedFileKey(null)
            setExtractedTeamId(null)
            setFileError(null)
            setTeamError(null)
        }
    }, [open, currentFileKey, currentTeamId])

    const handleFileUrlChange = (value: string) => {
        setFileUrl(value)
        setFileError(null)

        if (value.trim()) {
            const fileKey = extractFileKeyFromFigmaUrl(value)
            if (fileKey) {
                setExtractedFileKey(fileKey)
                setFileError(null)
            } else {
                setExtractedFileKey(null)
                if (value.trim().length > 10) {
                    setFileError("Please enter a valid file ID (22+ alphanumeric characters) or file URL")
                }
            }
        } else {
            setExtractedFileKey(null)
        }
    }

    const handleTeamUrlChange = (value: string) => {
        setTeamUrl(value)
        setTeamError(null)

        if (value.trim()) {
            const teamId = extractTeamIdFromFigmaUrl(value)
            if (teamId) {
                setExtractedTeamId(teamId)
                setTeamError(null)
            } else {
                setExtractedTeamId(null)
                if (value.trim().length > 5) {
                    setTeamError("Please enter a valid team ID (numbers only) or team URL")
                }
            }
        } else {
            setExtractedTeamId(null)
        }
    }

    const handleSave = () => {
        if (!extractedFileKey) {
            setFileError("Please enter a valid file ID or file URL")
            return
        }
        if (!extractedTeamId) {
            setTeamError("Please enter a valid team ID or team URL")
            return
        }

        // Extract file name from URL if possible
        const urlParts = fileUrl.split("/")
        const fileNamePart = urlParts[urlParts.length - 1]
        const fileName = fileNamePart && fileNamePart.includes("?") ? fileNamePart.split("?")[0] : fileNamePart
        const cleanFileName = fileName && fileName !== extractedFileKey ? decodeURIComponent(fileName) : undefined

        onSave(extractedFileKey, cleanFileName, extractedTeamId)
        onClose()
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Configure listening to Figma file changes</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    {/* Team URL Input */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="team-url" className="text-sm font-medium">
                            Figma Team URL <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="team-url"
                            type="text"
                            placeholder="Team ID or URL (e.g., 1557541588002670308 or https://www.figma.com/files/team/...)"
                            value={teamUrl}
                            onChange={e => handleTeamUrlChange(e.target.value)}
                            className={teamError ? "border-red-500" : ""}
                        />
                        {teamError && <p className="text-sm text-red-600">{teamError}</p>}
                        {extractedTeamId && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                                <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                                <span className="text-sm text-green-700 dark:text-green-300">
                                    Team ID extracted: <span className="font-mono font-semibold">{extractedTeamId}</span>
                                </span>
                            </div>
                        )}
                        <p className="text-xs text-[theme(text-secondary)]">Paste your team ID directly or the admin console URL / any Figma file URL from your team workspace.</p>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="instructions" className="border border-[theme(border)] rounded-lg bg-[theme(background-light)]">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                <Label className="text-sm font-medium">How to find your Team ID</Label>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                                <ol className="list-decimal list-inside space-y-2 text-sm text-[theme(text-secondary)]">
                                    <li>Navigate to the admin console of your Figma team</li>
                                    <li>Check the URL in your browser's address bar</li>
                                    <li>Copy the URL and paste it in the field above</li>
                                    <li>The team ID is the series of numbers in the URL - you can paste the ID directly or the full URL</li>
                                </ol>
                                <p className="text-xs text-[theme(text-secondary)] mt-2">
                                    You can paste the team ID directly (just the numbers) or any Figma file URL from your team workspace - both formats are supported.
                                </p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    {/* File URL Input */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="file-url" className="text-sm font-medium">
                            Figma File URL <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="file-url"
                            type="text"
                            placeholder="File ID or URL (e.g., abc123def456... or https://www.figma.com/design/...)"
                            value={fileUrl}
                            onChange={e => handleFileUrlChange(e.target.value)}
                            className={fileError ? "border-red-500" : ""}
                            disabled={!extractedTeamId}
                        />
                        {fileError && <p className="text-sm text-red-600">{fileError}</p>}
                        {extractedFileKey && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                                <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                                <span className="text-sm text-green-700 dark:text-green-300">
                                    File ID extracted: <span className="font-mono font-semibold">{extractedFileKey}</span>
                                </span>
                            </div>
                        )}
                        <p className="text-xs text-[theme(text-secondary)]">
                            {extractedTeamId ? "Paste your file ID directly or a Figma file URL to monitor for comments" : "Please provide your team ID first"}
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!extractedFileKey || !extractedTeamId}>
                        Save Configuration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
