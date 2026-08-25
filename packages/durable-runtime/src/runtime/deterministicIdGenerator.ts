import { createHash } from "node:crypto"
import { monotonicFactory } from "ulid"

export type DeterministicIdNamespace = "hook" | "step" | "wait"

export type DeterministicIdGeneratorOptions = {
    readonly seed: string
    readonly timestamp: number
}

export type NextDeterministicIdParams = {
    readonly namespace: DeterministicIdNamespace
}

const maximumUlidTimestamp = 2 ** 48 - 1

export class DeterministicIdGenerator {
    private readonly generators = new Map<DeterministicIdNamespace, ReturnType<typeof monotonicFactory>>()

    constructor(private readonly options: DeterministicIdGeneratorOptions) {
        if (options.seed.length === 0) throw new TypeError("Deterministic ID seed cannot be empty")
        if (!Number.isSafeInteger(options.timestamp) || options.timestamp < 0 || options.timestamp > maximumUlidTimestamp) {
            throw new RangeError(`Deterministic ID timestamp must be an integer between 0 and ${maximumUlidTimestamp}`)
        }
    }

    next({ namespace }: NextDeterministicIdParams): string {
        let generate = this.generators.get(namespace)
        if (!generate) {
            generate = monotonicFactory(createDeterministicRandom(`${this.options.seed}\0${namespace}`))
            this.generators.set(namespace, generate)
        }

        return `${namespace}_${generate(this.options.timestamp)}`
    }
}

function createDeterministicRandom(seed: string): () => number {
    let counter = 0

    return () => {
        const value = createHash("sha256").update(seed).update("\0").update(counter.toString()).digest().readUInt32BE(0)
        counter += 1
        return value / 2 ** 32
    }
}
