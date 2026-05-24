export class MissingIntegrationOptionsError extends Error {
    constructor(
        public integration: string,
        public missingFields: string[]
    ) {
        super(`Integration '${integration}' requires option(s): ${missingFields.join(", ")}`)
        this.name = "MissingIntegrationOptionsError"
    }
}
