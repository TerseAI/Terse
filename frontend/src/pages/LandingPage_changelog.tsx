import { useAuth } from '../services/auth';
import { useEffect, useState } from 'react';
import { PosthogEvents } from '../utility/PosthogEvents';
import posthog from 'posthog-js';

export default function LandingPageChangelog() {
    const { loginWithGithub, initSession } = useAuth();
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        posthog.capture(PosthogEvents.LANDING_PAGE_VIEWED);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        const handleScroll = () => {
            setScrollY(window.scrollY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
        };
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

    const ctaClicked = () => {
        posthog.capture(PosthogEvents.LANDING_PAGE_CTA_CLICKED);
        loginWithGithub();
    }

    return (
        <div className="min-h-screen bg-black overflow-hidden relative">
            {/* Animated Background */}
            <div className="fixed inset-0 z-0">
                <div 
                    className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/30 to-pink-900/20"
                    style={{
                        background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.3) 0%, transparent 50%)`
                    }}
                />
                <div className="absolute inset-0">
                    {[...Array(50)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-1 h-1 bg-white/10 rounded-full animate-pulse"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 3}s`,
                                animationDuration: `${2 + Math.random() * 3}s`
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Floating Orbs */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div 
                    className="absolute w-96 h-96 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"
                    style={{
                        left: `${20 + Math.sin(scrollY * 0.001) * 10}%`,
                        top: `${30 + Math.cos(scrollY * 0.001) * 10}%`,
                        transform: `translate(-50%, -50%) scale(${1 + Math.sin(scrollY * 0.002) * 0.2})`
                    }}
                />
                <div 
                    className="absolute w-80 h-80 bg-gradient-to-r from-pink-500/10 to-orange-500/10 rounded-full blur-3xl"
                    style={{
                        right: `${25 + Math.cos(scrollY * 0.001) * 15}%`,
                        top: `${60 + Math.sin(scrollY * 0.001) * 15}%`,
                        transform: `translate(50%, -50%) scale(${1 + Math.cos(scrollY * 0.002) * 0.3})`
                    }}
                />
            </div>

            {/* Navigation */}
            <nav className="relative z-10 px-8 py-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="text-white text-3xl font-light tracking-wider">
                        <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                            Vectra
                        </span>
                        <span className="text-gray-400 ml-2">AI</span>
                    </div>
                    <button 
                        onClick={ctaClicked}
                        className="group relative px-8 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white font-light tracking-wide hover:bg-white/20 transition-all duration-500 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        <span className="relative z-10">Begin</span>
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative z-10 px-8 py-32">
                <div className="max-w-7xl mx-auto text-center">
                    {/* Main Headline */}
                    <h1 className="text-8xl md:text-9xl font-extralight text-white mb-12 tracking-tight leading-none">
                        <span className="block bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
                            See
                        </span>
                        <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Everything
                        </span>
                    </h1>
                    
                    {/* Subtitle */}
                    <p className="text-2xl md:text-3xl text-gray-300 mb-16 max-w-4xl mx-auto leading-relaxed font-light">
                        AI that tracks Github, Slack, Linear to give you a real-time view of what your team is building.
                    </p>

                    {/* Floating Elements */}
                    <div className="relative mb-20">
                        <div className="flex justify-center items-center space-x-8 mb-8">
                            {['GitHub', 'Slack', 'Linear'].map((tool, i) => (
                                <div
                                    key={tool}
                                    className="group relative"
                                    style={{
                                        animationDelay: `${i * 0.2}s`
                                    }}
                                >
                                    <div className="w-24 h-24 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center text-white/60 font-light tracking-wide group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-500 hover:scale-110" style={{ animation: `float 6s ease-in-out infinite` }}>
                                        {tool}
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button 
                        onClick={loginWithGithub}
                        className="group relative px-16 py-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-xl border border-white/20 rounded-full text-white text-xl font-light tracking-wide hover:scale-105 transition-all duration-500 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/30 to-purple-600/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        <span className="relative z-10 flex items-center gap-3">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                            Begin Journey
                        </span>
                    </button>
                </div>
            </div>

            {/* How It Works Section */}
            <div className="relative z-10 px-8 py-32">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24">
                        <h2 className="text-6xl font-extralight text-white mb-8 tracking-tight">
                            <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                How It
                            </span>
                            <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                Works
                            </span>
                        </h2>
                        <p className="text-2xl text-gray-300 max-w-3xl mx-auto font-light">
                            Three simple steps to get complete project visibility
                        </p>
                    </div>
                    
                    <div className="space-y-32">
                        {/* Step 1: Connect */}
                        <div className="flex flex-col lg:flex-row items-center gap-20">
                            <div className="lg:w-1/2">
                                <div className="flex items-center gap-6 mb-8">
                                    <div className="relative">
                                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white font-light text-2xl">
                                            1
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-full blur-xl animate-pulse" />
                                    </div>
                                    <h3 className="text-5xl font-extralight text-white tracking-tight">Connect</h3>
                                </div>
                                <p className="text-2xl text-gray-300 mb-8 leading-relaxed font-light">
                                    Connect your GitHub repositories. Vectra AI starts monitoring commits immediately across all your projects.
                                </p>
                                <div className="space-y-4">
                                    {['Link all your project repositories', 'Set up project names and teams', 'Configure notification preferences'].map((item, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                                            <span className="text-gray-300 font-light text-lg">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:w-1/2">
                                <div className="relative">
                                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                                        <img 
                                            src="/set-up-screenshot.png" 
                                            alt="Vectra AI Setup Process" 
                                            className="w-full h-auto rounded-2xl"
                                        />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur-2xl" />
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Work Normally */}
                        <div className="flex flex-col lg:flex-row-reverse items-center gap-20">
                            <div className="lg:w-1/2">
                                <div className="flex items-center gap-6 mb-8">
                                    <div className="relative">
                                        <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white font-light text-2xl">
                                            2
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full blur-xl animate-pulse" />
                                    </div>
                                    <h3 className="text-5xl font-extralight text-white tracking-tight">Flow</h3>
                                </div>
                                <p className="text-2xl text-gray-300 mb-8 leading-relaxed font-light">
                                    Your developers keep working exactly as they do now. No new processes, no extra work, no changes to their workflow.
                                </p>
                                <div className="space-y-4">
                                    {['Code, commit, and push as usual', 'No additional tracking required', 'Vectra AI does all the monitoring'].map((item, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                                            <span className="text-gray-300 font-light text-lg">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:w-1/2">
                                <div className="relative">
                                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                                        <img 
                                            src="/terminal.png" 
                                            alt="Normal Development Workflow" 
                                            className="w-full h-auto rounded-2xl"
                                        />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-3xl blur-2xl" />
                                </div>
                            </div>
                        </div>

                        {/* Step 3: Get Visibility */}
                        <div className="flex flex-col lg:flex-row items-center gap-20">
                            <div className="lg:w-1/2">
                                <div className="flex items-center gap-6 mb-8">
                                    <div className="relative">
                                        <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-blue-500/20 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white font-light text-2xl">
                                            3
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/30 to-blue-500/30 rounded-full blur-xl animate-pulse" />
                                    </div>
                                    <h3 className="text-5xl font-extralight text-white tracking-tight">See</h3>
                                </div>
                                <p className="text-2xl text-gray-300 mb-8 leading-relaxed font-light">
                                    Check your dashboard anytime to see what's happening across all projects. Get alerts when things need attention.
                                </p>
                                <div className="space-y-4">
                                    {['Real-time project status updates', 'Team activity and progress tracking', 'Automatic alerts for blockers'].map((item, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                                            <span className="text-gray-300 font-light text-lg">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:w-1/2">
                                <div className="relative">
                                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                                        <img 
                                            src="/Slack.png" 
                                            alt="Project Visibility Dashboard" 
                                            className="w-full h-auto rounded-2xl"
                                        />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-3xl blur-2xl" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Solution Section */}
            <div className="relative z-10 px-8 py-32">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24">
                        <h2 className="text-6xl font-extralight text-white mb-8 tracking-tight">
                            <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                The
                            </span>
                            <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                Solution
                            </span>
                        </h2>
                        <p className="text-2xl text-gray-300 max-w-3xl mx-auto font-light">
                            Automatic project visibility without the overhead. See what your team is building in real-time.
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-20 items-center">
                        <div className="space-y-12">
                            {[
                                {
                                    icon: '📊',
                                    title: 'One Dashboard, All Projects',
                                    description: 'See progress across all your projects in one place. No more switching between tools or asking for updates.'
                                },
                                {
                                    icon: '⚡',
                                    title: 'Real-Time Updates',
                                    description: 'Every code commit automatically updates your project status. No manual tracking, no forgotten updates.'
                                },
                                {
                                    icon: '✨',
                                    title: 'Zero Maintenance',
                                    description: 'Works with your existing GitHub workflow. No new processes, no PM overhead, no team training required.'
                                }
                            ].map((feature, i) => (
                                <div key={i} className="group">
                                    <div className="flex items-start gap-6">
                                        <div className="text-4xl group-hover:scale-110 transition-transform duration-500">
                                            {feature.icon}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-light text-white mb-3 tracking-wide">{feature.title}</h3>
                                            <p className="text-gray-300 text-lg leading-relaxed font-light">{feature.description}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="relative">
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
                                <h3 className="text-2xl font-light text-white mb-6 tracking-wide">What You'll See</h3>
                                <div className="space-y-4">
                                    {[
                                        'Project A: 3 features in progress, 2 completed this week',
                                        'Project B: Sarah working on authentication, 70% done',
                                        'Project C: Mike blocked on API integration',
                                        'Team velocity: 12 commits this week across all projects',
                                        'Alerts: Project A falling behind schedule'
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 group">
                                            <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full group-hover:scale-150 transition-transform duration-300" />
                                            <span className="text-gray-300 font-light">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur-2xl" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Pain Points Section */}
            <div className="relative z-10 px-8 py-32">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24">
                        <h2 className="text-6xl font-extralight text-white mb-8 tracking-tight">
                            <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                The
                            </span>
                            <span className="block bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                                Problem
                            </span>
                        </h2>
                        <p className="text-2xl text-gray-300 max-w-3xl mx-auto font-light">
                            You're running multiple projects with a small team. Here's what's probably keeping you up at night:
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                        {[
                            {
                                icon: '👁️',
                                title: 'No Clear Picture',
                                description: 'You have 3-5 projects running simultaneously, but no easy way to see what\'s actually happening across all of them. You\'re flying blind.'
                            },
                            {
                                icon: '💬',
                                title: 'Constant Status Pings',
                                description: 'You\'re constantly asking "What are you working on?" and "How\'s that project going?" It\'s exhausting for everyone involved.'
                            },
                            {
                                icon: '🎯',
                                title: 'Misaligned Priorities',
                                description: 'Without visibility, you can\'t tell if your team is working on the right things. Projects drift, deadlines slip, and you don\'t know until it\'s too late.'
                            },
                            {
                                icon: '💰',
                                title: 'No PM Resources',
                                description: 'You can\'t afford a dedicated PM, but you need project visibility. Traditional tools require too much overhead and maintenance.'
                            }
                        ].map((pain, i) => (
                            <div key={i} className="group">
                                <div className="bg-gradient-to-br from-red-900/20 to-red-800/10 backdrop-blur-xl border border-red-500/20 rounded-3xl p-8 hover:border-red-500/40 transition-all duration-500">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="text-4xl group-hover:scale-110 transition-transform duration-500">
                                            {pain.icon}
                                        </div>
                                        <h3 className="text-2xl font-light text-white tracking-wide">{pain.title}</h3>
                                    </div>
                                    <p className="text-gray-300 text-lg leading-relaxed font-light">{pain.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Benefits Section */}
            <div className="relative z-10 px-8 py-32">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24">
                        <h2 className="text-6xl font-extralight text-white mb-8 tracking-tight">
                            <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                What This
                            </span>
                            <span className="block bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                                Means
                            </span>
                        </h2>
                        <p className="text-2xl text-gray-300 max-w-3xl mx-auto font-light">
                            The benefits of having complete project visibility without the overhead
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                        {[
                            {
                                icon: '🤫',
                                title: 'Stop Micromanaging',
                                description: 'No more constant check-ins or status meetings. You can see what\'s happening without interrupting your team\'s flow.'
                            },
                            {
                                icon: '🚨',
                                title: 'Catch Problems Early',
                                description: 'Spot blockers and delays before they become crises. Proactively address issues before they impact your timeline.'
                            },
                            {
                                icon: '📈',
                                title: 'Better Resource Allocation',
                                description: 'See which projects need more attention and which are running smoothly. Make informed decisions about where to focus.'
                            },
                            {
                                icon: '💎',
                                title: 'No PM Salary',
                                description: 'Get project management visibility without hiring a PM. Perfect for startups that need oversight but can\'t afford the overhead.'
                            }
                        ].map((benefit, i) => (
                            <div key={i} className="group">
                                <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 backdrop-blur-xl border border-green-500/20 rounded-3xl p-8 hover:border-green-500/40 transition-all duration-500">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="text-4xl group-hover:scale-110 transition-transform duration-500">
                                            {benefit.icon}
                                        </div>
                                        <h3 className="text-2xl font-light text-white tracking-wide">{benefit.title}</h3>
                                    </div>
                                    <p className="text-gray-300 text-lg leading-relaxed font-light">{benefit.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom CTA */}
            <div className="relative z-10 px-8 py-32 text-center">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-6xl font-extralight text-white mb-8 tracking-tight">
                        <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                            Ready to see
                        </span>
                        <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            everything?
                        </span>
                    </h2>
                    <p className="text-2xl text-gray-300 mb-12 font-light">
                        Join startup leaders who have stopped guessing and started knowing
                    </p>
                    <button 
                        onClick={loginWithGithub}
                        className="group relative px-12 py-6 bg-gradient-to-r from-white/10 to-gray-500/10 backdrop-blur-xl border border-white/20 rounded-full text-white text-xl font-light tracking-wide hover:scale-105 transition-all duration-500 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        <span className="relative z-10 flex items-center gap-3">
                            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                            Begin with GitHub
                        </span>
                    </button>
                </div>
            </div>


        </div>
    );
}
