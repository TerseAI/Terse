import { useState, useMemo, useCallback } from "react";
import cronstrue from "cronstrue";
import { parseExpression } from "cron-parser";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Clock, Calendar, AlertCircle } from "lucide-react";

// Schedule presets for common use cases
const SCHEDULE_PRESETS = [
  { id: "hourly", label: "Every hour", cron: "0 * * * *" },
  { id: "daily-9am", label: "Daily at 9:00 AM", cron: "0 9 * * *" },
  { id: "daily-6pm", label: "Daily at 6:00 PM", cron: "0 18 * * *" },
  { id: "weekdays-9am", label: "Weekdays at 9:00 AM", cron: "0 9 * * 1-5" },
  { id: "weekly-monday", label: "Every Monday at 9:00 AM", cron: "0 9 * * 1" },
  { id: "weekly-friday", label: "Every Friday at 5:00 PM", cron: "0 17 * * 5" },
  { id: "monthly-1st", label: "1st of every month at 9:00 AM", cron: "0 9 1 * *" },
  { id: "custom", label: "Custom schedule", cron: "" },
] as const;

// Hours for custom schedule builder
const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString(),
  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
}));

// Days of week
const DAYS_OF_WEEK = [
  { value: "1", label: "Monday", short: "Mon" },
  { value: "2", label: "Tuesday", short: "Tue" },
  { value: "3", label: "Wednesday", short: "Wed" },
  { value: "4", label: "Thursday", short: "Thu" },
  { value: "5", label: "Friday", short: "Fri" },
  { value: "6", label: "Saturday", short: "Sat" },
  { value: "0", label: "Sunday", short: "Sun" },
];

// Days of month
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  value: (i + 1).toString(),
  label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
}));

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

type FrequencyType = "hourly" | "daily" | "weekly" | "monthly";

