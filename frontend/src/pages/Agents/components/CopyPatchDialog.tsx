import { useState } from "react"

import { Check, Copy, Download, Terminal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type CopyPatchDialogProps = {
    patch: string
    title?: string
    onDownload?: () => void
    children: (openDialog: () => void) => React.ReactNode
}

function toFileName(title?: string): string {
    return `${(title ?? "improvement")
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase()}.patch`
}

function downloadPatchFile(patch: string, fileName: string) {
    // Ensure patch ends with newline (required by git apply)
    const content = patch.endsWith("\n") ? patch : patch + "\n"
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
}

export function CopyPatchDialog({ patch, title, onDownload, children }: CopyPatchDialogProps) {
    const [open, setOpen] = useState(false)
    const [copied, setCopied] = useState(false)
    const fileName = toFileName(title)
    const command = `git apply ~/Downloads/${fileName}`

    const handleCopy = async () => {
        await navigator.clipboard.writeText(command)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleOpen = () => {
        downloadPatchFile(patch, fileName)
        toast.success("Patch file downloaded")
        setOpen(true)
    }

    const handleOpenChange = (next: boolean) => {
        setOpen(next)
        if (!next) onDownload?.()
    }

    return (
        <>
            {children(handleOpen)}
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Apply this patch</DialogTitle>
                        <DialogDescription>The patch file has been downloaded. Run the following command in your project directory to apply it:</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 font-mono text-xs">
                        <Terminal className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <code className="flex-1 select-all break-all leading-5">{command}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mr-1" onClick={handleCopy} aria-label="Copy command">
                            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                    <DialogFooter className="flex gap-2 sm:gap-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                downloadPatchFile(patch, fileName)
                                toast.success("Patch file downloaded again")
                            }}
                        >
                            <Download className="h-4 w-4 mr-1.5" />
                            Download again
                        </Button>
                        <Button variant="outline" onClick={() => handleOpenChange(false)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
