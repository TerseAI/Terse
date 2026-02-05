import { SearchIcon, X } from "lucide-react"

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../ui/input-group"

interface SearchBarProps {
    searchQuery: string
    placeholder?: string
    className?: string
    onSearchChange: (query: string) => void
}

export function SearchBar({ searchQuery, placeholder, className, onSearchChange }: SearchBarProps) {
    return (
        <div className={`relative flex-1 ${className}`}>
            <InputGroup>
                <InputGroupInput value={searchQuery} onChange={e => onSearchChange(e.target.value)} placeholder={placeholder} />
                <InputGroupAddon>
                    <SearchIcon />
                </InputGroupAddon>
                {searchQuery && (
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton onClick={() => onSearchChange("")}>
                            <X />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>
        </div>
    )
}
