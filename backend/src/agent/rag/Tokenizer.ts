
export interface Tokenizer {
    tokenize(text: string): number[];
    detokenize(tokens: number[]): string;
}