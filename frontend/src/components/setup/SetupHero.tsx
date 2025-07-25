interface SetupHeroProps {
    className?: string;
}

export function SetupHero({ className = "" }: SetupHeroProps) {
    return (
        <div className={`text-center mb-12 ${className}`}>
            <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3">Let's get you set up!</h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                    Connect your tools to start automating your workflow. We'll help you track progress and manage tickets automatically.
                </p>
            </div>
        </div>
    );
} 