/**
 * A single Redis instance is shared across all concerns (see settings.redis). Namespace each
 * concern's keys/channels so they never collide and can be inspected or flushed independently
 * (e.g. `redis-cli --scan --pattern 'terse:bull:*'`).
 */
const ROOT = "terse"

export const RedisNamespace = {
    /** BullMQ queue key prefix (Queue + Worker must share it). */
    bullmq: `${ROOT}:bull`,
    /** mqemitter RedisTaskQueue pub/sub channel prefix. */
    pubsub: `${ROOT}:tq`,
    /** Socket.IO Redis adapter key (web + worker must share it). */
    socketio: `${ROOT}:socketio`,
    /** Rate limiter + connection cap key prefix. */
    rateLimit: `${ROOT}:rl`
} as const
