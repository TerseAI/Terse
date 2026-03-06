import { ReactNode, useState } from "react"

import { PlusIcon } from "lucide-react"

import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"

import { NotificationDestinationForm } from "./NotificationDestinationForm"

interface AddNotificationDestinationProps {
    trigger?: ReactNode
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function AddNotificationDestination({ trigger, externalOpen, onExternalOpenChange }: AddNotificationDestinationProps) {
    const [internalOpen, setInternalOpen] = useState(false)

    const open = externalOpen ?? internalOpen

    const handleOpenChange = (nextOpen: boolean) => {
        if (externalOpen === undefined) {
            setInternalOpen(nextOpen)
        }

        onExternalOpenChange?.(nextOpen)
    }

    const defaultTrigger = (
        <Button variant="outline">
            <PlusIcon />
            Add Destination
        </Button>
    )

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
            <DialogContent className="sm:max-w-[760px] p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-5 border-b bg-gradient-to-r from-muted/60 via-muted/25 to-background">
                    <div className="space-y-1">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <DialogTitle className="text-xl">Add Notification Destination</DialogTitle>
                            </div>
                        </div>
                    </div>
                </DialogHeader>
                <NotificationDestinationForm onSuccess={() => handleOpenChange(false)} />
            </DialogContent>
        </Dialog>
    )
}
