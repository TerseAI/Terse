import type { EventEmitter } from "node:events"

// `state` (the connection-status emitter) exists at runtime but is missing from upstream types.
declare module "mqemitter-redis" {
    interface MQEmitterRedis {
        state: EventEmitter
    }
}
