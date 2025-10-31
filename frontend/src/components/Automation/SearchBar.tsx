import { Search, SearchIcon, X } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../ui/input-group';

interface SearchBarProps {
    searchQuery: string;
    className?: string;
    onSearchChange: (query: string) => void;
}

export function SearchBar({ searchQuery, className, onSearchChange }: SearchBarProps) {
    return (
        <div className={`relative flex-1 ${className}`}>
            <InputGroup>
                <InputGroupInput value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search automations by name..." />
                <InputGroupAddon>
                    <SearchIcon />
                </InputGroupAddon>
                {searchQuery && (
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton onClick={() => onSearchChange('')}>
                            <X />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>
        </div>
    );
}
