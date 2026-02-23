const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'shared');
const targets = [
  path.join(root, 'backend', 'src', 'shared'),
  path.join(root, 'frontend', 'src', 'shared'),
  path.join(root, 'packages', 'terse-sdk', 'src', 'shared'),
  path.join(root, 'packages', 'terse-cli', 'src', 'shared'),
];

for (const dest of targets) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(srcDir, dest, { recursive: true });
}

console.log('Copied shared folder to backend/src/shared, frontend/src/shared, packages/terse-sdk/src/shared, and packages/terse-cli/src/shared');
