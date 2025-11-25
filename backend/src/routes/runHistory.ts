import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { db, PrismaClient } from "../prismaClient";
import type { GetRunHistoryParams, GetRunHistoryResponse, RunHistoryRecord, RunHistoryStatus } from "../shared/RunHistoryTypes";
import { parsePageParams } from "../utility/pagination";
import { IntegrationType } from "../shared/Integrations";
import { convertRunHistoryIntegrationToIntegrationType } from "../utility/typeConverters";
import { ModelEvent } from "../shared/ModelEvents";

// Valid status values for validation
const VALID_STATUSES: RunHistoryStatus[] = ["success", "failed", "skipped", "in_progress"];

export async function getRunHistory(req: Request, res: Response) {
  try {
    const prisma: PrismaClient = db();

    // req.params contains URL path parameters (e.g., /run-history/:channelId)
    const channelId = (req.params.channelId as string | undefined)?.trim();
    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    const params = parseGetRunHistoryParams(req.query);

    const { page, pageSize, skip, take } = parsePageParams(req, 20, 100);

    // Build Prisma where clause (database column is still automation_id)
    const where: Prisma.run_history_recordsWhereInput = { automation_id: channelId };

    if (params.start || params.end) {
      const startDate = parseDate(params.start);
      const endDate = parseDate(params.end);
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = startDate;
        if (endDate) where.timestamp.lte = endDate;
      }
    }

    if (params.status && params.status.length > 0) {
      where.status = { in: params.status };
    }

    if (params.q) {
      // Search across multiple relevant fields
      where.OR = [
        { trigger_title: { contains: params.q, mode: "insensitive" } },
        { event: { contains: params.q, mode: "insensitive" } },
        { trigger_source: { contains: params.q, mode: "insensitive" } },
        { decision_reason: { contains: params.q, mode: "insensitive" } },
      ];
    }

    type RunHistoryRecordWithActions = Prisma.run_history_recordsGetPayload<{
      include: { actions: true };
    }>;

    const [total, rows] = await prisma.$transaction([
      prisma.run_history_records.count({ where }),
      prisma.run_history_records.findMany({
        where,
        orderBy: { timestamp: "desc" },
        include: { actions: true },
        skip,
        take,
      }),
    ]);

    // Transform Prisma rows (snake_case) to API format (camelCase)
    const items: RunHistoryRecord[] = rows.map((runRecord: RunHistoryRecordWithActions) => ({
      id: runRecord.id,
      channelId: runRecord.automation_id, // Database column is automation_id, but API uses channelId
      timestamp: runRecord.timestamp.toISOString(),
      trigger: {
        event: runRecord.event,
        integration: convertRunHistoryIntegrationToIntegrationType(runRecord.trigger_integration),
        source: runRecord.trigger_source,
        title: runRecord.trigger_title ?? undefined,
        subheader: runRecord.trigger_subheader ?? undefined,
        url: runRecord.trigger_url ?? undefined,
      },
      filtered: runRecord.filtered,
      decision: {
        action: runRecord.decision_action,
        reasoning: runRecord.decision_reason,
      },
      actions: runRecord.actions.map((action) => ({
        action: action.action,
        integration: convertRunHistoryIntegrationToIntegrationType(action.integration),
        target: action.target,
        details: action.details,
        url: action.url ?? undefined,
      })),
      status: runRecord.status as RunHistoryStatus,
    }));

    const response: GetRunHistoryResponse = {
      items,
      page,
      pageSize,
      total,
    };

    res.json(response);
  } catch (err) {
    console.error("Failed to fetch run history", err);
    res.status(500).json({ error: "Failed to fetch run history" });
  }
}

// MARK: - Helper functions
function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function parseStatusArray(statusParam?: string): RunHistoryStatus[] | undefined {
  if (!statusParam?.trim()) return undefined;

  const statusList = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s): s is RunHistoryStatus => VALID_STATUSES.includes(s as RunHistoryStatus));

  return statusList.length > 0 ? statusList : undefined;
}

