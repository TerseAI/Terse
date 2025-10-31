import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { ChevronDown, Check } from "lucide-react";

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
        <Listbox value={selectedOption} onChange={(option) => setSelected(option.value)}>
            <div className="relative sm:w-auto w-full">
                <ListboxButton className="relative w-full pl-3 pr-10 py-2.5 text-left text-sm text-foreground bg-card border border-input rounded-lg hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent transition-colors cursor-pointer">
                    <span className="block truncate">{selectedOption.label}</span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </span>
                </ListboxButton>
                <ListboxOptions className="absolute z-10 mt-1 w-full max-h-60 rounded-lg bg-background border border-input py-1 shadow-sm focus:outline-none overflow-hidden">
                    <div className="max-h-60 overflow-auto">
                    {statusOptions.map((option, idx) => (
                        <ListboxOption
                            key={idx}
                            value={option}
                            className="relative cursor-pointer select-none py-2 pl-10 pr-4 text-sm data-[focus]:bg-accent/10 text-foreground"
                        >
                            {({ selected }) => (
                                <>
                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                        {option.label}
                                    </span>
                                    {selected && (
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-accent">
                                            <Check className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                    )}
                                </>
                            )}
                        </ListboxOption>
                    ))}
                    </div>
                </ListboxOptions>
            </div>
        </Listbox>
    )
}

export default DropdownSelect