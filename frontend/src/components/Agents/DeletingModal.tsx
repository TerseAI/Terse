interface DeletingModalProps {
    isDeleting: boolean;
}

export function DeletingModal({ isDeleting }: DeletingModalProps) {
    if (!isDeleting) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[theme(background)] rounded-lg p-6">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[theme(--color-accent)]"></div>
                    <span className="text-[theme(text-primary)]">Deleting channel...</span>
                </div>
            </div>
        </div>
    );
}
