import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AutomationsTable } from '../../components/AutomationsTable';
import { BackendProvider } from '../../services/backend';
import { Automation } from '../../shared/types';

const statusOptions = [
    { value: undefined, label: 'All' },
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' },
];

export default function AutomationsList() {
    const navigate = useNavigate();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
    const selectedOption = statusOptions.find(opt => opt.value === statusFilter) || statusOptions[0];

    const handleEdit = (automation: Automation) => {
        // Navigate to edit page (we'll need to update the Automations page to support editing)
        navigate(`/app/automations/${automation.id}`);
    };

    const handleDelete = async (automation: Automation) => {
        if (!window.confirm(`Are you sure you want to delete "${automation.name}"?`)) {
            return;
        }

        try {
            setDeletingId(automation.id);
            await BackendProvider.deleteAutomation(automation.id);
            // Trigger refresh of the table
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Failed to delete automation:', error);
            alert('Failed to delete automation. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleCreateNew = () => {
        navigate('/app/automations/new');
    };

    return (
        <div className="grid grid-flow-row pt-4">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h1 className="text-2xl font-bold text-white">Automations</h1>
                        <button
                            onClick={handleCreateNew}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[theme(--color-accent)] rounded-lg hover:bg-[theme(--color-accent)]/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[theme(--color-accent)] transition-colors"
                        >
                            <PlusIcon className="h-5 w-5" />
                            New Automation
                        </button>
                    </div>

                    {/* Search and Filter Bar */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-[theme(text-disabled)]" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search automations by name..."
                                className="block w-full pl-10 pr-10 py-2.5 text-sm text-[theme(text-primary)] bg-[theme(background-elevated)] border border-[theme(border)] rounded-lg placeholder-[theme(text-disabled)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)] focus:border-transparent transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[theme(text-disabled)] hover:text-[theme(text-secondary)] transition-colors"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        <Listbox value={selectedOption} onChange={(option) => setStatusFilter(option.value)}>
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
                    </div>

                    {/* Table */}
                    <AutomationsTable
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        refreshTrigger={refreshTrigger}
                        searchQuery={searchQuery}
                        statusFilter={statusFilter}
                    />
                </div>
            </div>

            {deletingId && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-[theme(background-elevated)] rounded-lg p-6">
                        <div className="flex items-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[theme(--color-accent)]"></div>
                            <span className="text-[theme(text-primary)]">Deleting automation...</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
