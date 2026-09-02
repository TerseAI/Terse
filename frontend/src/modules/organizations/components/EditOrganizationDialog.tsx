import { useEffect, useRef, useState } from "react"

import { ImagePlus, Loader2, X } from "lucide-react"
import { useSWRConfig } from "swr"
import { DEFAULT_EXECUTION_REGION, EXECUTION_REGIONS, type ExecutionRegion, executionRegionLabel } from "terse-types/ExecutionRegions"
import { orgLogoKey, userOrganizationsKey } from "terse-types/InvalidationKeys"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BackendProvider } from "@/lib/http"
import { useAuth } from "@/modules/auth/context/AuthProvider"
import { useCurrentOrganization } from "@/modules/organizations/api/useCurrentOrganization"
import { useOrgLogo } from "@/modules/organizations/api/useOrgLogo"

interface EditOrganizationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditOrganizationDialog({ open, onOpenChange }: EditOrganizationDialogProps) {
    const { user, refreshUser } = useAuth()
    const { logoUrl, mutate: mutateLogo } = useOrgLogo(user?.organizationId)
    const { organization, mutate: mutateCurrentOrganization } = useCurrentOrganization(user?.organizationId)
    const { mutate } = useSWRConfig()

    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [orgName, setOrgName] = useState("")
    const [executionRegion, setExecutionRegion] = useState<ExecutionRegion>(DEFAULT_EXECUTION_REGION)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const currentOrgName = user?.organizationName || "Organization"
    const currentExecutionRegion = organization?.executionRegion ?? DEFAULT_EXECUTION_REGION
    const supportsExecutionRegion = organization !== undefined && organization.executionRegion !== null
    const isAdmin = user?.roles?.includes("admin") ?? false

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setOrgName(currentOrgName)
            setExecutionRegion(currentExecutionRegion)
            setError(null)
        }
    }, [open, currentOrgName, currentExecutionRegion])

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
        setExecutionRegion(currentExecutionRegion)
        onOpenChange(false)
    }

    const nameChanged = orgName.trim() !== currentOrgName
    const executionRegionChanged = supportsExecutionRegion && executionRegion !== currentExecutionRegion
    const hasChanges = nameChanged || executionRegionChanged || logoFile !== null

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
            if (nameChanged || executionRegionChanged) {
                await BackendProvider.updateOrganization({
                    ...(nameChanged ? { name: orgName.trim() } : {}),
                    ...(executionRegionChanged ? { executionRegion } : {})
                })
                await mutateCurrentOrganization()
                if (nameChanged) {
                    await refreshUser()
                    await mutate(userOrganizationsKey())
                }
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

    const displayLogo = logoPreview || logoUrl || "/terse-160.png"

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

                    {supportsExecutionRegion && (
                        <div className="space-y-2">
                            <Label htmlFor="execution-region">Execution region</Label>
                            {isAdmin ? (
                                <Select value={executionRegion} onValueChange={value => setExecutionRegion(value as ExecutionRegion)} disabled={isSaving}>
                                    <SelectTrigger id="execution-region" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EXECUTION_REGIONS.map(region => (
                                            <SelectItem key={region} value={region}>
                                                {executionRegionLabel(region)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-sm text-muted-foreground">{executionRegionLabel(currentExecutionRegion)}</p>
                            )}
                            <p className="text-sm text-muted-foreground">Controls where new workflow runs execute. It does not change where your organization’s data is stored.</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Organization Logo</Label>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={displayLogo} alt={orgName || currentOrgName} />
                                    <AvatarFallback>{(orgName || currentOrgName).slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                {logoPreview && (
                                    <Button type="button" variant="default" size="icon" onClick={clearLogo} disabled={isSaving} className="absolute -top-3 -right-3 h-7 w-7 rounded-full">
                                        <X className="h-3.5 w-3.5" />
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

                    {error && (
                        <p role="alert" className="text-sm text-danger">
                            {error}
                        </p>
                    )}
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
