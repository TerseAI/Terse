import { Check, Eye, Pencil, Plus, Trash2, XCircle } from "lucide-react"

import type { RunHistoryActionType } from "@/shared/RunHistoryTypes"

export type NotificationActionOption = {
    value: RunHistoryActionType
    label: string
    icon: React.ReactNode
}

export const NOTIFICATION_ACTION_OPTIONS: NotificationActionOption[] = [
    { value: "create", label: "Create", icon: <Plus className="h-4 w-4" /> },
    { value: "update", label: "Update", icon: <Pencil className="h-4 w-4" /> },
    { value: "delete", label: "Delete", icon: <Trash2 className="h-4 w-4" /> },
    { value: "read", label: "Read", icon: <Eye className="h-4 w-4" /> },
    { value: "approve", label: "Approval", icon: <Check className="h-4 w-4" /> },
    { value: "error", label: "Error", icon: <XCircle className="h-4 w-4" /> }
]
