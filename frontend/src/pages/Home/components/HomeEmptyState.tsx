import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MessageSquare, GitBranch, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIntegrations } from "@/hooks/api/useIntegrations";
import { FrontendRoutes } from "@/shared/FrontendRoutes";
import { BackendProvider } from "@/services/backend";
import { IntegrationType } from "@/shared/Integrations";

export function HomeEmptyState() {
    const navigate = useNavigate();
    const { integrations: activeIntegrations } = useIntegrations();
    const [isConnectingSlack, setIsConnectingSlack] = useState(false);

    const hasSlackIntegration = activeIntegrations?.some(
        (integration) => integration.toLowerCase() === IntegrationType.SLACK
    );
    const hasOtherIntegrations = activeIntegrations && activeIntegrations.length > (hasSlackIntegration ? 1 : 0);

    // Determine current step (1-indexed for display)
    const currentStep = !hasSlackIntegration ? 1 : !hasOtherIntegrations ? 2 : 3;

    const connectSlack = async () => {
        setIsConnectingSlack(true);
        try {
            const installationDetails = await BackendProvider.getIntegrationInstallationDetails(
                IntegrationType.SLACK,
                { isBotUser: true }
            );

            if (installationDetails?.oauthUrl) {
                window.open(installationDetails.oauthUrl, 'oauth-popup', 'width=600,height=700');
            } else {
                console.error('OAuth URL not available');
            }
        } catch (error) {
            console.error('Error initiating Slack OAuth:', error);
        } finally {
            setIsConnectingSlack(false);
        }
    };

    const steps = [
        {
            number: 1,
            title: "Connect Slack",
            description: "Chat with your agents and receive notifications directly in Slack. Manage everything through natural conversation.",
            icon: <MessageSquare className="h-5 w-5" />,
            completed: hasSlackIntegration,
            action: connectSlack,
            buttonText: isConnectingSlack ? "Connecting..." : "Connect Slack",
            disabled: isConnectingSlack,
        },
        {
            number: 2,
            title: "Add an integration",
            description: "Connect GitHub, Linear, or other tools. These integrations trigger your agents and let them take action.",
            icon: <GitBranch className="h-5 w-5" />,
            completed: hasOtherIntegrations,
            action: () => navigate(FrontendRoutes.INTEGRATIONS),
            buttonText: "Add Integration",
        },
        {
            number: 3,
            title: "Create your first agent",
            description: "Build an AI agent that listens for events and automates your workflows. Start from scratch or use a template.",
            icon: <Zap className="h-5 w-5" />,
            completed: false,
            action: () => navigate(FrontendRoutes.AGENTS.SETUP),
            buttonText: "Create Agent",
        },
    ];

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-2xl font-semibold tracking-tight mb-2">
                        Welcome to Terse
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Let's get your workspace set up in a few steps
                    </p>
                </div>

                {/* Steps */}
                <div className="space-y-3">
                    {steps.map((step, index) => {
                        const isActive = step.number === currentStep;
                        const isPast = step.number < currentStep;
                        const isFuture = step.number > currentStep;

                        return (
                            <div
                                key={step.number}
                                className={`
                                    relative border rounded-xl p-5 transition-all
                                    ${isActive ? 'border-foreground/20 bg-muted/30' : 'border-border'}
                                    ${isFuture ? 'opacity-50' : ''}
                                `}
                            >
                                <div className="flex gap-4">
                                    {/* Step indicator */}
                                    <div className={`
                                        flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium
                                        ${step.completed ? 'bg-foreground text-background' : isActive ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}
                                    `}>
                                        {step.completed ? <Check className="h-4 w-4" /> : step.number}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-medium">{step.title}</h3>
                                            {step.completed && (
                                                <span className="text-xs text-muted-foreground">Complete</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            {step.description}
                                        </p>

                                        {isActive && (
                                            <Button
                                                onClick={step.action}
                                                size="sm"
                                                disabled={step.disabled}
                                            >
                                                {step.buttonText}
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </Button>
                                        )}

                                        {step.completed && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigate(FrontendRoutes.INTEGRATIONS)}
                                                className="text-muted-foreground"
                                            >
                                                Manage
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Connector line */}
                                {index < steps.length - 1 && (
                                    <div className={`
                                        absolute left-[2.05rem] top-[4.25rem] w-0.5 h-[calc(100%-2.5rem)]
                                        ${isPast ? 'bg-foreground' : 'bg-border'}
                                    `} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Skip link */}
                <div className="text-center mt-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}
                        className="text-muted-foreground text-xs"
                    >
                        Skip setup and create an agent
                    </Button>
                </div>
            </div>
        </div>
    );
}
