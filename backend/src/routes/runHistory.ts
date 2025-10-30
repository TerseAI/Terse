import { Request, Response } from "express";
import { db } from "../prismaClient";
import { Prisma } from "@prisma/client";
import type { RunHistoryRecord } from "../shared/RunHistoryTypes";

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

    const page = Math.max(parseInt((req.query.page as string) ?? "1", 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(parseInt((req.query.pageSize as string) ?? "20", 10) || 20, 1),
      100
    );
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: any = { automation_id: automationId };

    if (start || end) {
      where.timestamp = {};
      if (start) (where.timestamp as any).gte = start;
      if (end) (where.timestamp as any).lte = end;
    }

    if (statusList.length > 0) {
      where.status = { in: statusList };
    }
    // If there's a search query, use FTS with indexed vectors for performance.
    // Otherwise use standard filtering.
    let rows: any[] = [];
    let total = 0;

    if (q) {
      const statusSql = (statusList?.length ?? 0) > 0
        ? Prisma.sql`AND r.status::text IN (${Prisma.join(statusList as any)})`
        : Prisma.sql``;

      const startSql = start ? Prisma.sql`AND r.timestamp >= ${start}` : Prisma.sql``;
      const endSql = end ? Prisma.sql`AND r.timestamp <= ${end}` : Prisma.sql``;

      // Build a prefix-matching tsquery like 'foo:* & bar:*'
      const tokens = (q.match(/[a-zA-Z0-9]+/g) || []).map(t => t.toLowerCase());
      const ts = tokens.length > 0 ? tokens.map(t => `${t}:*`).join(' & ') : '';

      const ids = await prisma.$queryRaw(Prisma.sql`
        SELECT r.id
        FROM run_history_records r
        WHERE r.automation_id = ${automationId}
          ${startSql}
          ${endSql}
          ${statusSql}
          AND (
            ${ts !== ''
              ? Prisma.sql`r.search_fts @@ to_tsquery('simple', ${ts})`
              : Prisma.sql`r.search_fts @@ plainto_tsquery('simple', ${q})`}
            OR EXISTS (
              SELECT 1 FROM run_history_actions a
              WHERE a.run_history_record_id = r.id
                AND ${ts !== ''
                  ? Prisma.sql`a.search_fts @@ to_tsquery('simple', ${ts})`
                  : Prisma.sql`a.search_fts @@ plainto_tsquery('simple', ${q})`}
            )
          )
        ORDER BY r.timestamp DESC
        OFFSET ${skip} LIMIT ${take}
      `) as Array<{ id: string }>;

      const idList = ids.map((r: { id: string }) => r.id);

      // total count with same filters
      const countRes = await prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::bigint as count
        FROM run_history_records r
        WHERE r.automation_id = ${automationId}
          ${startSql}
          ${endSql}
          ${statusSql}
          AND (
            ${ts !== ''
              ? Prisma.sql`r.search_fts @@ to_tsquery('simple', ${ts})`
              : Prisma.sql`r.search_fts @@ plainto_tsquery('simple', ${q})`}
            OR EXISTS (
              SELECT 1 FROM run_history_actions a
              WHERE a.run_history_record_id = r.id
                AND ${ts !== ''
                  ? Prisma.sql`a.search_fts @@ to_tsquery('simple', ${ts})`
                  : Prisma.sql`a.search_fts @@ plainto_tsquery('simple', ${q})`}
            )
          )
      `) as Array<{ count: bigint }>;
      total = Number((countRes[0] as any)?.count ?? 0);

      rows = idList.length
        ? await prisma.run_history_records.findMany({
            where: { id: { in: idList } },
            include: { actions: true },
            orderBy: { timestamp: "desc" },
          })
        : [];
    } else {
      const [c, r] = await prisma.$transaction([
        prisma.run_history_records.count({ where }),
        prisma.run_history_records.findMany({
          where,
          orderBy: { timestamp: "desc" },
          include: { actions: true },
          skip,
          take,
        }),
      ]);
      total = c;
      rows = r;
    }

    const items: RunHistoryRecord[] = rows.map((r: any) => ({
      id: r.id,
      automationId: r.automation_id,
      timestamp: r.timestamp.toISOString(),
      trigger: {
        type: r.trigger_type,
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
        type: a.type,
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


