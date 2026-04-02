// const fs = require('fs');
// const path = require('path');

// const root = path.resolve(__dirname, '..');
// const srcDir = path.join(root, 'shared');

// // Targets that use bundlers (Vite, etc.) — copy as-is
// const bundlerTargets = [
//   path.join(root, 'backend', 'src', 'shared'),
//   path.join(root, 'frontend', 'src', 'shared'),
//   path.join(root, 'packages', 'terse-cli', 'src', 'shared'),
// ];

// // Targets that need Node ESM-compatible imports (.js extensions)
// const esmTargets = [
//   path.join(root, 'packages', 'terse-sdk', 'src', 'shared'),
// ];

// const sharedSourceFiles = fs
//   .readdirSync(srcDir, { withFileTypes: true })
//   .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
//   .map(entry => entry.name);

// /**
//  * Rewrite relative imports in .ts files to include .js extensions,
//  * so the compiled output works under Node's native ESM loader.
//  */
// function addJsExtensions(content) {
//   return content.replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, (match, pre, specifier, post) => {
//     if (specifier.endsWith('.js') || specifier.endsWith('.ts')) return match;
//     return `${pre}${specifier}.js${post}`;
//   });
// }

// for (const dest of bundlerTargets) {
//   fs.rmSync(dest, { recursive: true, force: true });
//   fs.mkdirSync(dest, { recursive: true });
//   for (const file of sharedSourceFiles) {
//     fs.copyFileSync(path.join(srcDir, file), path.join(dest, file));
//   }
// }

// for (const dest of esmTargets) {
//   fs.rmSync(dest, { recursive: true, force: true });
//   fs.mkdirSync(dest, { recursive: true });
//   // Copy all files, rewriting .ts imports for ESM compat
//   for (const file of sharedSourceFiles) {
//     const srcFile = path.join(srcDir, file);
//     const destFile = path.join(dest, file);
//     const content = fs.readFileSync(srcFile, 'utf-8');
//     fs.writeFileSync(destFile, addJsExtensions(content));
//   }
// }



// console.log(
//   'Copied shared source files to backend/src/shared, frontend/src/shared, packages/terse-sdk/src/shared, packages/terse-cli/src/shared'
// );
