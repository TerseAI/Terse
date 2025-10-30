import { Request } from "express";

export type PageParams = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function parsePageParams(
  req: Request,
  defaultPageSize = 20,
  maxPageSize = 100
): PageParams {
  const page = Math.max(parseInt((req.query.page as string) ?? "1", 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt((req.query.pageSize as string) ?? String(defaultPageSize), 10) || defaultPageSize, 1),
    maxPageSize
  );
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  return { page, pageSize, skip, take };
}


