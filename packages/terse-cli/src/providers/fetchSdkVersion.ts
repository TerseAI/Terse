const FALLBACK_VERSION = "0.1.11"

async function fetchNpmSdkVersion(): Promise<string> {
    const res = await fetch("https://registry.npmjs.org/terse-sdk/latest")
    if (!res.ok) throw new Error(`npm registry returned ${res.status}`)
    const data = (await res.json()) as { version: string }
    return data.version
}

async function fetchPypiSdkVersion(): Promise<string> {
    const res = await fetch("https://pypi.org/pypi/terse-sdk/json")
    if (!res.ok) throw new Error(`PyPI returned ${res.status}`)
    const data = (await res.json()) as { info: { version: string } }
    return data.info.version
}

export async function fetchSdkVersion(language: "typescript"): Promise<string> {
    try {
        return language === "typescript" ? await fetchNpmSdkVersion() : await fetchPypiSdkVersion()
    } catch {
        return FALLBACK_VERSION
    }
}
