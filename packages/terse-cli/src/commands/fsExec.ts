import { isMemoryFsTool, runMemoryFsCommand } from "terse-sdk"

/**
 * Hidden subcommand invoked by the backend (Path A reach-back) via `sb.exec` to run a
 * memory/filesystem command against the sandbox's co-located volume. The payload is a
 * base64-encoded JSON `{ tool, input }`. The only thing written to stdout is a single JSON
 * envelope so the backend can parse it; everything diagnostic goes to stderr.
 */
export async function fsExec(payload?: string): Promise<void> {
    let request: { tool: string; input: unknown }
    try {
        const raw = payload ? Buffer.from(payload, "base64").toString("utf8") : await readStdin()
        request = JSON.parse(raw) as { tool: string; input: unknown }
    } catch (error) {
        emit({ success: false, error: `Invalid __fs-exec payload: ${messageOf(error)}` })
        process.exitCode = 1
        return
    }

    if (!isMemoryFsTool(request.tool)) {
        emit({ success: false, error: `Unknown memory/fs tool: ${request.tool}` })
        process.exitCode = 1
        return
    }

    try {
        const result = await runMemoryFsCommand({ tool: request.tool, input: request.input as never })
        emit({ success: true, result })
    } catch (error) {
        emit({ success: false, error: messageOf(error) })
        process.exitCode = 1
    }
}

function emit(envelope: { success: true; result: unknown } | { success: false; error: string }): void {
    process.stdout.write(JSON.stringify(envelope))
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer)
    }
    return Buffer.concat(chunks).toString("utf8")
}
