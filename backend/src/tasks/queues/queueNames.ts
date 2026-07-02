export const QueueName = {
    Schedule: "schedule",
    SdkRunExecution: "sdk-run-execution"
} as const

export type QueueName = (typeof QueueName)[keyof typeof QueueName]
