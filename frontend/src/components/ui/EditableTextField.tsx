import { useState, useRef, useEffect } from "react";
import TextareaAutosize from 'react-textarea-autosize';
import { Pencil } from "lucide-react";

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
                    className="min-w-96 box-border p-2 text-foreground border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder={placeholder}
                />
            ) : (
                <div
                    onClick={handleClick}
                    className="text-4xl w-full box-border text-foreground border border-transparent hover:border-accent hover:cursor-pointer rounded cursor-text min-h-[40px] flex items-center gap-2"
                >
                    <span className="leading-tight">
                        {value || <span className="text-muted-foreground">{placeholder}</span>}
                    </span>
                    <Pencil className="w-5 h-5 text-muted-foreground flex-shrink-0 self-center" />
                </div>
            )}
            {isEditing && (
                <div className="text-xs text-muted-foreground mt-1">
                    Press ⌘+Enter to save, Esc to cancel, or click away to save
                </div>
            )}
        </div>
    );
}

export default EditableText;
