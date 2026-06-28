export interface VolumeDirEntry {
    name: string
    isDirectory: boolean
    sizeBytes: number
}

export interface VolumeFs {
    list(dirPath: string): Promise<VolumeDirEntry[]>
    read(filePath: string): Promise<string | null>
    write(filePath: string, content: string): Promise<void>
    stat(path: string): Promise<{ isDirectory: boolean; sizeBytes: number } | null>
    remove(path: string): Promise<void>
    rename(fromPath: string, toPath: string): Promise<void>
    mkdirp(dirPath: string): Promise<void>
    sync(): Promise<void>
    /** Release any resources (e.g. an ephemeral sandbox spun up to reach the volume). No-op when attached to a live sandbox. */
    dispose(): Promise<void>
}
