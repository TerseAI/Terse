const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'shared');
const targets = [
  path.join(root, 'backend', 'src', 'shared'),
  path.join(root, 'frontend', 'src', 'shared'),
];

for (const dest of targets) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(srcDir, dest, { recursive: true });
}

console.log('Copied shared folder to backend/src/shared and frontend/src/shared');
