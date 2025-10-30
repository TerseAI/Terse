export type ButtonProps = {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
    isComplete?: boolean;
    isSaving?: boolean;
}

export function Button({ children, onClick, disabled, className, isComplete = true, isSaving = false }: ButtonProps) {
    return (
        <button onClick={onClick} disabled={disabled} className={
            `px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-[var(--shadow)] ${isComplete && !isSaving
            ? 'bg-[var(--color-accent)] text-[theme(text-primary)] hover:scale-[1.02] hover:brightness-110'
            : 'bg-[theme(background-light)] text-[theme(text-disabled)] cursor-not-allowed'
            } ${className}`}>
            {children}
        </button>
    )
}