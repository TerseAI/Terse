import { useEffect, useState, useRef, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send } from 'lucide-react';

interface GlowingTextFieldProps {
    isLoading: boolean;
    disabled: boolean;
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    inputValue: string;
    placeholders?: string[];
    compact?: boolean;
    size?: Size;
    shouldAllowKeyboardShortcutForFocus?: boolean;
    autoFocus?: boolean;
    focusOverride?: boolean | null; // null = no override, true = focus, false = blur
    minRows?: number;
    showBorder?: boolean;
    onSend?: () => void; // When provided, shows send button inside the text field
    onPlaceholderSelect?: (placeholder: string) => void; // When user clicks a placeholder suggestion
    showPlaceholderChips?: boolean; // Show clickable placeholder chips below input
}

export enum Size {
    Small = 'small',
    Medium = 'medium',
    Large = 'large',
}

function GlowingTextField({ isLoading, disabled, onInputChange, onKeyDown, inputValue, placeholders = [], compact = false, size = Size.Medium, shouldAllowKeyboardShortcutForFocus = true, autoFocus = false, focusOverride = null, minRows, showBorder = false, onSend, onPlaceholderSelect, showPlaceholderChips = false }: GlowingTextFieldProps) {
    const [displayedPlaceholder, setDisplayedPlaceholder] = useState<string>('');
    const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(true);
    const [isFullyTyped, setIsFullyTyped] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const typewriterRef = useRef<{ charIndex: number; timeoutId: NodeJS.Timeout | null }>({ charIndex: 0, timeoutId: null });

    // Handle focus override
    useEffect(() => {
        if (focusOverride === true) {
            textareaRef.current?.focus();
        } else if (focusOverride === false) {
            textareaRef.current?.blur();
        }
    }, [focusOverride]);

    const getFontSize = () => {
        switch (size) {
            case Size.Small:
                return 'text-sm';
            case Size.Medium:
                return 'text-base';
            case Size.Large:
                return 'text-lg';
            default:
                return 'text-base';
        }
    };

    // Typewriter animation effect
    useEffect(() => {
        if (!placeholders || placeholders.length === 0 || inputValue.length > 0) {
            setDisplayedPlaceholder('');
            setIsFullyTyped(false);
            setIsTyping(false);
            return;
        }

        const currentPlaceholder = placeholders[currentPlaceholderIndex];

        const typeNextChar = () => {
            if (typewriterRef.current.charIndex <= currentPlaceholder.length) {
                setDisplayedPlaceholder(currentPlaceholder.slice(0, typewriterRef.current.charIndex));
                typewriterRef.current.charIndex++;
                typewriterRef.current.timeoutId = setTimeout(typeNextChar, 40);
            } else {
                setIsTyping(false);
                setIsFullyTyped(true);
                // Wait before moving to next placeholder
                typewriterRef.current.timeoutId = setTimeout(() => {
                    setIsTyping(true);
                    setIsFullyTyped(false);
                    typewriterRef.current.charIndex = 0;
                    setCurrentPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
                }, 3000);
            }
        };

        // Reset and start typing
        typewriterRef.current.charIndex = 0;
        setIsTyping(true);
        setIsFullyTyped(false);
        typeNextChar();

        return () => {
            if (typewriterRef.current.timeoutId) {
                clearTimeout(typewriterRef.current.timeoutId);
            }
        };
    }, [currentPlaceholderIndex, placeholders, inputValue]);

    const handlePlaceholderClick = useCallback((placeholder: string) => {
        if (onPlaceholderSelect) {
            onPlaceholderSelect(placeholder);
        }
        textareaRef.current?.focus();
    }, [onPlaceholderSelect]);

    // Handle Tab to complete placeholder
    const handleKeyDownInternal = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab' && inputValue.length === 0 && displayedPlaceholder && onPlaceholderSelect) {
            e.preventDefault();
            const currentPlaceholder = placeholders[currentPlaceholderIndex];
            onPlaceholderSelect(currentPlaceholder);
            return;
        }
        onKeyDown(e);
    }, [inputValue, displayedPlaceholder, placeholders, currentPlaceholderIndex, onPlaceholderSelect, onKeyDown]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Command+K (Mac) or Ctrl+K (Windows/Linux)
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                textareaRef.current?.focus();
            }
        };

        if (shouldAllowKeyboardShortcutForFocus) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            if (shouldAllowKeyboardShortcutForFocus) {
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
    }, [shouldAllowKeyboardShortcutForFocus]);

    // Get placeholders to show as chips (excluding current one being typed)
    const chipPlaceholders = placeholders.filter((_, idx) => idx !== currentPlaceholderIndex);

    return (
        <div className={`flex flex-col gap-3 ${compact ? 'w-full max-w-full' : 'w-full'} overflow-visible`}>
            <div className="grid place-items-stretch overflow-visible">
                {isLoading && (
                    <div className="absolute inset-0 pointer-events-none overflow-visible">
                        <div className="absolute left-1/2 top-1/2 w-full h-full animate-rect-orbit overflow-visible">
                            <div className={`absolute ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-full bg-purple-500/60 blur-sm shadow-[0_0_10px_rgba(168,85,247,0.6)] -translate-x-1/2 -translate-y-1/2 overflow-visible`} />
                        </div>
                    </div>
                )}

                <div
                    className={`
                            relative
                            w-full
                            rounded-lg
                            transition-all
                            duration-400
                            bg-card
                            ${showBorder ? 'border-2 border-border focus-within:border-primary/50' : ''}
                        `}
                >
                    <TextareaAutosize
                        ref={textareaRef}
                        className={`
                                w-full
                                text-foreground
                                ${getFontSize()}
                                resize-none
                                ${compact ? 'px-3 py-2' : 'p-4'}
                                ${onSend ? 'pr-14' : ''}
                                ${compact ? 'leading-normal' : 'leading-relaxed'}
                                placeholder:italic
                                placeholder:text-muted-foreground
                                rounded-lg
                                transition-all
                                duration-300
                                focus:outline-none
                                min-h-15
                            `}
                        onChange={onInputChange}
                        onKeyDown={handleKeyDownInternal}
                        value={inputValue}
                        disabled={disabled}
                        placeholder={displayedPlaceholder + (isTyping && inputValue.length === 0 ? '|' : '')}
                        minRows={minRows ?? (compact ? 1 : undefined)}
                        maxRows={compact ? 4 : 10}
                        autoFocus={autoFocus}
                    />
                    {/* Tab hint - shows when placeholder is fully typed and input is empty */}
                    {isFullyTyped && inputValue.length === 0 && onPlaceholderSelect && (
                        <div className={`absolute right-4 flex items-center gap-1.5 text-xs text-muted-foreground/70 pointer-events-none animate-in fade-in duration-300 ${compact ? 'top-1/2 -translate-y-1/2' : 'bottom-4'}`}>
                            <kbd className="px-1.5 py-0.5 bg-muted/30 border border-border/30 rounded text-[10px] font-mono">Tab</kbd>
                            <span>to use</span>
                        </div>
                    )}
                    {/* Send button - only shows when there's input */}
                    {onSend && (
                        <button
                            type="button"
                            onClick={onSend}
                            disabled={disabled}
                            className={`absolute right-3 bottom-3 p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${inputValue.trim() ? '' : 'opacity-50'}`}
                            aria-label="Send message"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Placeholder suggestion chips */}
            {showPlaceholderChips && inputValue.length === 0 && chipPlaceholders.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                    {chipPlaceholders.slice(0, 3).map((placeholder, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handlePlaceholderClick(placeholder)}
                            className="px-3 py-1.5 text-sm text-muted-foreground bg-secondary/50 hover:bg-secondary hover:text-foreground border border-border/50 hover:border-border rounded-full transition-all duration-200 truncate max-w-[200px]"
                            title={placeholder}
                        >
                            {placeholder}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default GlowingTextField;