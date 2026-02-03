import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"

import { zodResolver } from "@hookform/resolvers/zod"
import { AxiosError } from "axios"
import { Loader2 } from "lucide-react"
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

    async function onSubmit(values: OrganizationCreationFormValues) {
        setError(null)
        setIsLoading(true)
        try {
            await BackendProvider.createOrganization(values.name, values.firstName, values.lastName)
            setSuccess(true)
            await refreshUser()
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
