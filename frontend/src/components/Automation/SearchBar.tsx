import { Search, X } from 'lucide-react';

interface SearchBarProps {
    searchQuery: string;
    className?: string;
    onSearchChange: (query: string) => void;
}

export function SearchBar({ searchQuery, className, onSearchChange }: SearchBarProps) {
    return (
        <div className={`relative flex-1 ${className}`}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search automations by name..."
                className="block w-full pl-10 pr-10 py-2.5 text-sm text-foreground bg-background border border-input rounded-lg placeholder-muted-foreground focus:outline-none focus:border-accent transition-colors shadow-sm"
            />
            {searchQuery && (
                <button
                    onClick={() => onSearchChange('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
            )}
        </div>
    );
}
