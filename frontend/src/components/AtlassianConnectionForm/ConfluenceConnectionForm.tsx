import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BackendProvider } from "../../services/backend";
import { AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Form } from "../ui/form";
import { useState } from "react";
import { BaseFields } from "./BaseFields";
import { baseFormSchema, BaseFormValues, AtlassianConnectionFormProps } from "./types";

export function ConfluenceConnectionForm({ onSuccess, onCancel }: AtlassianConnectionFormProps) {
    const [isValidating, setIsValidating] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<BaseFormValues>({
        resolver: zodResolver(baseFormSchema),
        defaultValues: {
            baseUrl: "",
            email: "",
            apiKey: "",
        },
    });

    const handleFieldChange = () => {
        setValidationError(null);
    };

    // const handleValidate = async (values: BaseFormValues) => {
    //     setIsValidating(true);
    //     setValidationError(null);
    //     setError(null);

    //     try {
    //         // For Confluence, we can use the same validation as Jira since they share credentials
    //         const result = await BackendProvider.validateJiraCredentials(
    //             values.baseUrl.trim(),
    //             values.email.trim(),
    //             values.apiKey
    //         );
    //         if (result.valid) {
    //             // Validation successful, ready to connect
    //         } else {
    //             setValidationError(result.error || "Invalid credentials");
    //         }
    //     } catch (err: any) {
    //         setValidationError(err.message || "Failed to validate credentials");
    //     } finally {
    //         setIsValidating(false);
    //     }
    // };

    const handleConnect = async (values: BaseFormValues) => {
        setIsConnecting(true);
        setError(null);

        try {
            const result = await BackendProvider.setConfluenceApiKey(
                values.email.trim(),
                values.baseUrl.trim(),
                values.apiKey
            );
            if (result.success) {
                onSuccess();
            } else {
                setError(result.error || "Failed to create connection");
            }
        } catch (err: any) {
            setError(err.error || err.message || "Failed to create connection");
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleConnect)} className="space-y-4">
                        <BaseFields
                            form={form}
                            isValidating={isValidating}
                            isConnecting={isConnecting}
                            onFieldChange={handleFieldChange}
                        />

                        {validationError && (
                            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-destructive">{validationError}</p>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-destructive">{error}</p>
                            </div>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                            <Button
                                type="submit"
                                disabled={isConnecting || isValidating}
                                className="flex-1"
                            >
                                {isConnecting ? "Connecting..." : isValidating ? "Validating..." : "Connect"}
                            </Button>
                            {onCancel && (
                                <Button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={isConnecting || isValidating}
                                    variant="outline"
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

