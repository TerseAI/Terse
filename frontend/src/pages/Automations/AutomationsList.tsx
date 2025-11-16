import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AutomationsTable } from '../../components/AutomationsTable';
import { AutomationsHeader, SearchBar, StatusFilter, DeletingModal } from '../../components/Automation';
import { Automation } from '../../shared/types';
import { useAutomationMutations } from '@/hooks/api/useAutomations';

const statusOptions = [
    { value: undefined, label: 'All' },
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' },
];

export default function AutomationsList() {
    const navigate = useNavigate();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [creatingId, setCreatingId] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
    const { deleteAutomation, createAutomation } = useAutomationMutations();
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
            await deleteAutomation(automation.id);
        } catch (error) {
            console.error('Failed to delete automation:', error);
            alert('Failed to delete automation. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleCreateNew = async () => {
        try {
            setCreatingId(true);
            // Create a new automation with just a name (creates as draft)
            const result = await createAutomation({
                name: 'New Automation',
                inputs: [],
                output: undefined,
                prompt: { text: '' },
                isActive: false,
            });

            if (result?.id) {
                // Navigate to the new automation's edit page
                navigate(`/app/automations/${result.id}?tab=edit`);
            }
        } catch (error) {
            console.error('Failed to create automation:', error);
            alert('Failed to create automation. Please try again.');
        } finally {
            setCreatingId(false);
        }
    };

    return (
        <div className="flex flex-col h-full p-4">
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto space-y-6">
                    <AutomationsHeader onCreateNew={handleCreateNew} isCreating={creatingId} />

                    <div className="grid grid-cols-20 sm:grid-flow-row gap-3">
                        <SearchBar searchQuery={searchQuery} placeholder="Search automations by name..." className="col-span-16" onSearchChange={setSearchQuery} />
                        <StatusFilter
                            statusOptions={statusOptions}
                            selectedOption={selectedOption}
                            onStatusChange={(option) => setStatusFilter(option.value)}
                            className="col-span-4"
                        />
                    </div>

                    <AutomationsTable
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onCreateNew={handleCreateNew}
                        searchQuery={searchQuery}
                        statusFilter={statusFilter}
                    />
                </div>
            </div>

            <DeletingModal isDeleting={!!deletingId} />
        </div>
    );
}
