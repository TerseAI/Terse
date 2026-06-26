import { ModalClient, SandboxCreateParams, Volume } from "modal"

// A single shared volume holds every durable run's journal under a per-run
// subdirectory (`/terse-runs/<runId>`). A volume can only be mounted at sandbox
// creation and the journal is written from the start of a run, so every SDK
// sandbox mounts this volume up front; a suspended run resumes in a fresh
// sandbox that reads the same subdirectory.
export const JOURNAL_VOLUME_NAME = "terse-run-journals"
export const JOURNAL_VOLUME_MOUNT = "/terse-runs"

export function runJournalDir(runId: string): string {
    return `${JOURNAL_VOLUME_MOUNT}/${runId}`
}

let journalVolume: Promise<Volume> | null = null

function getJournalVolume(modal: ModalClient): Promise<Volume> {
    if (!journalVolume) {
        journalVolume = modal.volumes.fromName(JOURNAL_VOLUME_NAME, { createIfMissing: true })
    }
    return journalVolume
}

export async function withJournalVolume(modal: ModalClient, params: SandboxCreateParams | undefined): Promise<SandboxCreateParams> {
    const volume = await getJournalVolume(modal)
    return { ...params, volumes: { [JOURNAL_VOLUME_MOUNT]: volume, ...params?.volumes } }
}
