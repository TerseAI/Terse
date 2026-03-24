import { useState } from "react"

import { Download, Terminal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type CopyPatchDialogProps = {
    patch: string
    title?: string
    children: (openDialog: () => void) => React.ReactNode
}

function toFileName(title?: string): string {
    return `${(title ?? "improvement").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase()}.patch`
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

export function CopyPatchDialog({ patch, title, children }: CopyPatchDialogProps) {
    const [open, setOpen] = useState(false)
    const fileName = toFileName(title)

    const handleOpen = () => {
        downloadPatchFile(patch, fileName)
        toast.success("Patch file downloaded")
        setOpen(true)
    }

    return (
        <>
            {children(handleOpen)}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Apply this patch</DialogTitle>
                        <DialogDescription>The patch file has been downloaded. Run the following command in your project directory to apply it:</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 font-mono text-sm">
                        <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
                        <code className="flex-1 select-all">git apply ~/Downloads/{fileName}</code>
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
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
