import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChannelsTable } from '../../components/ChannelsTable';
import { ChannelsHeader, SearchBar, StatusFilter, DeletingModal } from '../../components/Channels';
import { Agent } from '../../shared/types';
import { useChannelMutations } from '@/hooks/api/useChannels';

const statusOptions = [
    { value: undefined, label: 'All' },
    { value: true, label: 'Active' },
    { value: false, label: 'Inactive' },
];

export default function ChannelsList() {
    const navigate = useNavigate();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
    const { deleteChannel } = useChannelMutations();
    const selectedOption = statusOptions.find(opt => opt.value === statusFilter) || statusOptions[0];

    const handleEdit = (channel: Agent) => {
        // Navigate to edit page
        navigate(`/app/agents/${channel.id}`);
    };

    const handleDelete = async (channel: Agent) => {
        if (!window.confirm(`Are you sure you want to delete "${channel.name}"?`)) {
            return;
        }

        try {
            setDeletingId(channel.id);
            await deleteChannel(channel.id);
        } catch (error) {
            console.error('Failed to delete agent:', error);
            alert('Failed to delete agent. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleCreateNew = () => {
        navigate('/app/agents/setup');
    };

    return (
        <div className="flex flex-col h-full p-4">
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto space-y-6">
                    <ChannelsHeader onCreateNew={handleCreateNew} />

                    <div className="grid grid-cols-20 sm:grid-flow-row gap-3">
                        <SearchBar searchQuery={searchQuery} placeholder="Search agents by name..." className="col-span-16" onSearchChange={setSearchQuery} />
                        <StatusFilter
                            statusOptions={statusOptions}
                            selectedOption={selectedOption}
                            onStatusChange={(option) => setStatusFilter(option.value)}
                            className="col-span-4"
                        />
                    </div>

                    <ChannelsTable
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
