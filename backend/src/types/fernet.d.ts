declare module "fernet" {
    export class Secret {
        constructor(base64Key: string)
    }
    export class Token {
        constructor(opts: { secret: Secret; token?: string; ttl?: number; time?: Date; iv?: number[] })
        encode(plaintext: string): string
        decode(): string
    }
}
