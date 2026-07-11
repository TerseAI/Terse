const ROOT = "terse"

export const RedisNamespace = {
    pubsub: `${ROOT}:tq`,
    socketio: `${ROOT}:socketio`,
    rateLimit: `${ROOT}:rl`,
    inputResponses: `${ROOT}:inputres`
} as const