/**
 * Validates and parses req.query into GetRunHistoryParams
 */
function parseGetRunHistoryParams(query: Request["query"]): GetRunHistoryParams {
  const params: GetRunHistoryParams = {};

  if (query.q) {
    const q = String(query.q).trim();
    if (q) params.q = q;
  }

  if (query.start) {
    const start = String(query.start).trim();
    if (start) params.start = start;
  }

  if (query.end) {
    const end = String(query.end).trim();
    if (end) params.end = end;
  }

  if (query.status) {
    const status = parseStatusArray(String(query.status));
    if (status) params.status = status;
  }

  if (query.page) {
    const page = parseInt(String(query.page), 10);
    if (!isNaN(page) && page > 0) params.page = page;
  }

  if (query.pageSize) {
    const pageSize = parseInt(String(query.pageSize), 10);
    if (!isNaN(pageSize) && pageSize > 0) params.pageSize = pageSize;
  }

  return params;
}

/**
 * Get chat history for a specific run
 * Route: GET /api/run-history/:runId/chat
 */
export async function getChatHistory(req: Request, res: Response) {
  try {
    const prisma: PrismaClient = db();

    // req.params contains URL path parameters
    const runId = (req.params.runId as string | undefined)?.trim();
    if (!runId) {
      return res.status(400).json({ error: "runId is required" });
    }

    // Fetch the run record to get start/end timestamps
    const runRecord = await prisma.run_history_records.findUnique({
      where: { id: runId },
      select: {
        timestamp: true,
        updated_at: true,
        status: true,
      },
    });

    if (!runRecord) {
      return res.status(404).json({ error: "Run not found" });
    }

    // Fetch all chat events for this run, ordered by timestamp
    const chatEvents = await prisma.run_history_chat_events.findMany({
      where: {
        run_history_record_id: runId,
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    // Transform database format back to ModelEvent format with timestamps
    const events = chatEvents.map((event) => {
      const eventData = event.event_data as any;
      
      // Reconstruct the ModelEvent based on event_type, including timestamp and ID
      const baseEvent = {
        id: event.id,
        timestamp: event.timestamp.toISOString(),
      };
      
      switch (event.event_type) {
        case "TextDelta":
          return {
            ...baseEvent,
            type: "TextDelta",
            delta: eventData.delta,
            step_id: eventData.step_id,
          };
        
        case "ToolCall":
          return {
            ...baseEvent,
            type: "ToolCall",
            summary: eventData.summary,
            step_id: eventData.step_id,
            parameters: eventData.parameters,
          };
        
        case "ToolCallComplete":
          return {
            ...baseEvent,
            type: "ToolCallComplete",
            tool_name: eventData.tool_name,
            status: eventData.status,
            step_id: eventData.step_id,
            changed_items: eventData.changed_items || [],
          };
        
        case "ToolApprovalRequest":
          return {
            ...baseEvent,
            type: "ToolApprovalRequest",
            step_id: eventData.step_id,
            name: eventData.name,
            arguments: eventData.arguments,
          };
        
        case "Failure":
          return {
            ...baseEvent,
            type: "Failure",
            error: eventData.error,
          };
        
        case "NaturalStop":
          return {
            ...baseEvent,
            type: "NaturalStop",
          };
        
        case "FilterResult":
          return {
            ...baseEvent,
            type: "FilterResult",
            isRelevant: eventData.isRelevant,
            reason: eventData.reason,
            confidence: eventData.confidence,
          };
        
        default:
          // Unknown event type, return as-is with timestamp
          return {
            ...baseEvent,
            ...eventData,
          };
      }
    });

    res.json({ 
      events,
      startTimestamp: runRecord.timestamp.toISOString(),
      endTimestamp: runRecord.updated_at.toISOString(),
      status: runRecord.status,
    });
  } catch (err) {
    console.error("Failed to fetch chat history", err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
}
