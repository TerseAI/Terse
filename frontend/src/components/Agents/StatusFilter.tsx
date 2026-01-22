import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface StatusOption {
    value: boolean | undefined;
    label: string;
}

interface StatusFilterProps {
    statusOptions: StatusOption[];
    selectedOption: StatusOption;
    onStatusChange: (option: StatusOption) => void;
    className?: string;
}

export function StatusFilter({ statusOptions, selectedOption, onStatusChange, className }: StatusFilterProps) {
    return (
        <Select onValueChange={(value) => onStatusChange(statusOptions.find((option) => option.label === value) ?? selectedOption)}>
            <SelectTrigger className={`relative sm:w-auto w-full sm:min-w-[140px] ${className}`}>
                <SelectValue placeholder={selectedOption.label} />
            </SelectTrigger>
            <SelectContent>
                {statusOptions.map((option, idx) => (
                    <SelectItem key={idx} value={option.label}>{option.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}