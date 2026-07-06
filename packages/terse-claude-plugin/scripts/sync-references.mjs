import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const canonical = join(packageRoot, "reference", "sdk-reference.md");

const targets = [
    join(packageRoot, "skills", "terse-create", "references", "sdk-reference.md"),
    join(packageRoot, "skills", "terse-improve", "references", "sdk-reference.md"),
];

for (const target of targets) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(canonical, target);
    console.log(`synced ${target}`);
}
