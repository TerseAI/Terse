import { type JSX, useEffect, useRef, useState } from 'react';

interface Token {
    id: string;
    value: string;
}

function TokenStream({ text, disableAnimation = false }: { text: string, disableAnimation?: boolean }) {
    const previousTextRef = useRef<string>('');
    const [tokens, setTokens] = useState<Token[]>([]);
    const [buffer, setBuffer] = useState<string[]>([]);
    const [finalText, setFinalText] = useState<string>('');
    const [showFormatted, setShowFormatted] = useState(false);

    // If animation is disabled, immediately show formatted text
    useEffect(() => {
        if (disableAnimation && text) {
            setFinalText(text);
            setShowFormatted(true);
            setTokens([]);
            setBuffer([]);
        }
    }, [text, disableAnimation]);

    // Process markdown
    const processMarkdown = (text: string): JSX.Element => {
        let processed = text;
        
        // Handle code blocks ```
        processed = processed.replace(/```([\s\S]*?)```/g, 
            '<pre class="bg-gray-800 rounded p-4 overflow-x-auto my-4 font-mono"><code>$1</code></pre>'
        );
        
        // Handle bold **text**
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
        
        // Handle italic *text* (but not **text**)
        processed = processed.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em class="italic">$1</em>');
        
        // Handle inline code `text`
        processed = processed.replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded font-mono text-sm">$1</code>');
        
        // Handle headers
        processed = processed.replace(/^#### (.*$)/gm, '<h3 class="text-lg font-bold mb-2 mt-4">$1</h3>');
        processed = processed.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mb-2 mt-4">$1</h3>');
        processed = processed.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mb-3 mt-6">$1</h2>');
        processed = processed.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4 mt-8">$1</h1>');
        
        // Handle bullet lists - simple approach
        processed = processed.replace(/^\* (.*)$/gm, '• $1');
        processed = processed.replace(/^- (.*)$/gm, '• $1');
        processed = processed.replace(/^\+ (.*)$/gm, '• $1');
        
        // Handle numbered lists - simple approach
        processed = processed.replace(/^(\d+)\. (.*)$/gm, '$1. $2');
        
        return <span dangerouslySetInnerHTML={{ __html: processed }} />;
    };

    // Diff text and buffer the new tokens
    useEffect(() => {
        if (disableAnimation) return;
        
        const prev = previousTextRef.current;
        if (text === prev || text.length < prev.length) return;

        const diff = text.slice(prev.length);
        const newTokens = diff.split(/(\s+|\n+)/);

        setBuffer((prev) => [...prev, ...newTokens]);
        previousTextRef.current = text;
    }, [text, disableAnimation]);

    // Pop 1-3 tokens into `tokens` array every interval
    useEffect(() => {
        if (disableAnimation) return;
        if (buffer.length === 0) return;

        const interval = setInterval(() => {
            const next = buffer.slice(0, 3).map((value) => ({
                id: crypto.randomUUID(),
                value,
            }));

            setTokens((prev) => [...prev, ...next]);
            setBuffer((prev) => prev.slice(3));
        }, 20);

        return () => clearInterval(interval);
    }, [buffer]);

    // Handle when streaming finishes - wait a bit then apply formatting
    useEffect(() => {
        const currentText = tokens.map(token => token.value).join('');
        
        if (currentText === text && buffer.length === 0 && text.length > 0) {
            // Streaming is complete, wait a moment then apply formatting
            const timer = setTimeout(() => {
                setFinalText(text);
                setShowFormatted(true);
            }, 500); // Small delay to let animation settle
            
            return () => clearTimeout(timer);
        }
    }, [tokens, text, buffer.length]);

    // Show formatted version
    if (showFormatted && finalText) {
        return (
            <div className="text-foreground text-md leading-relaxed whitespace-pre-wrap text-wrap-pretty select-text">
                {processMarkdown(finalText)}
            </div>
        );
    }

    // Show streaming tokens
    return (
        <div className="text-foreground text-md leading-relaxed whitespace-pre-wrap text-wrap-pretty select-text">
            {tokens.map((token) => (
                <span
                    key={token.id}
                    className="animate-in fade-in-0 duration-150"
                >
                    {token.value}
                </span>
            ))}
        </div>
    );
}

export default TokenStream;