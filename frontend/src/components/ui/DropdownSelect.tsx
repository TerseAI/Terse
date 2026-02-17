import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "./button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "./dropdown-menu"

export type StatusOption = {
    label: string
    value: string
}

type DropdownSelectProps = {
    statusOptions: StatusOption[]
    selectedOption: StatusOption | null
    setSelected: (value: string) => void
    additionalAction?: {
        label: string
        onClick: () => void
    }
    placeholder?: string
    modal?: boolean
    triggerClassName?: string
    contentClassName?: string
}

const DropdownSelect = ({ statusOptions, selectedOption, setSelected, additionalAction, placeholder = "Select an option", modal = true, triggerClassName, contentClassName }: DropdownSelectProps) => {
    return (
        <DropdownMenu modal={modal}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className={triggerClassName}>
                    <span className="block truncate">{selectedOption?.label ?? placeholder}</span>
                    <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className={cn("max-h-60", contentClassName)} align="start">
                <DropdownMenuRadioGroup value={selectedOption?.value ?? ""} onValueChange={setSelected}>
                    {statusOptions.map((option, idx) => (
                        <DropdownMenuRadioItem key={idx} value={option.value}>
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                {additionalAction && <DropdownMenuItem onClick={additionalAction.onClick}>{additionalAction.label}</DropdownMenuItem>}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default DropdownSelect
