import { useState, useRef, useEffect } from "react";
import TextareaAutosize from 'react-textarea-autosize';

type EditableTextProps = {
    value: string;
    onSave: (newValue: string) => void;
    onChange?: (newValue: string) => void;
    className?: string;
    placeholder?: string;
};

function EditableText({ value, onSave, onChange, className = "", placeholder = "Click to edit" }: EditableTextProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(value);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing && textAreaRef.current) {
            textAreaRef.current.focus();
            textAreaRef.current.selectionStart = textAreaRef.current.value.length;
        }
    }, [isEditing]);

    const handleClick = () => {
        if (!isEditing) {
            setIsEditing(true);
        }
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (text !== value) {
            onSave(text);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.metaKey) {
            setIsEditing(false);
            onSave(text);
        }
        if (e.key === 'Escape') {
            setText(value);
            setIsEditing(false);
        }
    };

    return (
        <div className={`w-full ${className}`}>
            {isEditing ? (
                <TextareaAutosize
                    ref={textAreaRef}
                    value={text}
                    onChange={(e) => { const v = e.target.value; setText(v); onChange?.(v); }}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="min-w-96 box-border p-2 text-[theme(text-primary)] border border-[theme(--color-accent-primary)] rounded focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent-primary)]"
                    placeholder={placeholder}
                />
            ) : (
                <div
                    onClick={handleClick}
                    className="text-4xl w-full box-border text-[theme(text-primary)] border border-transparent hover:border-[theme(--color-accent-primary)] hover:cursor-pointer rounded cursor-text min-h-[40px]"
                >
                    {value || <span className="text-[theme(text-secondary)]">{placeholder}</span>}
                </div>
            )}
            {isEditing && (
                <div className="text-xs text-[theme(text-secondary)] mt-1">
                    Press ⌘+Enter to save, Esc to cancel, or click away to save
                </div>
            )}
        </div>
    );
}

export default EditableText;
