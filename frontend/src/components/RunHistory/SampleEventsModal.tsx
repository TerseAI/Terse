import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import RunHistoryItemTriggerHeader from './RunHistoryItem/RunHistoryItemTriggerHeader';
import { BackendProvider } from '../../services/backend';
import { AgentSampleEvent } from '../../shared/SampleEvents';
import { AgentTrigger } from '../../shared/types';
import { CONFIG_DETAILS } from '../../shared/Configs';
import { toast } from 'sonner';
import Spin from '../loading/Spin';

interface SampleEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  inputConfigs: AgentTrigger[];
}

export function SampleEventsModal({ isOpen, onClose, agentId, inputConfigs }: SampleEventsModalProps) {
  const [sampleEvents, setSampleEvents] = useState<AgentSampleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | undefined>();
  const [selectedInputIndex, setSelectedInputIndex] = useState(0);

  // Reset selectedInputIndex when inputConfigs changes to prevent out-of-bounds access
  useEffect(() => {
    if (selectedInputIndex >= inputConfigs.length) {
      setSelectedInputIndex(0);
    }
  }, [inputConfigs.length, selectedInputIndex]);

  // Fetch sample events when modal opens or when selected input changes
  useEffect(() => {
    if (isOpen && inputConfigs.length > 0 && selectedInputIndex < inputConfigs.length) {
      fetchAgentSampleEvents();
    }
  }, [isOpen, selectedInputIndex, inputConfigs.length]);

  const fetchAgentSampleEvents = async () => {
    setIsLoading(true);
    setSelectedEventIndex(undefined); // Reset event selection when changing inputs
    try {
      if (selectedInputIndex >= inputConfigs.length) {
        setSelectedInputIndex(0);
        return;
      }
      const config = inputConfigs[selectedInputIndex].config;
      if (!config) {
        toast.error('Invalid input configuration');
        setSampleEvents([]);
        return;
      }
      // Pass agentId to get filter results
      const events = await BackendProvider.getAgentSampleEvents(config, agentId);
      setSampleEvents(events);
    } catch (error: any) {
      // Display specific error message from backend if available
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch sample events';
      toast.error(errorMessage);
      setSampleEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendSampleEvent = async () => {
    if (selectedEventIndex === undefined) return;

    setIsLoading(true);
    try {
      const agentSampleEvent = sampleEvents[selectedEventIndex];
      if (!agentSampleEvent) return;
      await BackendProvider.sendSampleEvent(agentSampleEvent);
      toast.success('Sample event sent to agent, check the activity log');
      onClose();
    } catch (error) {
      toast.error('Error sending sample event to agent');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to get display name for input config
  const getInputDisplayName = (input: AgentTrigger, index: number) => {
    const configType = input.config?.configType;
    return configType ? `${CONFIG_DETAILS[configType].name} Input ${index + 1}` : `Input ${index + 1}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test with Sample Event</DialogTitle>
          <DialogDescription>
            Select a recent event to test your agent
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 min-w-0 overflow-hidden">
          {/* Input Selector - only show if multiple inputs */}
          {inputConfigs.length > 1 && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Select Input Trigger</label>
              <Select
                value={String(selectedInputIndex)}
                onValueChange={(value) => setSelectedInputIndex(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {inputConfigs.map((input, index) => (
                    <SelectItem key={index} value={String(index)}>
                      {getInputDisplayName(input, index)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sample Events List */}
          <div className="flex flex-col gap-3 min-w-0">
            <label className="text-sm font-medium">Sample Events</label>
            {isLoading && <Spin />}

            {!isLoading && sampleEvents.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No sample events available for this input
              </div>
            )}

            <div className="flex flex-col gap-3 overflow-hidden">
              {!isLoading && sampleEvents.map((event, index) => (
                <RunHistoryItemTriggerHeader
                  key={index}
                  trigger={event.sampleEvent.trigger}
                  onClick={() => setSelectedEventIndex(index)}
                  selected={selectedEventIndex === index}
                  index={index}
                  filterResult={event.filterResult}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={sendSampleEvent}
            disabled={selectedEventIndex === undefined || isLoading}
          >
            Send to Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
