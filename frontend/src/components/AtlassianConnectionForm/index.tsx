import { IntegrationType } from "@/shared/Integrations"
import { AtlassianConnectionFormProps } from "./types";
import { useOAuthConnection } from "@/hooks/useOAuthConnection";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Loader2 } from "lucide-react";

interface AtlassianConnectionFormWrapperProps extends AtlassianConnectionFormProps {
    integrationType: IntegrationType;
}

export function AtlassianConnectionForm({ 
    onCancel
}: AtlassianConnectionFormWrapperProps) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.ATLASSIAN>(IntegrationType.ATLASSIAN, {});

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                        Connect your Atlassian account using OAuth. You'll be redirected to Atlassian to authorize access.
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <Button
                            onClick={connect}
                            disabled={isConnecting}
                            className="flex-1"
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                'Connect Atlassian'
                            )}
                        </Button>
                        {onCancel && (
                            <Button
                                type="button"
                                onClick={onCancel}
                                disabled={isConnecting}
                                variant="outline"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

