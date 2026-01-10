import { useState } from "react";
import { CronExpressionParser } from "cron-parser";
import { cn } from "@/lib/utils";
import { Clock, Calendar, CalendarDays, Repeat, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function ScheduleEditor({
  value,
  onChange,
  className,
}: ScheduleEditorProps) {
  const initial = parseCronToState(value);
  const [frequency, setFrequency] = useState<Frequency | null>(initial.frequency);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(initial.daysOfWeek);
  const [dayOfMonth, setDayOfMonth] = useState(initial.dayOfMonth);

  const toggleDay = (day: string) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        // Don't allow deselecting the last day
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  };

  const currentCron = frequency ? buildCron(frequency, hour, minute, daysOfWeek, dayOfMonth) : "";
  const hasChanges = currentCron !== value;
  const isConfigured = frequency !== null;

  const handleSave = () => {
    if (currentCron) {
      onChange(currentCron);
    }
  };

  const nextRuns = currentCron ? getNextRuns(currentCron, 3) : [];
  const humanReadable = frequency ? getHumanReadable(frequency, hour, minute, daysOfWeek, dayOfMonth) : "Select a schedule frequency";

  return (
    <div className={cn("space-y-5", className)}>
      {/* Frequency Selection */}
      <div className="flex gap-2">
        {[
          { value: "daily", label: "Daily", icon: Repeat },
          { value: "weekly", label: "Weekly", icon: Calendar },
          { value: "monthly", label: "Monthly", icon: CalendarDays },
        ].map(({ value: freq, label, icon: Icon }) => (
          <button
            key={freq}
            onClick={() => setFrequency(freq as Frequency)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              frequency === freq
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Weekly Day Selection */}
      {frequency === "weekly" && (
        <div className="flex gap-1.5">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.value}
              onClick={() => toggleDay(day.value)}
              className={cn(
                "size-10 rounded-lg text-sm font-medium transition-all",
                daysOfWeek.includes(day.value)
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {day.label}
            </button>
          ))}
        </div>
      )}

      {/* Configuration Row - only show when frequency is selected */}
      {frequency && (
        <div className="flex flex-wrap items-center gap-3">
          {frequency === "weekly" && (
            <span className="text-sm text-muted-foreground">at</span>
          )}

          {frequency === "monthly" && (
            <>
              <span className="text-sm text-muted-foreground">on the</span>
              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                <SelectTrigger className="w-[80px]">
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
            </>
          )}

          {frequency === "daily" && (
            <span className="text-sm text-muted-foreground">Every day at</span>
          )}
          {frequency === "monthly" && (
            <span className="text-sm text-muted-foreground">at</span>
          )}

          <div className="flex items-center gap-1">
            <Select value={hour} onValueChange={setHour}>
              <SelectTrigger className="w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h.value} value={h.value}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={minute} onValueChange={setMinute}>
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-xs text-muted-foreground/70">{getLocalTimezoneAbbreviation()}</span>
        </div>
      )}

      {/* Preview */}
      <div className="rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="size-4 text-primary" />
          </div>
          <span className="text-sm font-medium">{humanReadable}</span>
        </div>

        {nextRuns.length > 0 && (
          <div className="pl-10">
            <p className="text-xs text-muted-foreground mb-1.5">Upcoming runs:</p>
            <div className="flex flex-wrap gap-2">
              {nextRuns.map((run, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-md bg-background/60 text-muted-foreground border border-border/30"
                >
                  {run.toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={!isConfigured || !hasChanges}
        className="w-full"
      >
        <Check className="size-4 mr-2" />
        {!isConfigured ? "Select a Frequency" : hasChanges ? "Save Schedule" : "Schedule Saved"}
      </Button>
    </div>
  );
}

// Utility exports
export function isValidCronExpression(expression: string): boolean {
  try {
    CronExpressionParser.parse(expression);
    return true;
  } catch {
    return false;
  }
}

export function getNextCronRuns(expression: string, count: number = 5): Date[] {
  return getNextRuns(expression, count);
}

export function getCronDescription(cron: string): string {
  const state = parseCronToState(cron);
  if (!state.frequency) return "No schedule configured";
  return getHumanReadable(
    state.frequency,
    state.hour,
    state.minute,
    state.daysOfWeek,
    state.dayOfMonth
  );
}

interface ScheduleEditorProps {
  value: string;
  onChange: (cronExpression: string) => void;
  className?: string;
}

type Frequency = "daily" | "weekly" | "monthly";

const DAYS_OF_WEEK = [
  { value: "0", label: "Sun" },
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`,
}));

const MINUTES = [
  { value: "0", label: ":00" },
  { value: "15", label: ":15" },
  { value: "30", label: ":30" },
  { value: "45", label: ":45" },
];

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
}));

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Timezone conversion utilities
function getTimezoneOffsetHours(): number {
  // getTimezoneOffset returns minutes, negative for ahead of UTC
  // e.g., UTC-5 (EST) returns 300, UTC+2 returns -120
  return -new Date().getTimezoneOffset() / 60;
}

function utcHourToLocal(utcHour: number): number {
  const offset = getTimezoneOffsetHours();
  let localHour = utcHour + offset;
  // Wrap around for timezone differences
  if (localHour < 0) localHour += 24;
  if (localHour >= 24) localHour -= 24;
  return localHour;
}

function localHourToUtc(localHour: number): number {
  const offset = getTimezoneOffsetHours();
  let utcHour = localHour - offset;
  // Wrap around for timezone differences
  if (utcHour < 0) utcHour += 24;
  if (utcHour >= 24) utcHour -= 24;
  return utcHour;
}

function getLocalTimezoneAbbreviation(): string {
  // Get timezone abbreviation (e.g., "EST", "PST", "UTC")
  const formatter = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' });
  const parts = formatter.formatToParts(new Date());
  const tzPart = parts.find(part => part.type === 'timeZoneName');
  return tzPart?.value || 'Local';
}

function parseCronToState(cron: string): {
  frequency: Frequency | null;
  hour: string;
  minute: string;
  daysOfWeek: string[];
  dayOfMonth: string;
} {
  // Default hour is 9 AM local time
  const emptyState = {
    frequency: null as Frequency | null,
    hour: "9",
    minute: "0",
    daysOfWeek: ["1"], // Monday by default when weekly is selected
    dayOfMonth: "1",
  };

  if (!cron) return emptyState;

  try {
    const parts = cron.split(" ");
    if (parts.length !== 5) return emptyState;

    const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

    const result = { ...emptyState };
    result.minute = minute === "*" ? "0" : minute;
    // Convert UTC hour from cron to local hour for display
    const utcHour = hour === "*" ? 9 : parseInt(hour);
    result.hour = String(utcHourToLocal(utcHour));

    if (dayOfWeek !== "*" && dayOfWeek !== "?") {
      result.frequency = "weekly";
      // Parse comma-separated days (e.g., "1,3,5")
      result.daysOfWeek = dayOfWeek.split(",").map((d) => d.trim());
    } else if (dayOfMonth !== "*" && dayOfMonth !== "?") {
      result.frequency = "monthly";
      result.dayOfMonth = dayOfMonth;
    } else {
      result.frequency = "daily";
    }

    return result;
  } catch {
    return emptyState;
  }
}

function buildCron(
  frequency: Frequency,
  hour: string,
  minute: string,
  daysOfWeek: string[],
  dayOfMonth: string
): string {
  // Convert local hour to UTC for storage
  const utcHour = localHourToUtc(parseInt(hour));

  switch (frequency) {
    case "daily":
      return `${minute} ${utcHour} * * *`;
    case "weekly":
      // Sort days and join with commas
      const sortedDays = [...daysOfWeek].sort((a, b) => parseInt(a) - parseInt(b));
      return `${minute} ${utcHour} * * ${sortedDays.join(",")}`;
    case "monthly":
      return `${minute} ${utcHour} ${dayOfMonth} * *`;
  }
}

function getNextRuns(cron: string, count: number = 3): Date[] {
  try {
    const parsed = CronExpressionParser.parse(cron, { tz: "UTC" });
    const runs: Date[] = [];
    for (let i = 0; i < count; i++) {
      runs.push(parsed.next().toDate());
    }
    return runs;
  } catch {
    return [];
  }
}

function getHumanReadable(
  frequency: Frequency,
  hour: string,
  minute: string,
  daysOfWeek: string[],
  dayOfMonth: string
): string {
  const hourNum = parseInt(hour);
  const timeStr =
    hourNum === 0
      ? `12:${minute.padStart(2, "0")} AM`
      : hourNum < 12
        ? `${hourNum}:${minute.padStart(2, "0")} AM`
        : hourNum === 12
          ? `12:${minute.padStart(2, "0")} PM`
          : `${hourNum - 12}:${minute.padStart(2, "0")} PM`;

  switch (frequency) {
    case "daily":
      return `Every day at ${timeStr}`;
    case "weekly":
      const sortedDays = [...daysOfWeek].sort((a, b) => parseInt(a) - parseInt(b));
      const dayNames = sortedDays
        .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label)
        .filter(Boolean);

      if (dayNames.length === 0) return `Select days`;
      if (dayNames.length === 1) return `Every ${dayNames[0]} at ${timeStr}`;
      if (dayNames.length === 7) return `Every day at ${timeStr}`;

      // Check for weekdays (Mon-Fri)
      const weekdaySet = new Set(["1", "2", "3", "4", "5"]);
      if (sortedDays.length === 5 && sortedDays.every((d) => weekdaySet.has(d))) {
        return `Weekdays at ${timeStr}`;
      }

      // Check for weekends (Sat-Sun)
      const weekendSet = new Set(["0", "6"]);
      if (sortedDays.length === 2 && sortedDays.every((d) => weekendSet.has(d))) {
        return `Weekends at ${timeStr}`;
      }

      const lastDay = dayNames.pop();
      return `Every ${dayNames.join(", ")} & ${lastDay} at ${timeStr}`;
    case "monthly":
      return `On the ${dayOfMonth}${getOrdinalSuffix(parseInt(dayOfMonth))} of each month at ${timeStr}`;
  }
}