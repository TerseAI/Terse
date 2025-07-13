interface SetupBenefitsProps {
    className?: string;
}

export function SetupBenefits({ className = "" }: SetupBenefitsProps) {
    const benefits = [
        {
            title: "Track Progress",
            description: "Automatically track ticket progress from your Git commits",
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
            bgGradient: "from-blue-50 to-indigo-50",
            borderColor: "border-blue-100",
            iconBg: "bg-blue-600"
        },
        {
            title: "Smart Summaries",
            description: "Get intelligent summaries of your work in Slack",
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            ),
            bgGradient: "from-green-50 to-emerald-50",
            borderColor: "border-green-100",
            iconBg: "bg-green-600"
        },
        {
            title: "Automate Workflow",
            description: "Reduce manual updates and focus on building",
            icon: (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            ),
            bgGradient: "from-purple-50 to-violet-50",
            borderColor: "border-purple-100",
            iconBg: "bg-purple-600"
        }
    ];

    return (
        <div className={`mt-12 grid md:grid-cols-3 gap-6 ${className}`}>
            {benefits.map((benefit, index) => (
                <div key={index} className={`text-center p-6 bg-gradient-to-br ${benefit.bgGradient} rounded-xl border ${benefit.borderColor}`}>
                    <div className={`w-12 h-12 ${benefit.iconBg} rounded-lg flex items-center justify-center mx-auto mb-4`}>
                        {benefit.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                    <p className="text-sm text-gray-600">{benefit.description}</p>
                </div>
            ))}
        </div>
    );
} 