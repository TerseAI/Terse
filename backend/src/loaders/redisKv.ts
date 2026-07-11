import { type RedisClientType, createClient } from "redis"

import logger from "../common/logger"
import { redis } from "../settings"

let clientPromise: Promise<RedisClientType> | null = null

export function getRedisKv(): Promise<RedisClientType> {
    if (!clientPromise) {
        // Reset on failure so the next caller retries instead of inheriting a rejected promise.
        clientPromise = connect().catch(error => {
            clientPromise = null
            throw error
        })
    }
    return clientPromise
}

async function connect(): Promise<RedisClientType> {
    const client = createClient({ url: redis.url }) as RedisClientType
    client.on("error", err => logger.error("KV Redis error", { err }))
    await client.connect()
    return client
}
