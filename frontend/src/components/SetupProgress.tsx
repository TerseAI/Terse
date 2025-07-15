import { useIntegrations } from "../context/Integrations";

interface SetupProgressProps {
    className?: string;
}

export function SetupProgress({ className = "" }: SetupProgressProps) {
    const { hasGithub } = useIntegrations();

    const steps = [
        { id: 'github', label: 'GitHub', completed: hasGithub },
        // { id: 'ticketing', label: 'Ticketing', completed: hasLinear || hasJira },
        // { id: 'slack', label: 'Slack', completed: hasSlack }
    ];

    return (
        <div className={`flex items-center justify-center space-x-8 mb-8 ${className}`}>
            {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                    <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            step.completed 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-200 text-gray-500'
                        }`}>
                            {step.completed ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                index + 1
                            )}
                        </div>
                        <span className={`text-sm font-medium ${
                            step.completed ? 'text-green-600' : 'text-gray-500'
                        }`}>
                            {step.label}
                        </span>
                    </div>
                    {index < steps.length - 1 && (
                        <div className={`w-12 h-0.5 ml-8 ${
                            step.completed ? 'bg-green-300' : 'bg-gray-300'
                        }`}></div>
                    )}
                </div>
            ))}
        </div>
    );
} 