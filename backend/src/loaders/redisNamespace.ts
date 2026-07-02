const ROOT = "terse"

export const RedisNamespace = {
    pubsub: `${ROOT}:tq`,
    socketio: `${ROOT}:socketio`,
    rateLimit: `${ROOT}:rl`
} as const
