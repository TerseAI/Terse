import { PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AutomationsTable } from '../../components/AutomationsTable';
import { BackendProvider } from '../../services/backend';
import { Automation } from '../../shared/types';

export default function AutomationsList() {
    const navigate = useNavigate();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Manage your automated workflows that keep your documents up to date
                            </p>
                        </div>
                        <button
                            onClick={handleCreateNew}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            <PlusIcon className="h-5 w-5" />
                            New Automation
                        </button>
                    </div>

                    {/* Table */}
                    <AutomationsTable
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        refreshTrigger={refreshTrigger}
                    />
                </div>
            </div>

            {deletingId && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6">
                        <div className="flex items-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span className="text-gray-900">Deleting automation...</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
