import { EmbeddingError, EmbeddingProvider } from "./search"

export class EmbeddingSystem implements EmbeddingProvider {
    private apiKey: string
    private model: string
    private dim: number
    private maxRetries: number

    constructor(apiKey: string) {
        this.apiKey = apiKey
        this.model = "text-embedding-3-small" // 1536 dimensions, cheaper
        this.dim = 1536
        this.maxRetries = 3
    }

    static withLargeModel(apiKey: string): EmbeddingSystem {
        const provider = new EmbeddingSystem(apiKey)
        provider.model = "text-embedding-3-large" // 3072 dimensions, better quality
        provider.dim = 3072
        return provider
    }

    withCustomDimensions(dimensions: number): EmbeddingSystem {
        if (dimensions > this.dim) {
            throw new Error("Cannot exceed model's max dimensions")
        }
        this.dim = dimensions
        return this
    }

    private async makeRequest(input: string | string[]): Promise<any> {
        const request = {
            input,
            model: this.model,
            dimensions: this.dimensions
        }

        let retries = 0
        while (true) {
            try {
                const response = await fetch("https://api.openai.com/v1/embeddings", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(request)
                })

                if (response.ok) {
                    return await response.json()
                } else if (response.status === 429) {
                    // TOO_MANY_REQUESTS
                    if (retries >= this.maxRetries) {
                        throw new EmbeddingError("Rate limited, retries exhausted")
                    }
                    retries++
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)))
                } else {
                    const errorText = await response.text()
                    throw new EmbeddingError(`Status ${response.status}: ${errorText}`)
                }
            } catch (error) {
                if (error instanceof EmbeddingError) {
                    throw error
                }
                throw new EmbeddingError("HTTP request failed", error as Error)
            }
        }
    }

    async embed(text: string): Promise<number[]> {
        const response = await this.makeRequest(text)

        const embedding = response.data?.[0]?.embedding
        if (!embedding) {
            throw new EmbeddingError("Invalid response format")
        }

        return embedding
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) {
            return []
        }

        // OpenAI has a limit of ~8000 tokens per request, so batch in chunks
        const BATCH_SIZE = 100
        const allEmbeddings: number[][] = []

        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const chunk = texts.slice(i, i + BATCH_SIZE)
            const response = await this.makeRequest(chunk)

            // Sort by index to maintain order
            const embeddings = response.data.sort((a: any, b: any) => a.index - b.index).map((data: any) => data.embedding)

            allEmbeddings.push(...embeddings)
        }

        return allEmbeddings
    }

    dimensions(): number {
        return this.dim
    }

    modelName(): string {
        return this.model
    }
}
