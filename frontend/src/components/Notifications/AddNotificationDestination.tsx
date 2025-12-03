import { PlusIcon } from "lucide-react"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"

export function AddNotificationDestination() {
    return (
        <div>
            <AddNotificationDestinationDialog />
        </div>
    )
}

function AddNotificationDestinationDialog() {
    return (
        <Dialog>
            <DialogTrigger>
                <Button variant="outline">
                    <PlusIcon />
                    Add Notification Channel
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Notification Destination</DialogTitle>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}