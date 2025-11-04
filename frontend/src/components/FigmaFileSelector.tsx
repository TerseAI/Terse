import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Input } from "./ui/input";
import { extractFileKeyFromFigmaUrl, buildFigmaFileUrl } from "../utility/figmaUtils";
import { FigmaConfig } from "../shared/types";

interface FigmaFileSelectorProps {
    selectedFileKey?: string;
    selectedFileName?: string;
    onSelect: (fileKey: string, fileName?: string) => void;
    integrationId: string; // Required - user must connect Figma account first
}

export function FigmaFileSelector({
    selectedFileKey,
    selectedFileName,
    onSelect,
    integrationId
}: FigmaFileSelectorProps) {
    const [url, setUrl] = useState('');
    const [extractedFileKey, setExtractedFileKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    // Initialize URL if we already have a file key
    useEffect(() => {
        if (selectedFileKey && !url) {
            setUrl(buildFigmaFileUrl(selectedFileKey));
            setExtractedFileKey(selectedFileKey);
        }
    }, [selectedFileKey, url]);

    // Handle URL paste/input
    const handleUrlChange = (value: string) => {
        setUrl(value);
        setError(null);
        
        // Real-time validation
        if (value.trim()) {
            setIsValidating(true);
            const fileKey = extractFileKeyFromFigmaUrl(value);
            if (fileKey) {
                setExtractedFileKey(fileKey);
                setError(null);
                // Extract file name from URL if possible (optional)
                const urlParts = value.split('/');
                const fileNamePart = urlParts[urlParts.length - 1];
                const fileName = fileNamePart && fileNamePart.includes('?') 
                    ? fileNamePart.split('?')[0] 
                    : fileNamePart;
                const cleanFileName = fileName && fileName !== fileKey ? decodeURIComponent(fileName) : undefined;
                onSelect(fileKey, cleanFileName);
            } else {
                setExtractedFileKey(null);
                if (value.trim().length > 10) {
                    // Only show error if user has typed something substantial
                    setError('Please enter a valid Figma file URL');
                }
            }
            setIsValidating(false);
        } else {
            setExtractedFileKey(null);
            setIsValidating(false);
            // Clear the config when URL is cleared
            onSelect('', '');
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData('text');
        handleUrlChange(pasted);
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[theme(text-primary)]">
                    Figma File URL <span className="text-red-500">*</span>
                </label>
                <Input
                    type="text"
                    placeholder="https://www.figma.com/design/..."
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    onPaste={handlePaste}
                    className={error ? 'border-red-500' : ''}
                    required
                />
                <p className="text-xs text-[theme(text-secondary)]">
                    Paste a Figma file URL to monitor for comments
                </p>
            </div>

            {isValidating && (
                <div className="text-xs text-[theme(text-secondary)]">
                    Validating...
                </div>
            )}

            {error && extractedFileKey === null && (
                <div className="text-sm text-red-600">
                    {error}
                </div>
            )}

            {extractedFileKey && (
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-[theme(border)] bg-[theme(background-light)]">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-[theme(text-primary)]">
                                {selectedFileName || 'Design File'}
                            </span>
                            <span className="text-xs text-[theme(text-secondary)] font-mono">
                                File ID: {extractedFileKey}
                            </span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-[theme(text-secondary)]" />
                    </div>
                    <a
                        href={buildFigmaFileUrl(extractedFileKey)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[theme(--color-accent)] hover:underline flex items-center gap-1 w-fit"
                    >
                        View in Figma
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            )}
        </div>
    );
}