interface ScheduleEditorProps {
  value: string;
  onChange: (cronExpression: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ScheduleEditor({
  value,
  onChange,
  disabled = false,
  className,
}: ScheduleEditorProps) {
  // Determine if current value matches a preset
  const matchedPreset = useMemo(() => {
    const preset = SCHEDULE_PRESETS.find((p) => p.cron === value);
    return preset?.id ?? "custom";
  }, [value]);

  const [selectedPreset, setSelectedPreset] = useState<string>(matchedPreset);
  const [customFrequency, setCustomFrequency] = useState<FrequencyType>("daily");
  const [customHour, setCustomHour] = useState("9");
  const [customDaysOfWeek, setCustomDaysOfWeek] = useState<string[]>(["1", "2", "3", "4", "5"]);
  const [customDayOfMonth, setCustomDayOfMonth] = useState("1");

  // Parse the current cron expression for display
  const { humanReadable, nextRuns, error } = useMemo(() => {
    if (!value) {
      return { humanReadable: null, nextRuns: [], error: null };
    }

    try {
      const human = cronstrue.toString(value, { use24HourTimeFormat: false });
      const interval = parseExpression(value, { utc: true });
      const runs: Date[] = [];
      for (let i = 0; i < 3; i++) {
        runs.push(interval.next().toDate());
      }
      return { humanReadable: human, nextRuns: runs, error: null };
    } catch {
      return { humanReadable: null, nextRuns: [], error: "Invalid cron expression" };
    }
  }, [value]);

  // Handle preset selection
  const handlePresetChange = useCallback(
    (presetId: string) => {
      setSelectedPreset(presetId);
      const preset = SCHEDULE_PRESETS.find((p) => p.id === presetId);
      if (preset && preset.cron) {
        onChange(preset.cron);
      }
    },
    [onChange]
  );

  // Build custom cron expression
  const buildCustomCron = useCallback(
    (freq: FrequencyType, hour: string, daysOfWeek: string[], dayOfMonth: string) => {
      switch (freq) {
        case "hourly":
          return "0 * * * *";
        case "daily":
          return `0 ${hour} * * *`;
        case "weekly":
          if (daysOfWeek.length === 0) return `0 ${hour} * * *`;
          return `0 ${hour} * * ${daysOfWeek.sort().join(",")}`;
        case "monthly":
          return `0 ${hour} ${dayOfMonth} * *`;
        default:
          return "0 9 * * *";
      }
    },
    []
  );

  // Update custom schedule
  const updateCustomSchedule = useCallback(
    (
      freq: FrequencyType,
      hour: string,
      daysOfWeek: string[],
      dayOfMonth: string
    ) => {
      const cron = buildCustomCron(freq, hour, daysOfWeek, dayOfMonth);
      onChange(cron);
    },
    [buildCustomCron, onChange]
  );

  const handleFrequencyChange = (freq: FrequencyType) => {
    setCustomFrequency(freq);
    updateCustomSchedule(freq, customHour, customDaysOfWeek, customDayOfMonth);
  };

  const handleHourChange = (hour: string) => {
    setCustomHour(hour);
    updateCustomSchedule(customFrequency, hour, customDaysOfWeek, customDayOfMonth);
  };

  const handleDayOfWeekToggle = (day: string) => {
    const newDays = customDaysOfWeek.includes(day)
      ? customDaysOfWeek.filter((d) => d !== day)
      : [...customDaysOfWeek, day];
    setCustomDaysOfWeek(newDays);
    updateCustomSchedule(customFrequency, customHour, newDays, customDayOfMonth);
  };

  const handleDayOfMonthChange = (day: string) => {
    setCustomDayOfMonth(day);
    updateCustomSchedule(customFrequency, customHour, customDaysOfWeek, day);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Preset Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Schedule</Label>
        <Select
          value={selectedPreset}
          onValueChange={handlePresetChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a schedule" />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULE_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Custom Schedule Builder */}
      {selectedPreset === "custom" && (
        <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
          {/* Frequency */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Frequency</Label>
            <RadioGroup
              value={customFrequency}
              onValueChange={(v) => handleFrequencyChange(v as FrequencyType)}
              className="flex flex-wrap gap-4"
              disabled={disabled}
            >
              {[
                { value: "hourly", label: "Hourly" },
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ].map((freq) => (
                <div key={freq.value} className="flex items-center gap-2">
                  <RadioGroupItem value={freq.value} id={`freq-${freq.value}`} />
                  <Label htmlFor={`freq-${freq.value}`} className="cursor-pointer font-normal">
                    {freq.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Time Selection (not for hourly) */}
          {customFrequency !== "hourly" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Time (UTC)</Label>
              <Select
                value={customHour}
                onValueChange={handleHourChange}
                disabled={disabled}
              >
                <SelectTrigger className="w-48">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((hour) => (
                    <SelectItem key={hour.value} value={hour.value}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day of Week Selection (for weekly) */}
          {customFrequency === "weekly" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleDayOfWeekToggle(day.value)}
                    disabled={disabled}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                      customDaysOfWeek.includes(day.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent hover:text-accent-foreground",
                      disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day of Month Selection (for monthly) */}
          {customFrequency === "monthly" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Day of month</Label>
              <Select
                value={customDayOfMonth}
                onValueChange={handleDayOfMonthChange}
                disabled={disabled}
              >
                <SelectTrigger className="w-48">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_MONTH.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Schedule Preview */}
      {value && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          {error ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{humanReadable}</span>
              </div>
              {nextRuns.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Next runs (UTC):</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {nextRuns.map((run, i) => (
                      <li key={i}>
                        {run.toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "UTC",
                        })}{" "}
                        UTC
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Utility functions for working with cron expressions
export function isValidCronExpression(expression: string): boolean {
  try {
    parseExpression(expression);
    return true;
  } catch {
    return false;
  }
}

export function getCronDescription(expression: string): string | null {
  try {
    return cronstrue.toString(expression, { use24HourTimeFormat: false });
  } catch {
    return null;
  }
}

export function getNextCronRuns(expression: string, count: number = 5): Date[] {
  try {
    const interval = parseExpression(expression, { utc: true });
    const runs: Date[] = [];
    for (let i = 0; i < count; i++) {
      runs.push(interval.next().toDate());
    }
    return runs;
  } catch {
    return [];
  }
}
