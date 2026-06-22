export interface VolumeFileEntry {
    path: string
    isDirectory: boolean
    sizeBytes: number
}

export interface AgentVolumeStore {
    read(volumeName: string, relativePath: string): Promise<string>
    write(volumeName: string, relativePath: string, content: string): Promise<void>
    list(volumeName: string, relativePath: string): Promise<VolumeFileEntry[]>
    exists(volumeName: string, relativePath: string): Promise<boolean>
    stat(volumeName: string, relativePath: string): Promise<VolumeFileEntry>
    deletePath(volumeName: string, relativePath: string): Promise<void>
    rename(volumeName: string, fromPath: string, toPath: string): Promise<void>
}
