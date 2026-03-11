import { Check, Eye, Pencil, Plus, Trash2, XCircle } from "lucide-react"

import type { RunHistoryActionType } from "@/shared/RunHistoryTypes"

export type NotificationActionOption = {
    value: RunHistoryActionType
    label: string
    icon: React.ReactNode
}

export const NOTIFICATION_ACTION_OPTIONS: NotificationActionOption[] = [
    { value: "create", label: "Create actions", icon: <Plus className="h-4 w-4" /> },
    { value: "update", label: "Update actions", icon: <Pencil className="h-4 w-4" /> },
    { value: "delete", label: "Delete actions", icon: <Trash2 className="h-4 w-4" /> },
    { value: "read", label: "Read actions", icon: <Eye className="h-4 w-4" /> },
    { value: "approve", label: "Approval requests", icon: <Check className="h-4 w-4" /> },
    { value: "error", label: "Errors", icon: <XCircle className="h-4 w-4" /> }
]
