import { ReactNode, useState } from "react"

import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { cn } from "@/lib/utils"

interface IntegrationItemProps {
    icon: ReactNode
    title: string
    description?: ReactNode
    className?: string
    onDelete?: () => Promise<void>
    deleteConfirmTitle?: string
    deleteConfirmDescription?: string
}

export function IntegrationItem({ icon, title, description, className, onDelete, deleteConfirmTitle, deleteConfirmDescription }: IntegrationItemProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    const handleDelete = async () => {
        if (!onDelete) return
        setIsDeleting(true)
        try {
            await onDelete()
            setShowDeleteDialog(false)
        } catch (error) {
            console.error("Failed to delete integration:", error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <Item variant="outline" size="sm" className={cn("rounded-lg", className)}>
                <ItemMedia variant="icon" className="size-8 rounded-full bg-primary/10 [&_svg]:text-primary">
                    {icon}
                </ItemMedia>
                <ItemContent>
                    <ItemTitle className="truncate">{title}</ItemTitle>
                    {description && <ItemDescription className="mt-0.5">{description}</ItemDescription>}
                </ItemContent>
                {onDelete && (
                    <ItemActions>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setShowDeleteDialog(true)} disabled={isDeleting} title="Remove connection">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </ItemActions>
                )}
            </Item>

            {onDelete && (
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <DialogContent showCloseButton={false}>
                        <DialogHeader>
                            <DialogTitle>{deleteConfirmTitle || "Remove Connection"}</DialogTitle>
                            <DialogDescription>{deleteConfirmDescription || `Are you sure you want to remove this connection? This action cannot be undone.`}</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting ? "Removing..." : "Remove"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}
