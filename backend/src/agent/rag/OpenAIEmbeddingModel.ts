import OpenAI from "openai";
import { EmbeddingModel } from "./RAG";


export class OpenAIEmbeddingModel implements EmbeddingModel {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = "text-embedding-3-small") {
        this.apiKey = apiKey;
        this.model = model;
    }

    async embed(text: string): Promise<number[]> {
        const response = await new OpenAI({ apiKey: this.apiKey }).embeddings.create({
            input: text,
            model: this.model,
        });
        return response.data[0].embedding ?? [];
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        const response = await new OpenAI({ apiKey: this.apiKey }).embeddings.create({
            input: texts,
            model: this.model,
        });
        return response.data.map((data: any) => data.embedding ?? []);
    }
}