import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { EmbeddingModel, RAG, SearchOptions, SearchResult } from "./RAG";
import { settings } from "../../config/settings";
import { OpenAIEmbeddingModel } from "./OpenAIEmbeddingModel";


const tpuf = new Turbopuffer({
    apiKey: settings.turbopuffer.apiKey,
    region: "aws-us-west-2"
});

export class TurboPufferRAG implements RAG {
    embeddingModel: EmbeddingModel;

    constructor(embeddingModel: EmbeddingModel = new OpenAIEmbeddingModel(process.env.OPENAI_API_KEY!)) {
        this.embeddingModel = embeddingModel;
    }

    async search(namespace: string, query: string, options: SearchOptions): Promise<SearchResult[]> {
        const ns = tpuf.namespace(namespace)
        return []
    }

    async embed(namespace: string, text: string, id: string): Promise<void> {
        const ns = tpuf.namespace(namespace)
        const vector = await this.embeddingModel.embed(text)

        await ns.write({
            upsert_rows: [
                {id, vector}
            ]
        })
    }

    async embedBatch(namespace: string, texts: string[], ids: string[]): Promise<void> {
        const ns = tpuf.namespace(namespace)
        const vectors = await this.embeddingModel.embedBatch(texts)

        await ns.write({
            upsert_rows: vectors.map((vector, index) => ({id: ids[index], vector}))
        })
    }
}


