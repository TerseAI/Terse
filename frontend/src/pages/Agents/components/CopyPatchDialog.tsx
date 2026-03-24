import { useState } from "react"

import { AlertTriangle, Terminal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type CopyPatchDialogProps = {
    patch: string
    children: (openDialog: () => void) => React.ReactNode
}

export function CopyPatchDialog({ patch, children }: CopyPatchDialogProps) {
    const [open, setOpen] = useState(false)

    const handleOpen = () => {
        navigator.clipboard.writeText(patch)
        toast.success("Patch copied to clipboard")
        setOpen(true)
    }

    return (
        <>
            {children(handleOpen)}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Apply this patch</DialogTitle>
                        <DialogDescription>The patch has been copied to your clipboard. Run the following command in your project directory to apply it:</DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 font-mono text-sm">
                        <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
                        <code className="flex-1 select-all">pbpaste | git apply</code>
                    </div>
                    <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>Don't copy the command above — it will overwrite the patch in your clipboard. Type it manually.</span>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
