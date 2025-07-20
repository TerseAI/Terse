import { useAuth } from '../services/auth';
import { useEffect } from 'react';
import { PosthogEvents } from '../utility/PosthogEvents';
import posthog from 'posthog-js';

export default function LandingPage() {
    const { loginWithGithub, initSession } = useAuth();

    useEffect(() => {
        posthog.capture(PosthogEvents.LANDING_PAGE_VIEWED);
    }, []);

    useEffect(() => {
        // Listen for GitHub OAuth success message
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'GITHUB_AUTH_SUCCESS') {
                console.log('GitHub auth success:', event.data.token);
                initSession(event.data.token);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [initSession]);

    useEffect(() => {
        // Track scroll to features section
        let hasScrolledToFeatures = false;
        
        const handleScroll = () => {
            const scrollY = window.scrollY;
            const windowHeight = window.innerHeight;
            
            // Trigger when user scrolls past the hero section (roughly 80% of viewport height)
            if (scrollY > windowHeight * 0.8 && !hasScrolledToFeatures) {
                hasScrolledToFeatures = true;
                posthog.capture(PosthogEvents.LANDING_PAGE_SCROLL_TO_FEATURES);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);


    const ctaClicked = () => {
        posthog.capture(PosthogEvents.LANDING_PAGE_CTA_CLICKED);
        loginWithGithub();
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Navigation */}
            <nav className="px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="text-white text-2xl font-bold">Vectra AI</div>
                    <button 
                        onClick={ctaClicked}
                        className="bg-white text-gray-900 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        Sign In
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="px-6 py-20">
                <div className="max-w-7xl mx-auto text-center">
                    {/* Tagline */}
                    <h1 className="text-6xl md:text-7xl font-bold text-white mb-8">
                        An Alternative to Ticket Tracking.
                    </h1>
                    
                    {/* Subtitle */}
                    <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed">
                        Track your team's activity with a beautiful activity dashboard that shows you exactly what's happening in your GitHub repositories.
                    </p>

                    {/* Setup time and integration info */}
                    <div className="mb-12">
                        <p className="text-lg text-blue-300 font-semibold mb-2">
                            ⚡ 2-minute setup • GitHub integration only
                        </p>
                        <p className="text-gray-400 text-sm">
                            Connect your GitHub repositories and instantly see team activity.
                        </p>
                        <p className="text-gray-400 text-sm">
                            AI summarizes commits, PRs, and issues in real-time.
                        </p>
                    </div>

                    {/* CTA Button */}
                    <button 
                        onClick={loginWithGithub}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-4 rounded-xl text-xl font-semibold shadow-2xl inline-flex items-center gap-3 hover:brightness-110 hover:scale-[1.02] transition-[filter,transform] duration-100"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        Login with GitHub
                    </button>

                </div>
            </div>

            {/* How It Works Section */}
            <div className="px-6 py-20 bg-black/20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-6">
                            How Vectra AI Works
                        </h2>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                            We monitor your GitHub activity and use AI to create meaningful summaries of what your team is working on
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-2">Monitor GitHub Activity</h3>
                                    <p className="text-gray-400">We track all commits, pull requests, and issues in your repositories to understand what your team is working on.</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-2">AI-Powered Summaries</h3>
                                    <p className="text-gray-400">Our AI analyzes code changes and creates intelligent summaries that help you understand the impact and context of each update.</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-2">Beautiful Activity Dashboard</h3>
                                    <p className="text-gray-400">Get a real-time view of your team's progress with a clean, intuitive dashboard that shows you exactly what's happening.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700">
                            <h3 className="text-xl font-semibold text-white mb-4">What You'll See</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    <span className="text-gray-300">Daily activity summaries</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    <span className="text-gray-300">Commit analysis and context</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                    <span className="text-gray-300">Pull request insights</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                    <span className="text-gray-300">Issue tracking and updates</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                    <span className="text-gray-300">Team productivity metrics</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step-by-Step Process Section */}
            <div className="px-6 py-20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-6">
                            Get Started in Minutes
                        </h2>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                            Three simple steps to start seeing your team's activity
                        </p>
                    </div>
                    
                    <div className="space-y-16">
                        {/* Step 1: Connect GitHub */}
                        <div className="flex flex-col lg:flex-row items-center gap-12">
                            <div className="lg:w-1/2">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                        1
                                    </div>
                                    <h3 className="text-3xl font-bold text-white">Connect GitHub</h3>
                                </div>
                                <p className="text-xl text-gray-300 mb-6 leading-relaxed">
                                    Sign in with your GitHub account and select the repositories you want to monitor. Vectra AI will start tracking activity immediately.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span className="text-gray-300">Authenticate with GitHub</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span className="text-gray-300">Select repositories to monitor</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span className="text-gray-300">Configure notification preferences</span>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:w-1/2">
                                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                                    <img 
                                        src="/set-up-screenshot.png" 
                                        alt="Vectra AI Setup Process" 
                                        className="w-full h-auto rounded-lg shadow-2xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Team Works */}
                        <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
                            <div className="lg:w-1/2">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                        2
                                    </div>
                                    <h3 className="text-3xl font-bold text-white">Team Works</h3>
                                </div>
                                <p className="text-xl text-gray-300 mb-6 leading-relaxed">
                                    Your team continues working normally in GitHub. Every commit, PR, and issue is automatically detected and analyzed by our AI.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                        <span className="text-gray-300">Team commits code as usual</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                        <span className="text-gray-300">Creates pull requests</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                        <span className="text-gray-300">Opens and updates issues</span>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:w-1/2">
                                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                                    <img 
                                        src="/terminal.png" 
                                        alt="Git Activity" 
                                        className="w-full h-auto rounded-lg shadow-2xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Step 3: See Insights */}
                        <div className="flex flex-col lg:flex-row items-center gap-12">
                            <div className="lg:w-1/2">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                        3
                                    </div>
                                    <h3 className="text-3xl font-bold text-white">See Insights</h3>
                                </div>
                                <p className="text-xl text-gray-300 mb-6 leading-relaxed">
                                    View your beautiful activity dashboard with AI-generated summaries. Understand what your team is building without digging through commits.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-gray-300">Real-time activity feed</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-gray-300">AI-powered summaries</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-gray-300">Team productivity insights</span>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:w-1/2">
                                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                                    <img 
                                        src="/Slack.png" 
                                        alt="Activity Dashboard" 
                                        className="w-full h-auto rounded-lg shadow-2xl"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pain Points Section */}
            <div className="px-6 py-20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-bold text-white mb-4">
                            Stop These Frustrations
                        </h2>
                        <p className="text-xl text-gray-300">
                            Common problems that Vectra AI solves
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-8 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white">No More Manual Updates</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                Stop asking "what are you working on?" and digging through commit logs. Get automatic insights into your team's activity without any manual work.
                            </p>
                        </div>
                        
                        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl p-8 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white">No More Context Switching</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                Get a single dashboard that shows you everything happening across your repositories. No need to check multiple tools or dig through individual commits.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom CTA */}
            <div className="px-6 py-16 text-center">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Ready to see your team's activity?
                    </h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Join teams that have stopped guessing and started knowing what's being built
                    </p>
                    <button 
                        onClick={loginWithGithub}
                        className="bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        Get Started with GitHub
                    </button>
                </div>
            </div>
        </div>
    );
}