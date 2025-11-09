import { Prisma } from '@prisma/client';
import { db } from '../prismaClient';

type JsonValue = Prisma.JsonValue;
type JsonInput = Prisma.InputJsonValue;

export interface CacheEntry<TPayload = JsonValue> {
  key: string;
  source: string;
  payload: TPayload;
  metadata?: JsonValue | null;
  expiresAt?: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

export interface CacheSetOptions<TPayload extends JsonValue> {
  key: string;
  source: string;
  payload: TPayload;
  ttlMs?: number;
  metadata?: JsonValue | null;
}

export interface CacheGetOrFetchOptions<TPayload extends JsonValue> {
  key: string;
  source: string;
  ttlMs?: number;
  metadata?: JsonValue | null;
  forceRefresh?: boolean;
  fetcher: () => Promise<TPayload>;
  skipCache?: boolean;
  allowStaleOnError?: boolean;
}

export interface CacheResult<TPayload> {
  data: TPayload;
  cacheHit: boolean;
  expiresAt?: Date | null;
}

function computeExpiry(ttlMs?: number): Date | null {
  if (!ttlMs || ttlMs <= 0) {
    return null;
  }
  return new Date(Date.now() + ttlMs);
}

function toJsonInput(value: JsonValue): JsonInput {
  return value as JsonInput;
}

function normalizeMetadata(
  metadata?: JsonValue | null,
): JsonInput | Prisma.NullableJsonNullValueInput | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  if (metadata === null) {
    return Prisma.JsonNull;
  }

  return metadata as JsonInput;
}

async function serializeAndStore<TPayload extends JsonValue>({
  key,
  source,
  payload,
  ttlMs,
  metadata,
}: CacheSetOptions<TPayload>) {
  const expiresAt = computeExpiry(ttlMs);
  const payloadJson = toJsonInput(payload);
  const metadataInput = normalizeMetadata(metadata);

  await db().cached_resources.upsert({
    where: { cache_key: key },
    create: {
      cache_key: key,
      source,
      payload: payloadJson,
      expires_at: expiresAt,
      ...(metadataInput !== undefined ? { metadata: metadataInput } : {}),
    },
    update: {
      payload: payloadJson,
      expires_at: expiresAt,
      source,
      ...(metadataInput !== undefined ? { metadata: metadataInput } : {}),
    },
  });

  return {
    data: payload,
    cacheHit: false,
    expiresAt,
  } satisfies CacheResult<TPayload>;
}

async function getEntry<TPayload extends JsonValue = JsonValue>(
  key: string,
): Promise<CacheEntry<TPayload> | null> {
  const record = await db().cached_resources.findUnique({
    where: { cache_key: key },
  });

  if (!record) {
    return null;
  }

  return {
    key: record.cache_key,
    source: record.source,
    payload: record.payload as TPayload,
    metadata: record.metadata,
    expiresAt: record.expires_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

async function invalidateEntry(key: string): Promise<void> {
  await db().cached_resources.deleteMany({
    where: { cache_key: key },
  });
}

async function invalidateSourceEntries(source: string): Promise<void> {
  await db().cached_resources.deleteMany({
    where: { source },
  });
}

async function cleanupExpiredEntries(limit: number): Promise<number> {
  const expired = await db().cached_resources.findMany({
    where: {
      expires_at: {
        not: null,
        lte: new Date(),
      },
    },
    select: { id: true },
    take: limit,
  });

  if (expired.length === 0) {
    return 0;
  }

  const idsToDelete = expired.map(({ id }) => id);

  await db().cached_resources.deleteMany({
    where: {
      id: {
        in: idsToDelete,
      },
    },
  });

  return expired.length;
}

async function getOrFetchEntry<TPayload extends JsonValue>({
  key,
  source,
  ttlMs,
  metadata,
  forceRefresh = false,
  fetcher,
  skipCache = false,
  allowStaleOnError = false,
}: CacheGetOrFetchOptions<TPayload>): Promise<CacheResult<TPayload>> {
  if (skipCache) {
    const freshData = await fetcher();
    return serializeAndStore({ key, source, payload: freshData, ttlMs, metadata });
  }

  const existing = await getEntry<TPayload>(key);
  const isExpired = existing?.expiresAt ? existing.expiresAt.getTime() <= Date.now() : false;

  if (!forceRefresh && existing && !isExpired) {
    return {
      data: existing.payload,
      cacheHit: true,
      expiresAt: existing.expiresAt ?? undefined,
    };
  }

  try {
    const freshData = await fetcher();
    return serializeAndStore({
      key,
      source,
      payload: freshData,
      ttlMs,
      metadata,
    });
  } catch (error) {
    if (allowStaleOnError && existing) {
      return {
        data: existing.payload,
        cacheHit: true,
        expiresAt: existing.expiresAt ?? undefined,
      };
    }
    throw error;
  }
}

export const cacheService = {
  get: getEntry,
  set: serializeAndStore,
  invalidate: invalidateEntry,
  invalidateSource: invalidateSourceEntries,
  getOrFetch: getOrFetchEntry,
  cleanupExpired(limit = 100) {
    return cleanupExpiredEntries(limit);
  },
};

export type CacheService = typeof cacheService;

