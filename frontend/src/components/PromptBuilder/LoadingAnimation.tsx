import { useState, useEffect } from "react";

const loadingMessages = [
    "Analyzing your requirements...",
    "Crafting the perfect questions...",
    "Thinking about automation workflows...",
    "Understanding your integrations...",
    "Brainstorming ideas...",
    "Putting together the details...",
    "Almost there...",
];

interface LoadingAnimationProps {
    message?: string;
}

export function LoadingAnimation({ message }: LoadingAnimationProps) {
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

    useEffect(() => {
        if (message) return; // Don't rotate if custom message provided

        const interval = setInterval(() => {
            setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
        }, 5000); // Change every 5 seconds

        return () => clearInterval(interval);
    }, [message]);

    const displayMessage = message || loadingMessages[currentMessageIndex];

    return (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="text-center space-y-2">
                <p className="text-sm font-medium text-foreground animate-in fade-in duration-500">
                    {displayMessage}
                </p>
                <div className="flex items-center justify-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                </div>
            </div>
        </div>
    );
}

