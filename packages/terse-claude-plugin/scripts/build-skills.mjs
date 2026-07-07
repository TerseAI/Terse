import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const partialsDir = join(packageRoot, "reference");
const templatesDir = join(packageRoot, "templates");
const skillsDir = join(packageRoot, "skills");

const partials = new Map(
    readdirSync(partialsDir)
        .filter(file => file.endsWith(".md"))
        .map(file => [basename(file, ".md"), readFileSync(join(partialsDir, file), "utf8").trimEnd()])
);

for (const file of readdirSync(templatesDir)) {
    if (!file.endsWith(".md.hbs")) continue;
    const skillName = basename(file, ".md.hbs");
    const template = readFileSync(join(templatesDir, file), "utf8");
    writeFileSync(join(skillsDir, skillName, "SKILL.md"), render(template, file));
    console.log(`built skills/${skillName}/SKILL.md`);
}

function render(template, templateFile) {
    const banner = `<!-- Generated from templates/${templateFile} by scripts/build-skills.mjs. Edit the template, not this file. -->`;
    const expanded = template.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
        const partial = partials.get(name);
        if (partial === undefined) {
            throw new Error(`Unknown partial "${name}"; expected one of: ${[...partials.keys()].join(", ")}`);
        }
        return partial;
    });
    return insertGeneratedBanner(expanded, banner);
}

function insertGeneratedBanner(rendered, banner) {
    const frontmatterEnd = rendered.indexOf("\n---\n", rendered.startsWith("---\n") ? 4 : 0);
    if (frontmatterEnd === -1) return `${banner}\n${rendered}`;
    const bodyStart = frontmatterEnd + "\n---\n".length;
    return `${rendered.slice(0, bodyStart)}\n${banner}\n${rendered.slice(bodyStart)}`;
}
