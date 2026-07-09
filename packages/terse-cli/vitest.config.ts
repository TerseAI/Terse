import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const packageRoot = path.dirname(fileURLToPath(import.meta.url))

// Alias workspace packages to their sources so tests run without a prior build.
export default defineConfig({
    resolve: {
        alias: {
            "terse-types": path.resolve(packageRoot, "../../terse-types/index.ts"),
            "terse-sdk": path.resolve(packageRoot, "../terse-sdk/src/index.ts")
        }
    },
    test: {
        include: ["test/**/*.test.ts"],
        testTimeout: 60_000
    }
})
