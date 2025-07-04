import { Check, X } from 'lucide-react';
import { useEffect } from 'react';

interface ApprovalButtonsProps {
    message: string;
    onApprove: () => void;
    onReject: () => void;
    approveText?: string;
    rejectText?: string;
    className?: string;
}

export function ApprovalButtons({
    message,
    onApprove,
    onReject,
    approveText = "Yes",
    rejectText = "No",
    className = ""
}: ApprovalButtonsProps) {
    useEffect(() => {
        let approveTimeout: number | null = null;
        let rejectTimeout: number | null = null;
        let approveCount = 0;
        let rejectCount = 0;

        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'y') {
                approveCount++;
                
                if (approveCount === 1) {
                    // First press - start timer
                    approveTimeout = setTimeout(() => {
                        approveCount = 0;
                        approveTimeout = null;
                    }, 500);
                } else if (approveCount === 2) {
                    // Second press within 500ms - approve
                    if (approveTimeout) {
                        clearTimeout(approveTimeout);
                        approveTimeout = null;
                    }
                    approveCount = 0;
                    onApprove();
                }
            } else if (event.key.toLowerCase() === 'n') {
                rejectCount++;
                
                if (rejectCount === 1) {
                    // First press - start timer
                    rejectTimeout = setTimeout(() => {
                        rejectCount = 0;
                        rejectTimeout = null;
                    }, 500);
                } else if (rejectCount === 2) {
                    // Second press within 500ms - reject
                    if (rejectTimeout) {
                        clearTimeout(rejectTimeout);
                        rejectTimeout = null;
                    }
                    rejectCount = 0;
                    onReject();
                }
            }
        };

        // Add event listener
        document.addEventListener('keydown', handleKeyPress);

        // Cleanup
        return () => {
            document.removeEventListener('keydown', handleKeyPress);
            if (approveTimeout) clearTimeout(approveTimeout);
            if (rejectTimeout) clearTimeout(rejectTimeout);
        };
    }, [onApprove, onReject]);

    return (
        <div className={`p-4 border-t border-gray-700 bg-gray-800/50 ${className}`}>
            <div className="mb-3">
                <p className="text-white text-sm font-medium">{message}</p>
                <p className="text-gray-400 text-xs">Double-tap 'Y' to approve or 'N' to reject (within 500ms)</p>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={onApprove}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 font-medium"
                >
                    <Check className="w-4 h-4" />
                    {approveText}
                </button>
                <button
                    onClick={onReject}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 font-medium"
                >
                    <X className="w-4 h-4" />
                    {rejectText}
                </button>
            </div>
        </div>
    );
} 