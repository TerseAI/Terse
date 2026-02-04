import { useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"

import { zodResolver } from "@hookform/resolvers/zod"
import { AxiosError } from "axios"
import { ImagePlus, Loader2, X } from "lucide-react"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/services/auth"
import { BackendProvider } from "@/services/backend"
import { FrontendRoutes } from "@/shared/FrontendRoutes"

export default function OrganizationCreationForm() {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const navigate = useNavigate()
    const { user, refreshUser } = useAuth()

    const needsName = !user?.firstName?.trim() && !user?.lastName?.trim()

    const organizationCreationSchema = useMemo(
        () =>
            z
                .object({
                    name: z.string().min(1, "Organization name is required"),
                    firstName: z.string().optional(),
                    lastName: z.string().optional()
                })
                .superRefine((data, ctx) => {
                    if (needsName) {
                        if (!data.firstName?.trim()) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: "First name is required",
                                path: ["firstName"]
                            })
                        }
                        if (!data.lastName?.trim()) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: "Last name is required",
                                path: ["lastName"]
                            })
                        }
                    }
                }),
        [needsName]
    )

    type OrganizationCreationFormValues = z.infer<typeof organizationCreationSchema>

    const form = useForm<OrganizationCreationFormValues>({
        resolver: zodResolver(organizationCreationSchema),
        defaultValues: { name: "", firstName: "", lastName: "" }
    })

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

    async function onSubmit(values: OrganizationCreationFormValues) {
        setError(null)
        setIsLoading(true)
        try {
            await BackendProvider.createOrganization(values.name, values.firstName, values.lastName)
            await refreshUser()

            // Upload logo if selected (after org is created and user session is refreshed)
            if (logoFile) {
                try {
                    await BackendProvider.uploadOrgLogo(logoFile)
                } catch {
                    // Logo upload failed but org was created - continue anyway
                    console.error("Failed to upload logo, but organization was created")
                }
            }

            setSuccess(true)
            navigate(FrontendRoutes.APP, { replace: true })
        } catch (err) {
            const message = err instanceof AxiosError && typeof err.response?.data?.error === "string" ? err.response.data.error : "Something went wrong. Please try again."
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }

    if (success) {
        return (
            <Card className="w-[90%] max-w-md md:w-1/2 md:max-w-lg border-border shadow-sm">
                <CardHeader>
                    <img src="/terse.png" alt="Terse" className="h-10 w-10 object-contain mb-2" />
                    <CardTitle className="text-card-foreground">Organization created!</CardTitle>
                    <CardDescription className="text-muted-foreground">Redirecting you to the app…</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card className="w-[90%] max-w-md md:w-1/2 md:max-w-lg border-border shadow-sm">
            <CardHeader className="space-y-4">
                <div className="flex items-center">
                    <img src="/terse.png" alt="Terse" className="h-10 w-10 object-contain shrink-0" />
                    <CardTitle className="text-card-foreground text-xl m-0">Welcome to Terse</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">{needsName ? "To get started, we need a few more details about you." : "To get started, create your organization."}</CardDescription>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4 pb-2">
                        {needsName && (
                            <>
                                <FormField
                                    control={form.control}
                                    name="firstName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                First name <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input type="text" placeholder="e.g. Jane" disabled={isLoading} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="lastName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Last name <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input type="text" placeholder="e.g. Smith" disabled={isLoading} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </>
                        )}
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Organization name <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input type="text" placeholder="e.g. Acme Inc" disabled={isLoading} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormItem>
                            <FormLabel>Organization logo</FormLabel>
                            <FormControl>
                                <div className="flex items-center gap-4">
                                    {logoPreview ? (
                                        <div className="relative">
                                            <img src={logoPreview} alt="Logo preview" className="h-16 w-16 rounded-lg object-cover border" />
                                            <Button type="button" variant="destructive" size="icon" onClick={clearLogo} disabled={isLoading} className="absolute -top-2 -right-2 h-5 w-5 rounded-full">
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="h-16 w-16 rounded-lg border-dashed">
                                            <ImagePlus className="h-6 w-6 text-muted-foreground" />
                                        </Button>
                                    )}
                                    <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                                    <span className="text-xs text-muted-foreground">Optional. Max 5MB.</span>
                                </div>
                            </FormControl>
                        </FormItem>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </CardContent>
                    <CardFooter className="flex justify-end pt-6">
                        <Button type="submit" disabled={isLoading} className="w-1/2 max-w-32">
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create"
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    )
}
