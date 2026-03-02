declare module "@google-cloud/storage" {
    export class Storage {
        constructor(options?: { projectId?: string; keyFilename?: string; credentials?: Record<string, unknown> })
        bucket(name: string): Bucket
    }
    export interface FileMetadata {
        contentType?: string
        size?: number | string
        metadata?: { originalFilename?: string }
    }
    export class File {
        constructor(bucket: Bucket, name: string)
        save(data: Buffer | string, options?: unknown): Promise<void>
        getSignedUrl(options: unknown): Promise<[string]>
        delete(): Promise<unknown[]>
        exists(): Promise<[boolean]>
        getMetadata(): Promise<[FileMetadata]>
        download(options?: unknown): Promise<[Buffer]>
    }
    export class Bucket {
        file(name: string): File
        upload(path: string, options?: { destination?: string; metadata?: unknown }): Promise<[File]>
    }
}
