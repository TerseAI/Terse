import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface StatusOption {
    value: boolean | undefined;
    label: string;
}

interface StatusFilterProps {
    statusOptions: StatusOption[];
    selectedOption: StatusOption;
    onStatusChange: (option: StatusOption) => void;
}

export function StatusFilter({ statusOptions, selectedOption, onStatusChange }: StatusFilterProps) {
    return (
        <Listbox value={selectedOption} onChange={onStatusChange}>
            <div className="relative sm:w-auto w-full sm:min-w-[140px]">
                <ListboxButton className="relative w-full pl-3 pr-10 py-2.5 text-left text-sm text-[theme(text-primary)] bg-[theme(background-elevated)] border border-[theme(border)] rounded-lg hover:bg-[theme(background-elevated)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)] transition-colors cursor-pointer">
                    <span className="block truncate">{selectedOption.label}</span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronDownIcon className="h-5 w-5 text-[theme(text-disabled)]" aria-hidden="true" />
                    </span>
                </ListboxButton>
                <ListboxOptions className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg bg-[theme(background-elevated)] border border-[theme(border)] py-1 shadow-lg focus:outline-none">
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
    );
}
