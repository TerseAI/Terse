import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { UseFormReturn } from "react-hook-form";
import { BaseFormValues } from "./types";

interface BaseFieldsProps {
    form: UseFormReturn<BaseFormValues>;
    isValidating: boolean;
    isConnecting: boolean;
    onFieldChange: () => void;
}

export function BaseFields({ form, isValidating, isConnecting, onFieldChange }: BaseFieldsProps) {
    return (
        <>
            <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Base URL <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                            <Input
                                type="url"
                                placeholder="https://your-company.atlassian.net"
                                disabled={isValidating || isConnecting}
                                {...field}
                                onChange={(e) => {
                                    field.onChange(e);
                                    onFieldChange();
                                }}
                            />
                        </FormControl>
                        <FormDescription>
                            Your Atlassian instance URL (works for both Jira and Confluence)
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Email <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                            <Input
                                type="email"
                                placeholder="your-email@example.com"
                                disabled={isValidating || isConnecting}
                                {...field}
                                onChange={(e) => {
                                    field.onChange(e);
                                    onFieldChange();
                                }}
                            />
                        </FormControl>
                        <FormDescription>
                            The email address associated with your Atlassian account
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            API Token <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                            <Input
                                type="password"
                                placeholder="Your Atlassian API token"
                                disabled={isValidating || isConnecting}
                                {...field}
                                onChange={(e) => {
                                    field.onChange(e);
                                    onFieldChange();
                                }}
                            />
                        </FormControl>
                        <FormDescription>
                            Generate an API token from your Atlassian account settings
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}

