import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "./dropdown-menu";
import { Button } from "./button";
import { ChevronDown } from "lucide-react";

export type StatusOption = {
    label: string;
    value: string;
}

type DropdownSelectProps = {
    statusOptions: StatusOption[];
    selectedOption: StatusOption;
    setSelected: (value: string) => void;
    additionalAction?: {
        label: string;
        onClick: () => void;
    };
}

const DropdownSelect = ({ statusOptions, selectedOption, setSelected, additionalAction }: DropdownSelectProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">
                    <span className="block truncate">{selectedOption.label}</span>
                    <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-60" align="start">
                <DropdownMenuRadioGroup
                    value={selectedOption.value}
                    onValueChange={setSelected}
                >
                    {statusOptions.map((option, idx) => (
                        <DropdownMenuRadioItem key={idx} value={option.value}>
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                    {additionalAction && (
                        <DropdownMenuItem onClick={additionalAction.onClick}>
                            {additionalAction.label}
                        </DropdownMenuItem>
                    )}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default DropdownSelect