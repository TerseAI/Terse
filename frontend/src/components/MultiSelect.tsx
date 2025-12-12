import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
    id: string | number;
    label: string;
}

interface MultiSelectProps {
    options: MultiSelectOption[];
    selectedIds: (string | number)[];
    onSelect: (ids: (string | number)[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    displayText?: (count: number, selected: MultiSelectOption[]) => string;
    showBadges?: boolean;
    maxBadgeWidth?: string;
    className?: string;
    renderItem?: (option: MultiSelectOption, isSelected: boolean) => React.ReactNode;
    renderBadge?: (option: MultiSelectOption) => React.ReactNode;
}

export function MultiSelect({
    options,
    selectedIds,
    onSelect,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyMessage = "No options found.",
    displayText,
    showBadges = true,
    maxBadgeWidth = "200px",
    className,
    renderItem,
    renderBadge,
}: MultiSelectProps) {
    const [open, setOpen] = useState(false);

    const selectedOptions = options.filter((option) =>
        selectedIds.includes(option.id)
    );

    const handleToggle = (id: string | number) => {
        const isSelected = selectedIds.includes(id);
        if (isSelected) {
            onSelect(selectedIds.filter((selectedId) => selectedId !== id));
        } else {
            onSelect([...selectedIds, id]);
        }
    };

    const handleRemove = (id: string | number) => {
        onSelect(selectedIds.filter((selectedId) => selectedId !== id));
    };

    const getDisplayText = () => {
        if (displayText) {
            return displayText(selectedOptions.length, selectedOptions);
        }
        if (selectedOptions.length === 0) {
            return placeholder;
        }
        if (selectedOptions.length === 1) {
            return selectedOptions[0].label;
        }
        return `${selectedOptions.length} selected`;
    };

    return (
        <div className={cn("space-y-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        <span className="truncate">{getDisplayText()}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                    <Command>
                        <CommandInput placeholder={searchPlaceholder} />
                        <CommandList>
                            <CommandEmpty>{emptyMessage}</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => {
                                    const isSelected = selectedIds.includes(option.id);
                                    return (
                                        <CommandItem
                                            key={option.id}
                                            value={`${option.id}-${option.label}`}
                                            onSelect={() => {
                                                handleToggle(option.id);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    isSelected ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {renderItem ? (
                                                renderItem(option, isSelected)
                                            ) : (
                                                <span className="truncate">{option.label}</span>
                                            )}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {showBadges && selectedOptions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedOptions.map((option) => (
                        <Badge
                            key={option.id}
                            variant="secondary"
                            className="pr-1"
                        >
                            {renderBadge ? (
                                renderBadge(option)
                            ) : (
                                <span className="truncate" style={{ maxWidth: maxBadgeWidth }}>
                                    {option.label}
                                </span>
                            )}
                            <button
                                onClick={() => handleRemove(option.id)}
                                className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleRemove(option.id);
                                    }
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

