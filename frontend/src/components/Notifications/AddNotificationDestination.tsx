import { PlusIcon } from "lucide-react"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { useState } from "react"
import { NotificationDestinationForm } from "./NotificationDestinationForm"

export function AddNotificationDestination() {
    return (
        <div>
            <AddNotificationDestinationDialog />
        </div>
    )
}

function AddNotificationDestinationDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <PlusIcon />
                    Add Notification Channel
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Notification Destination</DialogTitle>
                    <DialogDescription>Add a notification channel to be notified when a background agent makes a change.</DialogDescription>
                </DialogHeader>
                <NotificationDestinationForm onSuccess={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    )
}
