import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { db, PrismaClient } from "../prismaClient";
import type { GetRunHistoryParams, GetRunHistoryParamsRequest, GetRunHistoryResponse, RunHistoryRecord, RunHistoryStatus } from "../shared/RunHistoryTypes";
import { parsePageParams } from "../utility/pagination";
import { convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory } from "../utility/typeConverters";
import { ModelEvent } from "../shared/ModelEvents";
import logger from "../logger";


// Valid status values for validation
const VALID_STATUSES: RunHistoryStatus[] = ["success", "failed", "skipped", "in_progress", "awaiting_approval"];

export async function getRunHistory(req: Request, res: Response) {
  try {
    const prisma: PrismaClient = db();
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const organizationId = user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: "Organization context is required" });
    }

    const paramsRequest: GetRunHistoryParamsRequest = req.params as GetRunHistoryParamsRequest;

    const agentId = paramsRequest.agentId?.trim();
    if (!agentId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    // Verify agent belongs to user's organization
    const agent = await prisma.automations.findFirst({
      where: { id: agentId, organization_id: organizationId },
    });
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const params = parseGetRunHistoryParams(req.query);

    const { page, pageSize, skip, take } = parsePageParams(req, 20, 100);

    // Build Prisma where clause (database column is still automation_id)
    const where: Prisma.run_history_recordsWhereInput = { automation_id: agentId };

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
    const items: RunHistoryRecord[] = rows.map((runRecord: RunHistoryRecordWithActions) => {
      const actions = runRecord.actions.map((action) => ({
        action: action.action,
        integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(action.integration),
        target: action.target,
        details: action.details,
        url: action.url ?? undefined,
        step_id: action.step_id ?? undefined,
        type: action.type,
      }));

      return {
        id: runRecord.id,
        agentId: runRecord.automation_id, // Database column is automation_id, but API uses channelId
        timestamp: runRecord.timestamp.toISOString(),
        trigger: {
          event: runRecord.event,
          integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(runRecord.trigger_integration),
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
        actions,
        status: runRecord.status,
      };
    });

    const response: GetRunHistoryResponse = {
      items,
      page,
      pageSize,
      total,
    };

    res.json(response);
  } catch (err) {
    logger.error("Failed to fetch run history", { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, agentId: req.params.agentId });
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

    const user = req.session?.user;
    if (!user?.organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // req.params contains URL path parameters
    const runId = (req.params.runId as string | undefined)?.trim();
    if (!runId) {
      return res.status(400).json({ error: "runId is required" });
    }

    // Fetch the run record scoped to user's organization
    const runRecord = await prisma.run_history_records.findFirst({
      where: {
        id: runId,
        automation: { organization_id: user.organizationId },
      },
      select: {
        timestamp: true,
        updated_at: true,
        status: true,
      },
    });

    if (!runRecord) {
      return res.status(404).json({ error: "Run not found" });
    }

    // Fetch all chat events for this run, ordered by timestamp then id for deterministic ordering
    const chatEvents = await prisma.run_history_chat_events.findMany({
      where: {
        run_history_record_id: runId,
      },
      orderBy: [
        { timestamp: "asc" },
        { id: "asc" }, // Secondary sort by id for deterministic ordering when timestamps are equal
      ],
    });

    // Deserialize events directly from JSON, adding id and timestamp
    const events = chatEvents.map((event) => {
      const modelEvent = event.event_json as ModelEvent;
      return {
        ...modelEvent,
        id: event.id,
        timestamp: event.timestamp.toISOString(),
      };
    });

    res.json({ 
      events,
      startTimestamp: runRecord.timestamp.toISOString(),
      endTimestamp: runRecord.updated_at.toISOString(),
      status: runRecord.status,
    });
  } catch (err) {
    logger.error("Failed to fetch chat history", { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, runId: req.params.runId });
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
}

/**
 * Get run history actions by IDs
 * Route: GET /api/run-history/actions?ids=id1,id2
 */
export async function getRunHistoryActions(req: Request, res: Response) {
  try {
    const prisma: PrismaClient = db();

    const user = req.session?.user;
    if (!user?.organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get IDs from query params
    const idsParam = (req.query.ids as string | undefined)?.trim();
    if (!idsParam) {
      return res.status(400).json({ error: "ids query parameter is required" });
    }

    const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean);
    
    if (ids.length === 0) {
      return res.json([]);
    }

    // Fetch actions by IDs scoped to user's organization
    const actions = await prisma.run_history_actions.findMany({
      where: {
        id: { in: ids },
        run_history_record: {
          automation: { organization_id: user.organizationId },
        },
      },
    });

    // Transform to API format
    const result = actions.map(action => ({
      id: action.id,
      action: action.action,
      integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(action.integration),
      target: action.target,
      details: action.details,
      url: action.url ?? undefined,
      step_id: action.step_id ?? undefined,
    }));

    res.json(result);
  } catch (err) {
    logger.error("Failed to fetch run history actions", { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, ids: req.query.ids });
    res.status(500).json({ error: "Failed to fetch run history actions" });
  }
}
