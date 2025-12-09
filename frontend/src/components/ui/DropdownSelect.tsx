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
    selectedOption: StatusOption | null;
    setSelected: (value: string) => void;
    additionalAction?: {
        label: string;
        onClick: () => void;
    };
    placeholder?: string;
    modal?: boolean;
}

const DropdownSelect = ({ statusOptions, selectedOption, setSelected, additionalAction, placeholder = 'Select an option', modal = true }: DropdownSelectProps) => {
    return (
        <DropdownMenu modal={modal}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">
                    <span className="block truncate">{selectedOption?.label ?? placeholder}</span>
                    <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-60" align="start">
                <DropdownMenuRadioGroup
                    value={selectedOption?.value ?? ''}
                    onValueChange={setSelected}
                >
                    {statusOptions.map((option, idx) => (
                        <DropdownMenuRadioItem key={idx} value={option.value}>
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                {additionalAction && (
                    <DropdownMenuItem onClick={additionalAction.onClick}>
                        {additionalAction.label}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default DropdownSelect