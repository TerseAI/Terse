import { useState } from "react";
import { Input } from "../../../context/AutomationContext";
import { Integration } from "../../../context/Integrations";

export function IntegrationInput({ input, onRemove, isOutput }: { input: Input, onRemove?: () => void, isOutput?: boolean }) {
    const [isHovered, setIsHovered] = useState(false);

    const handleRemove = () => {
        onRemove?.();
    };

    return (
        <div
            className="h-30 relative flex items-center justify-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="relative flex flex-col items-center justify-center">
                <IntegrationBox isOutput={isOutput}>
                    <IconForInputType type={input.integration} />
                </IntegrationBox>
                {isOutput ? <LiveDocumentIndicator /> : <IntegrationStatus />}
            </div>
            {isHovered && (
                <button
                    onClick={handleRemove}
                    className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 text-[theme(text-secondary)] hover:text-[theme(--color-accent-danger)] transition-colors"
                >
                    <svg className="w-5 h-5 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M 19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            )}
        </div>
    )
}

function IntegrationStatus() {
    return (
        <>
            <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-3 flex items-center justify-center">
                <div className="flex items-center justify-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <div className="absolute w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75"></div>
                </div>
            </div>
        </>
    )
}

function LiveDocumentIndicator() {
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-3 flex items-center justify-center">
            <svg
                className="w-4 h-4 text-[theme(--color-accent-tertiary)] animate-spin"
                style={{ animationDuration: '3s' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
            </svg>
        </div>
    )
}

export function IntegrationBox({ children, isOutput }: { children: React.ReactNode, isOutput?: boolean }) {
    const boxSize = 24
    return (
        <div
            className={`w-${boxSize} h-${boxSize} flex items-center justify-center p-4 rounded-lg bg-[theme(background-light)] border border-[theme(border)] transition-all duration-200 hover:border-[theme(--color-accent)] hover:shadow-[var(--shadow)] overflow-hidden ${isOutput ? 'animate-breathe' : ''}`}
            style={isOutput ? {
                boxShadow: '0 0 20px -8px var(--color-accent-tertiary)'
            } : undefined}
        >
            {children}
        </div>
    )
}

export function IconForInputType({ type }: { type: Integration }) {
    switch (type) {
        case Integration.GITHUB:
            return <GithubIcon />;
        case Integration.LINEAR:
            return <LinearIcon />;
        case Integration.SLACK:
            return <SlackIcon />;
        case Integration.GMAIL:
            return <GmailIcon />;
        case Integration.NOTION:
            return <NotionIcon />;
    }
}

function GithubIcon() {
    return (
        <svg className="w-full h-full text-[theme(text-primary)]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
    );
}

function LinearIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" fill="none" viewBox="0 0 100 100">
            <path fill="#E6EDF3" d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5964C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228ZM.00189135 46.8891c-.01764375.2833.08887215.5599.28957165.7606L52.3503 99.7085c.2007.2007.4773.3075.7606.2896 2.3692-.1476 4.6938-.46 6.9624-.9259.7645-.157 1.0301-1.0963.4782-1.6481L2.57595 39.4485c-.55186-.5519-1.49117-.2863-1.648174.4782-.465915 2.2686-.77832 4.5932-.92588465 6.9624ZM4.21093 29.7054c-.16649.3738-.08169.8106.20765 1.1l64.77602 64.776c.2894.2894.7262.3742 1.1.2077 1.7861-.7956 3.5171-1.6927 5.1855-2.684.5521-.328.6373-1.0867.1832-1.5407L8.43566 24.3367c-.45409-.4541-1.21271-.3689-1.54074.1832-.99132 1.6684-1.88843 3.3994-2.68399 5.1855ZM12.6587 18.074c-.3701-.3701-.393-.9637-.0443-1.3541C21.7795 6.45931 35.1114 0 49.9519 0 77.5927 0 100 22.4073 100 50.0481c0 14.8405-6.4593 28.1724-16.7199 37.3375-.3903.3487-.984.3258-1.3542-.0443L12.6587 18.074Z" />
        </svg>
    );
}

function SlackIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" viewBox="0 0 122.8 122.8">
            <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
            <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
            <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
            <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
        </svg>
    );
}

function GmailIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            viewBox="0 0 24 24"
        >
            <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.366l8.073-5.873C21.69 2.28 24 3.434 24 5.457z" />
            <path fill="#FBBC04" d="M0 5.457v.727l12 9 12-9v-.727c0-2.023-2.309-3.178-3.927-1.964L12 9.366 3.927 3.493C2.31 2.28 0 3.434 0 5.457z" />
            <path fill="#34A853" d="M18.545 7.091v13.818h3.819c.904 0 1.636-.732 1.636-1.636V5.457z" />
            <path fill="#C5221F" d="M0 19.366c0 .904.732 1.636 1.636 1.636h3.819V7.091z" />
        </svg>
    );
}

function NotionIcon() {
    return <img src="/notion.png" alt="Notion" className="w-full h-full object-contain" />;
}