export function formatApprovalNotificationFor(action: string | undefined): string {
    if (!action || action.trim() === "") {
        return "Approval requested"
    }

    const cleanedAction = action.trim()
    if (/^approval requested for\b/i.test(cleanedAction)) {
        return cleanedAction
    }

    return `Approval requested for ${cleanedAction}`
}
