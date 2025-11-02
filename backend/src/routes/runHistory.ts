import { Request, Response } from "express";
import { db } from "../prismaClient";
import type { RunHistoryRecord } from "../shared/RunHistoryTypes";
import { parsePageParams } from "../utility/pagination";

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function getRunHistory(req: Request, res: Response) {
  try {
    const prisma = db() as any;

    const automationId = (req.params.automationId as string | undefined)?.trim();
    if (!automationId) {
      return res.status(400).json({ error: "automationId is required" });
    }

    const q = (req.query.q as string | undefined)?.trim();
    const start = parseDate(req.query.start as string | undefined);
    const end = parseDate(req.query.end as string | undefined);

    const statusParam = (req.query.status as string | undefined)?.trim();
    const statusList = statusParam
      ? statusParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const { page, pageSize, skip, take } = parsePageParams(req, 20, 100);

    const where: any = { automation_id: automationId };

    if (start || end) {
      where.timestamp = {};
      if (start) (where.timestamp as any).gte = start;
      if (end) (where.timestamp as any).lte = end;
    }

    if (statusList.length > 0) {
      where.status = { in: statusList };
    }

    if (q) {
      where.title = { contains: q, mode: "insensitive" };
    }

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

    const items: RunHistoryRecord[] = rows.map((r: any) => ({
      id: r.id,
      automationId: r.automation_id,
      timestamp: r.timestamp.toISOString(),
      trigger: {
        event: r.event,
        integration: r.trigger_integration,
        source: r.trigger_source,
        title: r.trigger_title ?? undefined,
        subheader: r.trigger_subheader ?? undefined,
        url: r.trigger_url ?? undefined,
      },
      filtered: r.filtered,
      decision: {
        action: r.decision_action,
        reasoning: r.decision_reason,
      },
      actions: (r.actions ?? []).map((a: any) => ({
        action: a.action,
        integration: a.integration,
        target: a.target,
        details: a.details,
        url: a.url ?? undefined,
      })),
      status: r.status,
    }));

    res.json({
      items,
      page,
      pageSize,
      total,
    });
  } catch (err) {
    console.error("Failed to fetch run history", err);
    res.status(500).json({ error: "Failed to fetch run history" });
  }
}


