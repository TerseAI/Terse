import GlowingTextField, { Size } from "./GlowingTextField";
import { useEffect, useRef } from "react";
import { FileUploadButton } from "./FileUploadButton";
import { FilePreviewList } from "./FilePreview";
import { useFileUpload } from "./hooks/useFileUpload";
import { UploadedFile } from "../../shared/ModelEvents";

interface ChatInputProps {
    sendMessage: (message: string, uploadedFiles?: UploadedFile[]) => void;
    input: string;
    setInput: (input: string) => void;
    placeholders: string[];
    disabled?: boolean;
    runId?: string;
}

function ChatInput({ sendMessage, input, setInput, placeholders, disabled = false, runId }: ChatInputProps) {
    const prevSelectedRef = useRef<number | null>(null);

    // File upload functionality (only if runId is provided)
    const fileUpload = useFileUpload({ runId: runId || '' });
    const enableFileUpload = !!runId;

    // Track focus override based on state transitions
    const focusOverride = (() => {
        const hadSelection = prevSelectedRef.current !== null;
        const hasSelection = false;

        // If we went from having a selection to no selection, force focus
        if (hadSelection && !hasSelection) {
            return true;
        }

        // If we have a selection, force blur
        if (hasSelection) {
            return false;
        }

        // Otherwise, no override
        return null;
    })();

    // Update previous selection state
    useEffect(() => {
        prevSelectedRef.current = null;
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!disabled && !fileUpload.isUploading) {
                handleSend();
            }
        }
    };

    const handleSend = async () => {
        // Trim whitespace and check if message is empty (but allow empty message with files)
        const sanitizedMessage = input.trim();

        if (!sanitizedMessage && !fileUpload.hasFiles) {
            return; // Don't send empty messages without files
        }

        // Basic sanitization for LLM input
        // Remove any potential script tags or dangerous content
        const cleanMessage = sanitizedMessage
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();

        // Upload any pending files first
        let uploadedFiles: UploadedFile[] = [];
        if (fileUpload.hasFiles) {
            uploadedFiles = await fileUpload.uploadAllPending();
        }

        // Send the message with any uploaded files
        sendMessage(cleanMessage || '', uploadedFiles.length > 0 ? uploadedFiles : undefined);

        // Clear files after sending
        fileUpload.clearFiles();
    };

    const isDisabled = disabled || fileUpload.isUploading;
    const canSend = !isDisabled && (input.trim().length > 0 || (fileUpload.hasFiles && !fileUpload.hasErrors));

    return (
        <div className="p-4">
            {/* File previews */}
            {enableFileUpload && fileUpload.hasFiles && (
                <FilePreviewList
                    files={fileUpload.pendingFiles}
                    onRemove={fileUpload.removeFile}
                />
            )}

            <div className={`grid gap-2 items-end ${enableFileUpload ? 'grid-cols-[auto_1fr_auto]' : 'grid-cols-[1fr_auto]'}`}>
                {/* File upload button */}
                {enableFileUpload && (
                    <FileUploadButton
                        onFilesSelect={fileUpload.addFiles}
                        disabled={isDisabled}
                    />
                )}

                <GlowingTextField
                    isLoading={false}
                    disabled={isDisabled}
                    onInputChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    inputValue={input}
                    placeholders={placeholders}
                    compact={true}
                    size={Size.Small}
                    autoFocus={true}
                    focusOverride={focusOverride}
                />
                <button
                    className="px-4 py-2 bg-[theme(--accent-primary)] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSend}
                    disabled={!canSend}
                >
                    {fileUpload.isUploading ? 'Uploading...' : 'Send'}
                </button>
            </div>
        </div>
    );
}

export default ChatInput;
