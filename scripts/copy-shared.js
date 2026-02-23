const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'shared');

// Targets that use bundlers (Vite, etc.) — copy as-is
const bundlerTargets = [
  path.join(root, 'backend', 'src', 'shared'),
  path.join(root, 'frontend', 'src', 'shared'),
  path.join(root, 'packages', 'terse-cli', 'src', 'shared'),
];

// Targets that need Node ESM-compatible imports (.js extensions)
const esmTargets = [
  path.join(root, 'packages', 'terse-sdk', 'src', 'shared'),
];

/**
 * Rewrite relative imports in .ts files to include .js extensions,
 * so the compiled output works under Node's native ESM loader.
 */
function addJsExtensions(content) {
  return content.replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, (match, pre, specifier, post) => {
    if (specifier.endsWith('.js') || specifier.endsWith('.ts')) return match;
    return `${pre}${specifier}.js${post}`;
  });
}

for (const dest of bundlerTargets) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(srcDir, dest, { recursive: true });
}

for (const dest of esmTargets) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  // Copy all files, rewriting .ts imports for ESM compat
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(dest, file);
    if (file.endsWith('.ts')) {
      const content = fs.readFileSync(srcFile, 'utf-8');
      fs.writeFileSync(destFile, addJsExtensions(content));
    } else {
      fs.cpSync(srcFile, destFile, { recursive: true });
    }
  }
}

console.log('Copied shared folder to backend/src/shared, frontend/src/shared, packages/terse-sdk/src/shared, and packages/terse-cli/src/shared');
