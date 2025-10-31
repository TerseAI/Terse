export function buildSearchTsQuery(q: string): { tokens: string[]; ts: string } {
  const tokens = (q.match(/[a-zA-Z0-9]+/g) || []).map((t) => t.toLowerCase());
  const ts = tokens.length > 0 ? tokens.map((t) => `${t}:*`).join(" & ") : "";
  return { tokens, ts };
}


