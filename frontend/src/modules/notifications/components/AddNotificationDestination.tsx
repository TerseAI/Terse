import { ReactNode, useState } from "react"

import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

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
            <DialogContent className="max-w-lg flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Add Notification Destination</DialogTitle>
                    <DialogDescription>Choose where agent notifications should be sent.</DialogDescription>
                </DialogHeader>
                <NotificationDestinationForm onSuccess={() => handleOpenChange(false)} onCancel={() => handleOpenChange(false)} />
            </DialogContent>
        </Dialog>
    )
}
