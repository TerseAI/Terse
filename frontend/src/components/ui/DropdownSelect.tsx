import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { CheckIcon } from "@heroicons/react/24/outline";

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
                <ListboxButton className="relative w-full pl-3 pr-10 py-2.5 text-left text-sm text-[theme(text-primary)] bg-[theme(background-light)] border border-[theme(border)] rounded-lg hover:bg-[theme(background)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)] transition-colors cursor-pointer">
                    <span className="block truncate">{selectedOption.label}</span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronDownIcon className="h-5 w-5 text-[theme(text-disabled)]" aria-hidden="true" />
                    </span>
                </ListboxButton>
                <ListboxOptions className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg bg-[theme(background)] border border-[theme(border)] py-1 shadow-[var(--shadow)] focus:outline-none">
                    {statusOptions.map((option, idx) => (
                        <ListboxOption
                            key={idx}
                            value={option}
                            className="relative cursor-pointer select-none py-2 pl-10 pr-4 text-sm data-[focus]:bg-[theme(--color-accent)]/10 text-[theme(text-primary)]"
                        >
                            {({ selected }) => (
                                <>
                                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                        {option.label}
                                    </span>
                                    {selected && (
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[theme(--color-accent)]">
                                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                        </span>
                                    )}
                                </>
                            )}
                        </ListboxOption>
                    ))}
                </ListboxOptions>
            </div>
        </Listbox>
    )
}

export default DropdownSelect