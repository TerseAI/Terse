import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AutomationsTable } from '../../components/AutomationsTable';
import { AutomationsHeader, SearchBar, StatusFilter, DeletingModal } from '../../components/Automation';
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
        <div className="grid grid-flow-row pt-4 pl-8">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-6">
                    <AutomationsHeader onCreateNew={handleCreateNew} />

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
                        refreshTrigger={refreshTrigger}
                        searchQuery={searchQuery}
                        statusFilter={statusFilter}
                    />
                </div>
            </div>

            <DeletingModal isDeleting={!!deletingId} />
        </div>
    );
}
