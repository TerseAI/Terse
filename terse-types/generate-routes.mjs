import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function readJson(filename) {
    const filePath = path.join(__dirname, filename)
    const contents = await readFile(filePath, "utf8")
    return JSON.parse(contents)
}

async function writeGeneratedTs(filename, exportName, value, sourceFilename) {
    const outputPath = path.join(__dirname, filename)
    const contents = `// This file is generated from ${sourceFilename}. Do not edit directly.\n\nexport const ${exportName} = ${JSON.stringify(value, null, 4)} as const\n`
    await writeFile(outputPath, contents)
}

const apiRoutes = await readJson("ApiRoutes.json")
const frontendRoutes = await readJson("FrontendRoutes.json")

await writeGeneratedTs("ApiRoutes.generated.ts", "ApiRoutes", apiRoutes, "ApiRoutes.json")
await writeGeneratedTs("FrontendRoutes.generated.ts", "FrontendRoutes", frontendRoutes, "FrontendRoutes.json")
