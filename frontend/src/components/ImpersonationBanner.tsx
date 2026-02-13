import { EyeIcon } from "lucide-react"

import { useAuth } from "@/services/auth"

export function ImpersonationBanner() {
    const { user, logout } = useAuth()

    if (!user?.impersonator) {
        return null
    }

    return (
        <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-black">
            <div className="flex items-center gap-2">
                <EyeIcon className="size-4" />
                <span>
                    Impersonating <strong>{user.email}</strong> &mdash; {user.impersonator.email}
                    {user.impersonator.reason ? ` (${user.impersonator.reason})` : ""}
                </span>
            </div>
            <button
                onClick={logout}
                className="rounded bg-black/15 px-3 py-1 text-xs font-semibold transition-colors hover:bg-black/25"
            >
                Stop impersonating
            </button>
        </div>
    )
}
