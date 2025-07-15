import { SetupHero } from "./SetupHero";
import { SetupProgress } from "./SetupProgress";
import { SetupIntegrations } from "./SetupIntegrations";
import { SetupBenefits } from "./SetupBenefits";
import { useIntegrations } from "../context/Integrations";

interface SetupScreenProps {
    onIntegrationChange: () => Promise<void>;
    className?: string;
}

export function SetupScreen({ onIntegrationChange, className = "" }: SetupScreenProps) {
    const { isSetupComplete } = useIntegrations();

    // If setup is complete, show a success message
    if (isSetupComplete) {
        return (
            <div className={`max-w-4xl mx-auto text-center ${className}`}>
                <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">Setup Complete! 🎉</h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                        All your integrations are connected and ready to go. You can now start using Vectra AI to automate your workflow.
                    </p>
                </div>
                
                <SetupProgress />
                
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
                    <h2 className="text-lg font-semibold text-green-800 mb-2">What's Next?</h2>
                    <p className="text-green-700">
                        Start making commits to your GitHub repository and watch as Vectra AI automatically tracks your progress and updates your tickets.
                    </p>
                </div>
                
                <SetupBenefits />
            </div>
        );
    }

    // Show setup progress
    return (
        <div className={`max-w-4xl mx-auto ${className}`}>
            <SetupHero />
            <SetupProgress />
            <SetupIntegrations onIntegrationChange={onIntegrationChange} />
            <SetupBenefits />
        </div>
    );
} 

// idk rabdom trigger