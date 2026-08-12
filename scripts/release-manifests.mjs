import { dirname, join } from "node:path";

// Every file that carries the repo-wide release version. A release publishes
// nothing unless all of them agree with the tag.
export const RELEASE_MANIFESTS = [
    { path: "terse-types/package.json", read: json => json.version, write: (json, version) => (json.version = version) },
    { path: "packages/terse-sdk/package.json", read: json => json.version, write: (json, version) => (json.version = version) },
    { path: "packages/terse-cli/package.json", read: json => json.version, write: (json, version) => (json.version = version) },
    { path: "packages/create-terse/package.json", read: json => json.version, write: (json, version) => (json.version = version) },
    { path: "packages/terse-claude-plugin/.claude-plugin/plugin.json", read: json => json.version, write: (json, version) => (json.version = version) },
    {
        path: ".claude-plugin/marketplace.json",
        read: json => json.plugins.find(plugin => plugin.name === "terse")?.version,
        write: (json, version) => {
            const plugin = json.plugins.find(entry => entry.name === "terse");
            if (plugin === undefined) throw new Error("marketplace.json has no plugin named 'terse'");
            plugin.version = version;
        }
    }
];

export const NPM_PACKAGES = ["terse-types", "terse-sdk", "terse-cli", "create-terse"];

export function repoRoot(scriptsDir) {
    return dirname(scriptsDir);
}

export function parseVersion(value) {
    if (!/^\d+\.\d+\.\d+$/.test(value ?? "")) {
        throw new Error(`Version must look like 1.2.3 (got '${value}')`);
    }
    return value;
}
