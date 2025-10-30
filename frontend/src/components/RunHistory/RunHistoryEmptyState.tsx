import { FileText } from "lucide-react";

type Props = {
    hasActiveFilters: boolean;
    onClearAll: () => void;
};

export default function RunHistoryEmptyState({ hasActiveFilters, onClearAll }: Props) {
    return (
        <div className="text-center py-16">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-slate-400 mb-2">No runs found</h3>
            <p className="text-slate-500">
                {hasActiveFilters
                    ? "Try adjusting your filters or search query"
                    : "Run history will appear here as your automation processes events"}
            </p>
            {hasActiveFilters && (
                <button
                    className="mt-4 h-8 px-3 rounded-md border text-sm border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                    onClick={onClearAll}
                    type="button"
                >
                    Clear All Filters
                </button>
            )}
        </div>
    );
}



