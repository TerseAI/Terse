import { useState } from "react";
import { BackendProvider } from "../services/backend";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Card, CardContent } from "./ui/card";

interface JiraConnectionFormProps {
    onSuccess: () => void;
    onCancel?: () => void;
}

export function JiraConnectionForm({ onSuccess, onCancel }: JiraConnectionFormProps) {
    const [baseUrl, setBaseUrl] = useState("");
    const [email, setEmail] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [selectedProjectKey, setSelectedProjectKey] = useState<string>("");
    const [projects, setProjects] = useState<Array<{ id: string; key: string; name: string }>>([]);
    const [isValidating, setIsValidating] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showProjectSelector, setShowProjectSelector] = useState(false);

    const handleValidate = async () => {
        if (!baseUrl.trim() || !email.trim() || !apiKey.trim()) {
            setValidationError("All fields are required");
            return;
        }

        // Basic URL validation
        try {
            new URL(baseUrl);
        } catch {
            setValidationError("Please enter a valid URL");
            return;
        }

        setIsValidating(true);
        setValidationError(null);
        setError(null);

        try {
            const result = await BackendProvider.validateJiraCredentials(baseUrl.trim(), email.trim(), apiKey);
            if (result.valid && result.projects) {
                setProjects(result.projects);
                setShowProjectSelector(true);
                if (result.projects.length === 1) {
                    // Auto-select if only one project
                    setSelectedProjectKey(result.projects[0].key);
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

    const handleConnect = async () => {
        if (!baseUrl.trim() || !email.trim() || !apiKey.trim()) {
            setError("All required fields must be filled");
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const result = await BackendProvider.setJiraApiKey(
                email.trim(),
                baseUrl.trim(),
                apiKey,
                selectedProjectKey || undefined
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
        setBaseUrl("");
        setEmail("");
        setApiKey("");
        setSelectedProjectKey("");
        setProjects([]);
        setShowProjectSelector(false);
        setError(null);
        setValidationError(null);
    };

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="base-url">
                            Base URL <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="base-url"
                            type="url"
                            value={baseUrl}
                            onChange={(e) => {
                                setBaseUrl(e.target.value);
                                setValidationError(null);
                                setShowProjectSelector(false);
                            }}
                            placeholder="https://your-company.atlassian.net"
                            disabled={isValidating || isConnecting}
                        />
                        <p className="text-xs text-muted-foreground">
                            Your Jira instance URL
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">
                            Email <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setValidationError(null);
                                setShowProjectSelector(false);
                            }}
                            placeholder="your-email@example.com"
                            disabled={isValidating || isConnecting}
                        />
                        <p className="text-xs text-muted-foreground">
                            The email address associated with your Jira account
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="api-token">
                            API Token <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="api-token"
                            type="password"
                            value={apiKey}
                            onChange={(e) => {
                                setApiKey(e.target.value);
                                setValidationError(null);
                                setShowProjectSelector(false);
                            }}
                            placeholder="Your Jira API token"
                            disabled={isValidating || isConnecting}
                        />
                        <p className="text-xs text-muted-foreground">
                            Generate an API token from your Atlassian account settings
                        </p>
                    </div>

                    {validationError && (
                        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-destructive">{validationError}</p>
                        </div>
                    )}

                    {showProjectSelector && projects.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="project-select">Project (Optional)</Label>
                            <Select
                                value={selectedProjectKey || undefined}
                                onValueChange={(value) => setSelectedProjectKey(value === "__none__" ? "" : value || "")}
                                disabled={isConnecting}
                            >
                                <SelectTrigger id="project-select" className="w-full">
                                    <SelectValue placeholder="No project selected" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">No project selected</SelectItem>
                                    {projects.map((project) => (
                                        <SelectItem key={project.id} value={project.key}>
                                            {project.name} ({project.key})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Optionally select a default project for this connection
                            </p>
                        </div>
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
                </div>

                <div className="flex items-center gap-2 pt-2">
                    {!showProjectSelector ? (
                        <>
                            <Button
                                onClick={handleValidate}
                                disabled={isValidating || isConnecting || !baseUrl.trim() || !email.trim() || !apiKey.trim()}
                                className="flex-1"
                            >
                                {isValidating ? "Validating..." : "Validate & Load Projects"}
                            </Button>
                            {onCancel && (
                                <Button
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
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="flex-1"
                            >
                                {isConnecting ? "Connecting..." : "Connect"}
                            </Button>
                            <Button
                                onClick={handleReset}
                                disabled={isConnecting}
                                variant="outline"
                            >
                                Start Over
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

