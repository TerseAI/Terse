import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "./dropdown-menu";
import { Button } from "./button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusOption = {
    label: string;
    value: string;
}

type DropdownSelectProps = {
    statusOptions: StatusOption[];
    selectedOption: StatusOption;
    setSelected: (value: string) => void;
}

const DropdownSelect = ({ statusOptions, selectedOption, setSelected }: DropdownSelectProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full sm:w-auto justify-between pl-3 pr-3 py-2.5 text-sm text-foreground bg-card hover:bg-accent/10",
                        "focus:ring-2 focus:ring-accent"
                    )}
                >
                    <span className="block truncate">{selectedOption.label}</span>
                    <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60" align="start">
                <DropdownMenuRadioGroup
                    value={selectedOption.value}
                    onValueChange={setSelected}
                >
                    {statusOptions.map((option, idx) => (
                        <DropdownMenuRadioItem key={idx} value={option.value}>
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default DropdownSelect