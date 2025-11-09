import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BackendProvider } from "../../services/backend";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Form } from "../ui/form";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "../ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { useState } from "react";
import { BaseFields } from "./BaseFields";
import { jiraFormSchema, JiraFormValues, AtlassianConnectionFormProps } from "./types";

export function JiraConnectionForm({ onSuccess, onCancel }: AtlassianConnectionFormProps) {
    const [projects, setProjects] = useState<Array<{ id: string; key: string; name: string }>>([]);
    const [isValidating, setIsValidating] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showProjectSelector, setShowProjectSelector] = useState(false);

    const form = useForm<JiraFormValues>({
        resolver: zodResolver(jiraFormSchema),
        defaultValues: {
            baseUrl: "",
            email: "",
            apiKey: "",
            projectKey: "",
        },
    });

    const handleFieldChange = () => {
        setValidationError(null);
        setShowProjectSelector(false);
    };

    const handleValidate = async (values: JiraFormValues) => {
        setIsValidating(true);
        setValidationError(null);
        setError(null);

        try {
            const result = await BackendProvider.validateJiraCredentials(
                values.baseUrl.trim(),
                values.email.trim(),
                values.apiKey
            );
            if (result.valid && result.projects) {
                setProjects(result.projects);
                setShowProjectSelector(true);
                if (result.projects.length === 1) {
                    // Auto-select if only one project
                    form.setValue("projectKey", result.projects[0].key);
                }
            } else {
                setValidationError(result.error || "Invalid credentials");
            }
        } catch (err: any) {
            setValidationError(err.message || "Failed to validate credentials");
        } finally {
            setIsValidating(false);
        }
    };

    const handleConnect = async (values: JiraFormValues) => {
        setIsConnecting(true);
        setError(null);

        try {
            const result = await BackendProvider.setJiraApiKey(
                values.email.trim(),
                values.baseUrl.trim(),
                values.apiKey,
                values.projectKey || undefined
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

    const handleReset = () => {
        form.reset();
        setProjects([]);
        setShowProjectSelector(false);
        setError(null);
        setValidationError(null);
    };

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(showProjectSelector ? handleConnect : handleValidate)} className="space-y-4">
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

                        {showProjectSelector && projects.length > 0 && (
                            <FormField
                                control={form.control}
                                name="projectKey"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Project (Optional)</FormLabel>
                                        <Select
                                            onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                                            value={field.value || undefined}
                                            disabled={isConnecting}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="No project selected" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="__none__">No project selected</SelectItem>
                                                {projects.map((project) => (
                                                    <SelectItem key={project.id} value={project.key}>
                                                        {project.name} ({project.key})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Optionally select a default project for this connection
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {showProjectSelector && projects.length > 0 && (
                            <div className="flex items-start gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
                                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-green-600 dark:text-green-400">
                                    <p className="font-medium">Validated successfully</p>
                                    <p className="text-xs mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''} available</p>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-destructive">{error}</p>
                            </div>
                        )}

                        <div className="flex items-center gap-2 pt-2">
                            {!showProjectSelector ? (
                                <>
                                    <Button
                                        type="submit"
                                        disabled={isValidating || isConnecting}
                                        className="flex-1"
                                    >
                                        {isValidating ? "Validating..." : "Validate & Load Projects"}
                                    </Button>
                                    {onCancel && (
                                        <Button
                                            type="button"
                                            onClick={onCancel}
                                            disabled={isValidating || isConnecting}
                                            variant="outline"
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Button
                                        type="submit"
                                        disabled={isConnecting}
                                        className="flex-1"
                                    >
                                        {isConnecting ? "Connecting..." : "Connect"}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleReset}
                                        disabled={isConnecting}
                                        variant="outline"
                                    >
                                        Start Over
                                    </Button>
                                </>
                            )}
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

