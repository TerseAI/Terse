import { useEffect, useState, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

interface GlowingTextFieldProps {
    isLoading: boolean;
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    inputValue: string;
    placeholders?: string[];
    compact?: boolean;
    size?: Size;
    shouldAllowKeyboardShortcutForFocus?: boolean;
    autoFocus?: boolean;
    focusOverride?: boolean | null; // null = no override, true = focus, false = blur
}

export enum Size {
    Small = 'small',
    Medium = 'medium',
    Large = 'large',
}

function GlowingTextField({ isLoading, onInputChange, onKeyDown, inputValue, placeholders = [], compact = false, size = Size.Medium, shouldAllowKeyboardShortcutForFocus = true, autoFocus = false, focusOverride = null }: GlowingTextFieldProps) {
    const [currentPlaceholder, setCurrentPlaceholder] = useState<string | undefined>(placeholders ? placeholders[0] : undefined);
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    useEffect(() => {
        let currentIndex = 0;

        const interval = setInterval(() => {
            if (inputValue.length === 0) {

                setTimeout(() => {
                    currentIndex = (currentIndex + 1) % placeholders.length;
                    setCurrentPlaceholder(placeholders[currentIndex]);
                }, 800);
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [inputValue]);

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

    return (
        <div className={`grid place-items-stretch ${compact ? 'w-full max-w-full' : 'w-full'} overflow-visible`}>
            {isLoading && (
                <div className="absolute inset-0 pointer-events-none overflow-visible">
                    <div className="absolute left-1/2 top-1/2 w-full h-full animate-rect-orbit overflow-visible">
                        <div className={`absolute ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-full bg-purple-500/60 blur-sm shadow-[0_0_10px_rgba(168,85,247,0.6)] -translate-x-1/2 -translate-y-1/2 overflow-visible`} />
                    </div>
                </div>
            )}

            <div
                className={`
                        grid place-items-stretch
                        w-full
                        rounded-lg
                        transition-all
                        duration-400
                        p-1
                        bg-[theme(background)]
                        overflow-visible
                    `}
                style={isFocused ? {
                    boxShadow: `
                        0 0 20px -5px var(--color-accent),
                        0 0 30px -10px var(--color-accent-secondary),
                        0 0 40px -15px var(--color-accent-tertiary)
                    `
                } : {}}
            >
                <TextareaAutosize
                    ref={textareaRef}
                    className={`
                            w-full 
                            text-[theme(text-primary)]
                            ${getFontSize()} 
                            resize-none 
                            ${compact ? 'p-2.5' : 'p-4'} 
                            leading-normal 
                            placeholder:italic
                            placeholder:text-[theme(text-secondary)] 
                            rounded-lg
                            transition-all 
                            duration-300
                            focus:outline-none
                        `}
                    onChange={onInputChange}
                    onKeyDown={onKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    value={inputValue}
                    disabled={isLoading}
                    placeholder={currentPlaceholder}
                    rows={compact ? 1 : undefined}
                    maxRows={compact ? 4 : undefined}
                    autoFocus={autoFocus}
                />
            </div>
        </div>
    );
}

export default GlowingTextField;