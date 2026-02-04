import { useEffect, useRef, useState } from "react"

import { ImagePlus, Loader2, X } from "lucide-react"
import { useSWRConfig } from "swr"

import { useOrgLogo } from "@/hooks/api/useOrgLogo"
import { useAuth } from "@/services/auth"
import { BackendProvider } from "@/services/backend"
import { orgLogoKey } from "@/shared/InvalidationKeys"

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"

interface EditOrganizationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditOrganizationDialog({ open, onOpenChange }: EditOrganizationDialogProps) {
    const { user, refreshUser } = useAuth()
    const { logoUrl, mutate: mutateLogo } = useOrgLogo(user?.organizationId)
    const { mutate } = useSWRConfig()

    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [orgName, setOrgName] = useState("")
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const currentOrgName = user?.organizationName || "Organization"
    const isAdmin = user?.roles?.includes("admin") ?? false

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setOrgName(currentOrgName)
            setError(null)
        }
    }, [open, currentOrgName])

    function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith("image/")) {
            setError("Please select an image file")
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Logo must be less than 5MB")
            return
        }

        setLogoFile(file)
        setLogoPreview(URL.createObjectURL(file))
        setError(null)
    }

    function clearLogo() {
        setLogoFile(null)
        if (logoPreview) {
            URL.revokeObjectURL(logoPreview)
            setLogoPreview(null)
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    function handleClose() {
        clearLogo()
        setError(null)
        setOrgName(currentOrgName)
        onOpenChange(false)
    }

    const hasChanges = orgName.trim() !== currentOrgName || logoFile !== null

    async function handleSave() {
        if (!hasChanges) {
            handleClose()
            return
        }

        if (!orgName.trim()) {
            setError("Organization name is required")
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            // Update name if changed
            if (orgName.trim() !== currentOrgName) {
                await BackendProvider.updateOrganization(orgName.trim())
                await refreshUser()
            }

            // Upload logo if selected
            if (logoFile) {
                await BackendProvider.uploadOrgLogo(logoFile)
                await mutate(orgLogoKey(user?.organizationId))
                await mutateLogo()
            }

            handleClose()
        } catch {
            setError("Failed to update organization. Please try again.")
        } finally {
            setIsSaving(false)
        }
    }

    const displayLogo = logoPreview || logoUrl || "/terse.png"

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Organization</DialogTitle>
                    <DialogDescription>Update your organization settings.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        {isAdmin ? (
                            <Input id="org-name" value={orgName} onChange={e => setOrgName(e.target.value)} disabled={isSaving} placeholder="Enter organization name" />
                        ) : (
                            <p className="text-sm text-muted-foreground">{currentOrgName}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Organization Logo</Label>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={displayLogo} alt={orgName || currentOrgName} />
                                    <AvatarFallback>{(orgName || currentOrgName).slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                {logoPreview && (
                                    <Button type="button" variant="destructive" size="icon" onClick={clearLogo} disabled={isSaving} className="absolute -top-2 -right-2 h-5 w-5 rounded-full">
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                            {isAdmin ? (
                                <>
                                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                                        <ImagePlus className="h-4 w-4 mr-2" />
                                        {logoPreview ? "Change" : "Upload"}
                                    </Button>
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                                </>
                            ) : (
                                <span className="text-sm text-muted-foreground">Only admins can edit organization settings</span>
                            )}
                        </div>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    {isAdmin && (
                        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                "Save"
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
