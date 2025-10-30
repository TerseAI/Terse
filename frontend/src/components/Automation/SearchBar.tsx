import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SearchBarProps {
    searchQuery: string;
    className?: string;
    onSearchChange: (query: string) => void;
}

export function SearchBar({ searchQuery, className, onSearchChange }: SearchBarProps) {
    return (
        <div className={`relative flex-1 ${className}`}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-[theme(text-disabled)]" />
            </div>
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search automations by name..."
                className="block w-full pl-10 pr-10 py-2.5 text-sm text-[theme(text-primary)] bg-[theme(background)] border border-[theme(border)] rounded-lg placeholder-[theme(text-disabled)] focus:outline-none focus:border-[theme(--color-accent)] transition-colors"
            />
            {searchQuery && (
                <button
                    onClick={() => onSearchChange('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[theme(text-disabled)] hover:text-[theme(text-secondary)] transition-colors"
                >
                    <XMarkIcon className="h-5 w-5" />
                </button>
            )}
        </div>
    );
}
