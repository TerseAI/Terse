import { useState } from "react";
import type { RunHistoryStatus } from "../../shared/RunHistoryTypes";
import RunHistoryPagination from "./RunHistoryPagination";
import { SearchBar } from "../Agents/SearchBar";
import DateRangePicker from "./DatePicker";
import StatusFilter from "./StatusFilter";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { TestTube } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { SampleEventsModal } from './SampleEventsModal';
import { AgentTrigger } from "../../shared/types";

type DateRangeType = { from: Date | undefined; to: Date | undefined };

type Props = {
    filteredCount: number;
    startIndex: number;
    runsPerPage: number;

    searchQuery: string;
    onSearchChange: (value: string) => void;

    dateRange: DateRangeType;
    onDateRangeChange: (next: DateRangeType) => void;

    selectedStatuses: Set<RunHistoryStatus>;
    onToggleStatus: (status: RunHistoryStatus) => void;

    runsPerPageValue: number;
    onRunsPerPageChange: (value: number) => void;

    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;

    agentId: string | null;
    agentInputs: AgentTrigger[];
    isAgentSaved: boolean;
};

export default function RunHistoryToolBar({
    filteredCount,
    startIndex,
    runsPerPage,
    searchQuery,
    onSearchChange,
    dateRange,
    onDateRangeChange,
    selectedStatuses,
    onToggleStatus,
    runsPerPageValue,
    onRunsPerPageChange,
    currentPage,
    totalPages,
    onPageChange,
    agentId,
    agentInputs,
    isAgentSaved
}: Props) {
    const [isDateOpen, setIsDateOpen] = useState(false);
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [showSampleEventsModal, setShowSampleEventsModal] = useState(false);

    return (
        <div className="mb-6 space-y-4 relative">
            <div className="mb-4 flex justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        Showing {filteredCount === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + runsPerPage, filteredCount)} of {filteredCount} events
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Test with Sample Event Button */}
                    {agentId && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowSampleEventsModal(true)}
                                            disabled={!isAgentSaved || agentInputs.length === 0}
                                            className="gap-2"
                                        >
                                            <TestTube className="h-4 w-4" />
                                            Test E2E
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                {(!isAgentSaved || agentInputs.length === 0) && (
                                    <TooltipContent>
                                        {!isAgentSaved
                                            ? 'Save your agent to test with sample events'
                                            : 'Add an input trigger to test with sample events'}
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">Events per page:</span>
                        <Select
                            value={String(runsPerPageValue)}
                            onValueChange={(value) => onRunsPerPageChange(Number(value))}
                        >
                            <SelectTrigger className="w-20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-4">
                <SearchBar searchQuery={searchQuery} onSearchChange={onSearchChange} placeholder="Search events..." />

                <div className="flex items-center gap-4">
                    <DateRangePicker
                        dateRange={dateRange}
                        onDateRangeChange={onDateRangeChange}
                        open={isDateOpen}
                        onOpenChange={(open) => {
                            setIsDateOpen(open);
                            if (open) {
                                setIsStatusOpen(false);
                            }
                        }}
                    />

                    <StatusFilter
                        selectedStatuses={selectedStatuses}
                        onToggleStatus={onToggleStatus}
                        open={isStatusOpen}
                        onOpenChange={(open) => {
                            setIsStatusOpen(open);
                            if (open) {
                                setIsDateOpen(false);
                            }
                        }}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center justify-start gap-4">
                    <RunHistoryPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                    />
                </div>
            </div>

            {/* Sample Events Modal */}
            {agentId && agentInputs.length > 0 && (
                <SampleEventsModal
                    isOpen={showSampleEventsModal}
                    onClose={() => setShowSampleEventsModal(false)}
                    agentId={agentId}
                    inputConfigs={agentInputs}
                />
            )}
        </div>
    );
}



