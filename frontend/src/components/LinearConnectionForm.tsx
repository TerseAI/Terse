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

interface LinearConnectionFormProps {
    onSuccess: () => void;
    onCancel?: () => void;
}

export function LinearConnectionForm({ onSuccess, onCancel }: LinearConnectionFormProps) {
    const [apiKey, setApiKey] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState<string>("");
    const [teams, setTeams] = useState<Array<{ id: string; name: string; key: string }>>([]);
    const [workspace, setWorkspace] = useState<{ name: string; id: string } | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showTeamSelector, setShowTeamSelector] = useState(false);

    const handleValidate = async () => {
        if (!apiKey.trim()) {
            setValidationError("API key is required");
            return;
        }

        setIsValidating(true);
        setValidationError(null);
        setError(null);

        try {
            const result = await BackendProvider.validateLinearApiKey(apiKey);
            if (result.valid && result.teams && result.workspace) {
                setTeams(result.teams);
                setWorkspace(result.workspace);
                setShowTeamSelector(true);
                if (result.teams.length === 1) {
                    // Auto-select if only one team
                    setSelectedTeamId(result.teams[0].id);
                }
            } else {
                setValidationError(result.error || "Invalid API key");
            }
        } catch (err: any) {
            setValidationError(err.message || "Failed to validate API key");
        } finally {
            setIsValidating(false);
        }
    };

    const handleConnect = async () => {
        if (!apiKey.trim()) {
            setError("API key is required");
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const result = await BackendProvider.setLinearApiKey(apiKey, selectedTeamId || undefined);
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
        setApiKey("");
        setSelectedTeamId("");
        setTeams([]);
        setWorkspace(null);
        setShowTeamSelector(false);
        setError(null);
        setValidationError(null);
    };

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="api-key">
                            API Key <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="api-key"
                            type="password"
                            value={apiKey}
                            onChange={(e) => {
                                setApiKey(e.target.value);
                                setValidationError(null);
                                setShowTeamSelector(false);
                            }}
                            placeholder="lin_api_..."
                            disabled={isValidating || isConnecting}
                        />
                        <p className="text-xs text-muted-foreground">
                            Generate an API key from your Linear settings
                        </p>
                    </div>

                    {validationError && (
                        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-destructive">{validationError}</p>
                        </div>
                    )}

                    {workspace && (
                        <div className="flex items-start gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-green-600 dark:text-green-400">
                                <p className="font-medium">Validated successfully</p>
                                <p className="text-xs mt-0.5">Workspace: {workspace.name}</p>
                            </div>
                        </div>
                    )}

                    {showTeamSelector && teams.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="team-select">Team (Optional)</Label>
                            <Select
                                value={selectedTeamId || undefined}
                                onValueChange={(value) => setSelectedTeamId(value === "__none__" ? "" : value || "")}
                                disabled={isConnecting}
                            >
                                <SelectTrigger id="team-select" className="w-full">
                                    <SelectValue placeholder="No team selected" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">No team selected</SelectItem>
                                    {teams.map((team) => (
                                        <SelectItem key={team.id} value={team.id}>
                                            {team.name} ({team.key})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Optionally select a default team for this connection
                            </p>
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
                    {!showTeamSelector ? (
                        <>
                            <Button
                                onClick={handleValidate}
                                disabled={isValidating || isConnecting || !apiKey.trim()}
                                className="flex-1"
                            >
                                {isValidating ? "Validating..." : "Validate & Load Teams"}
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

