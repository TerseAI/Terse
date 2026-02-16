import { ReactNode, useState } from "react"

import { PlusIcon } from "lucide-react"

import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"

import { NotificationDestinationForm } from "./NotificationDestinationForm"

interface AddNotificationDestinationProps {
    trigger?: ReactNode
}

export function AddNotificationDestination({ trigger }: AddNotificationDestinationProps) {
    const [open, setOpen] = useState(false)

    const defaultTrigger = (
        <Button variant="outline">
            <PlusIcon />
            Add Notification Channel
        </Button>
    )

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Notification Destination</DialogTitle>
                    <DialogDescription>Add a Slack channel or one individual DM destination for background agent notifications.</DialogDescription>
                </DialogHeader>
                <NotificationDestinationForm onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    )
}
