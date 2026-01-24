import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import RunHistoryItemTriggerHeader from './RunHistoryItem/RunHistoryItemTriggerHeader';
import { BackendProvider } from '../../services/backend';
import { SampleEvent } from '../../shared/SampleEvents';
import { TransientAgentTrigger } from '../../shared/types';
import { CONFIG_DETAILS } from '../../shared/Configs';
import { toast } from 'sonner';
import Spin from '../loading/Spin';

interface SampleEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  inputConfigs: TransientAgentTrigger[];
}

export function SampleEventsModal({ isOpen, onClose, agentId, inputConfigs }: SampleEventsModalProps) {
  const [sampleEvents, setSampleEvents] = useState<SampleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | undefined>();
  const [selectedInputIndex, setSelectedInputIndex] = useState(0);

  // Fetch sample events when modal opens or when selected input changes
  useEffect(() => {
    if (isOpen && inputConfigs.length > 0) {
      fetchSampleEvents();
    }
  }, [isOpen, selectedInputIndex]);

  const fetchSampleEvents = async () => {
    setIsLoading(true);
    setSelectedEventIndex(undefined); // Reset event selection when changing inputs
    try {
      const config = inputConfigs[selectedInputIndex].config;
      if (!config) {
        toast.error('Invalid input configuration');
        setSampleEvents([]);
        return;
      }
      const events = await BackendProvider.getSampleEvents(config);
      setSampleEvents(events);
    } catch (error) {
      toast.error('Failed to fetch sample events');
      setSampleEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendSampleEvent = async () => {
    if (selectedEventIndex === undefined) return;

    setIsLoading(true);
    try {
      const sampleEvent = sampleEvents[selectedEventIndex];
      await BackendProvider.sendSampleEvent({ agentId, sampleEvent });
      toast.success('Sample event sent to agent, check the activity log');
      onClose();
    } catch (error) {
      toast.error('Error sending sample event to agent');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to get display name for input config
  const getInputDisplayName = (input: TransientAgentTrigger, index: number) => {
    const configType = input.configType;
    const configName = CONFIG_DETAILS[configType]?.name || configType;
    return `${configName} Input ${index + 1}`;
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

        <div className="flex flex-col gap-4">
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
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Sample Events</label>
            {isLoading && <Spin />}

            {!isLoading && sampleEvents.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No sample events available for this input
              </div>
            )}

            {!isLoading && sampleEvents.map((event, index) => (
              <RunHistoryItemTriggerHeader
                key={index}
                trigger={event.trigger}
                onClick={() => setSelectedEventIndex(index)}
                selected={selectedEventIndex === index}
                index={index}
              />
            ))}
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
