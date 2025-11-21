import * as z from "zod";

export const baseFormSchema = z.object({
    baseUrl: z.string().url("Please enter a valid URL"),
    email: z.string().email("Please enter a valid email address"),
    apiKey: z.string().min(1, "API token is required"),
});

export const jiraFormSchema = baseFormSchema.extend({
    projectKey: z.string().optional(),
});

export type BaseFormValues = z.infer<typeof baseFormSchema>;
export type JiraFormValues = z.infer<typeof jiraFormSchema>;

export interface AtlassianConnectionFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
}

