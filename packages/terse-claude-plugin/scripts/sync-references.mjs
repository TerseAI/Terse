import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalFiles = ["sdk-reference.md", "code-conventions.md"];
const skillNames = ["terse-create", "terse-improve"];

for (const file of canonicalFiles) {
    const canonical = join(packageRoot, "reference", file);
    for (const skill of skillNames) {
        const target = join(packageRoot, "skills", skill, "references", file);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(canonical, target);
        console.log(`synced ${target}`);
    }
}
