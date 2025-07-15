import { useAuth } from '../services/auth';
import { useEffect } from 'react';
import { PosthogEvents } from '../utility/PosthogEvents';
import posthog from 'posthog-js';

export default function LandingPageChangelog() {
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
                        See What Your Team Is Actually Building.
                    </h1>
                    
                    {/* Subtitle */}
                    <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed">
                        Get instant visibility into all your projects without micromanaging. Know what's happening across your entire team in one dashboard.
                    </p>

                    {/* Setup time and integration info */}
                    <div className="mb-12">
                        <p className="text-lg text-blue-300 font-semibold mb-2">
                            ⚡ 2-minute setup • Works with your existing tools
                        </p>
                        <p className="text-gray-400 text-sm">
                            No new processes. No PM overhead. Just real-time visibility.
                        </p>
                        <p className="text-gray-400 text-sm">
                            Perfect for teams under 30 people juggling multiple projects.
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
                        Start Seeing Progress
                    </button>
                </div>
            </div>

            {/* Pain Points Section */}
            <div className="px-6 py-20 bg-black/20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-6">
                            The Startup Leadership Problem
                        </h2>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                            You're running multiple projects with a small team. Here's what's probably keeping you up at night:
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 rounded-2xl p-8 border border-red-700/30">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white">No Clear Picture</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                You have 3-5 projects running simultaneously, but no easy way to see what's actually happening across all of them. You're flying blind.
                            </p>
                        </div>
                        
                        <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 rounded-2xl p-8 border border-red-700/30">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white">Constant Status Pings</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                You're constantly asking "What are you working on?" and "How's that project going?" It's exhausting for everyone involved.
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 rounded-2xl p-8 border border-red-700/30">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white">Misaligned Priorities</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                Without visibility, you can't tell if your team is working on the right things. Projects drift, deadlines slip, and you don't know until it's too late.
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 rounded-2xl p-8 border border-red-700/30">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white">No PM Resources</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                You can't afford a dedicated PM, but you need project visibility. Traditional tools require too much overhead and maintenance.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Solution Section */}
            <div className="px-6 py-20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-6">
                            The Vectra AI Solution
                        </h2>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                            Automatic project visibility without the overhead. See what your team is building in real-time.
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-2">One Dashboard, All Projects</h3>
                                    <p className="text-gray-400">See progress across all your projects in one place. No more switching between tools or asking for updates.</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-2">Real-Time Updates</h3>
                                    <p className="text-gray-400">Every code commit automatically updates your project status. No manual tracking, no forgotten updates.</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-2">Zero Maintenance</h3>
                                    <p className="text-gray-400">Works with your existing GitHub workflow. No new processes, no PM overhead, no team training required.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700">
                            <h3 className="text-xl font-semibold text-white mb-4">What You'll See</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    <span className="text-gray-300">Project A: 3 features in progress, 2 completed this week</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    <span className="text-gray-300">Project B: Sarah working on authentication, 70% done</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                    <span className="text-gray-300">Project C: Mike blocked on API integration</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                    <span className="text-gray-300">Team velocity: 12 commits this week across all projects</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                    <span className="text-gray-300">Alerts: Project A falling behind schedule</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* How It Works Section */}
            <div className="px-6 py-20 bg-black/20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-6">
                            How It Works
                        </h2>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                            Three simple steps to get complete project visibility
                        </p>
                    </div>
                    
                    <div className="space-y-16">
                        {/* Step 1: Connect */}
                        <div className="flex flex-col lg:flex-row items-center gap-12">
                            <div className="lg:w-1/2">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                        1
                                    </div>
                                    <h3 className="text-3xl font-bold text-white">Connect Your Repos</h3>
                                </div>
                                <p className="text-xl text-gray-300 mb-6 leading-relaxed">
                                    Connect your GitHub repositories. Vectra AI starts monitoring commits immediately across all your projects.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span className="text-gray-300">Link all your project repositories</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span className="text-gray-300">Set up project names and teams</span>
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

                        {/* Step 2: Work Normally */}
                        <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
                            <div className="lg:w-1/2">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                        2
                                    </div>
                                    <h3 className="text-3xl font-bold text-white">Your Team Works Normally</h3>
                                </div>
                                <p className="text-xl text-gray-300 mb-6 leading-relaxed">
                                    Your developers keep working exactly as they do now. No new processes, no extra work, no changes to their workflow.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                        <span className="text-gray-300">Code, commit, and push as usual</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                        <span className="text-gray-300">No additional tracking required</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                        <span className="text-gray-300">Vectra AI does all the monitoring</span>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:w-1/2">
                                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                                    <img 
                                        src="/terminal.png" 
                                        alt="Normal Development Workflow" 
                                        className="w-full h-auto rounded-lg shadow-2xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Step 3: Get Visibility */}
                        <div className="flex flex-col lg:flex-row items-center gap-12">
                            <div className="lg:w-1/2">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                        3
                                    </div>
                                    <h3 className="text-3xl font-bold text-white">Get Instant Visibility</h3>
                                </div>
                                <p className="text-xl text-gray-300 mb-6 leading-relaxed">
                                    Check your dashboard anytime to see what's happening across all projects. Get alerts when things need attention.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-gray-300">Real-time project status updates</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-gray-300">Team activity and progress tracking</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-gray-300">Automatic alerts for blockers</span>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:w-1/2">
                                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                                    <img 
                                        src="/Slack.png" 
                                        alt="Project Visibility Dashboard" 
                                        className="w-full h-auto rounded-lg shadow-2xl"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Benefits Section */}
            <div className="px-6 py-20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-6">
                            What This Means for You
                        </h2>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                            The benefits of having complete project visibility without the overhead
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-2xl p-8 border border-green-700/30">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white">Stop Micromanaging</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                No more constant check-ins or status meetings. You can see what's happening without interrupting your team's flow.
                            </p>
                        </div>
                        
                        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-2xl p-8 border border-green-700/30">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white">Catch Problems Early</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                Spot blockers and delays before they become crises. Proactively address issues before they impact your timeline.
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-2xl p-8 border border-green-700/30">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white">Better Resource Allocation</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                See which projects need more attention and which are running smoothly. Make informed decisions about where to focus.
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-2xl p-8 border border-green-700/30">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-white">No PM Salary</h3>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                Get project management visibility without hiring a PM. Perfect for startups that need oversight but can't afford the overhead.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom CTA */}
            <div className="px-6 py-16 text-center">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Ready to see what your team is actually building?
                    </h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Join startup leaders who have stopped guessing and started knowing
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
