import { useMemo } from "react";
import { CronBuilder, getCronText } from "@vpfaiz/cron-builder-ui";
import "@vpfaiz/cron-builder-ui/styles/globals.css";
import { parseExpression } from "cron-parser";
import { cn } from "@/lib/utils";
import { Clock, AlertCircle } from "lucide-react";

interface ScheduleEditorProps {
  value: string;
  onChange: (cronExpression: string) => void;
  className?: string;
}

export function ScheduleEditor({
  value,
  onChange,
  className,
}: ScheduleEditorProps) {
  // Parse the current cron expression for display
  const { humanReadable, nextRuns, error } = useMemo(() => {
    if (!value) {
      return { humanReadable: null, nextRuns: [], error: null };
    }

    try {
      const human = getCronText(value);
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

  return (
    <div className={cn("space-y-4", className)}>
      <CronBuilder
        defaultValue={value || "0 9 * * *"}
        onChange={onChange}
      />

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

// Re-export utility functions
export { getCronText } from "@vpfaiz/cron-builder-ui";

export function isValidCronExpression(expression: string): boolean {
  try {
    parseExpression(expression);
    return true;
  } catch {
    return false;
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
