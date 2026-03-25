#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const cliPyprojectPath = path.join(root, 'packages', 'terse-python-cli', 'pyproject.toml');
const sdkPyprojectPath = path.join(root, 'packages', 'terse-python-sdk', 'pyproject.toml');
const cliInitPath = path.join(root, 'packages', 'terse-python-cli', 'src', 'terse_cli', '__init__.py');
const sdkInitPath = path.join(root, 'packages', 'terse-python-sdk', 'src', 'terse_sdk', '__init__.py');
const cliProjectPath = path.join(root, 'packages', 'terse-python-cli', 'src', 'terse_cli', '_project.py');
const cliInitGenerateTestPath = path.join(
  root,
  'packages',
  'terse-python-cli',
  'tests',
  'test_init_and_generate.py'
);

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const releaseSpec = positional[0] ?? 'patch';

  if (flags.has('--help')) {
    printUsage();
    process.exit(0);
  }

  return {
    dryRun: flags.has('--dry-run'),
    releaseSpec,
  };
}

function printUsage() {
  console.log(`Usage:
  npm run python:release:prep
  npm run python:release:prep -- minor
  npm run python:release:prep -- major
  npm run python:release:prep -- 0.2.0
  npm run python:release:prep -- --dry-run

Behavior:
  - defaults to a patch bump for both terse-cli and terse-sdk
  - accepts patch, minor, major, or an explicit x.y.z version
  - updates the CLI's terse-sdk dependency floor
  - refreshes uv.lock unless --dry-run is used
  - does not publish anything
`);
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) {
    throw new Error(`Invalid version: ${value}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function bumpVersion(version, kind) {
  if (kind === 'patch') {
    return { ...version, patch: version.patch + 1 };
  }
  if (kind === 'minor') {
    return { ...version, minor: version.minor + 1, patch: 0 };
  }
  if (kind === 'major') {
    return { major: version.major + 1, minor: 0, patch: 0 };
  }
  throw new Error(`Unsupported bump kind: ${kind}`);
}

function buildSdkDependencyRange(version) {
  return `terse-sdk>=${version.major}.${version.minor}.${version.patch},<${version.major}.${version.minor + 1}.0`;
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function replaceOrThrow(content, pattern, replacement, description) {
  if (!pattern.test(content)) {
    throw new Error(`Could not find ${description}`);
  }

  return content.replace(pattern, replacement);
}

function readProjectVersion(pyprojectPath) {
  const content = readFile(pyprojectPath);
  const match = /^version = "([^"]+)"$/m.exec(content);
  if (!match) {
    throw new Error(`Could not find project version in ${pyprojectPath}`);
  }
  return match[1];
}

function updateFile(filePath, updater) {
  const original = readFile(filePath);
  const updated = updater(original);
  if (updated !== original) {
    writeFile(filePath, updated);
    return true;
  }
  return false;
}

function main() {
  const { dryRun, releaseSpec } = parseArgs(process.argv.slice(2));

  const currentCliVersion = parseVersion(readProjectVersion(cliPyprojectPath));
  const currentSdkVersion = parseVersion(readProjectVersion(sdkPyprojectPath));

  const nextCliVersion =
    releaseSpec === 'patch' || releaseSpec === 'minor' || releaseSpec === 'major'
      ? bumpVersion(currentCliVersion, releaseSpec)
      : parseVersion(releaseSpec);
  const nextSdkVersion =
    releaseSpec === 'patch' || releaseSpec === 'minor' || releaseSpec === 'major'
      ? bumpVersion(currentSdkVersion, releaseSpec)
      : parseVersion(releaseSpec);

  const nextCliVersionString = formatVersion(nextCliVersion);
  const nextSdkVersionString = formatVersion(nextSdkVersion);
  const nextSdkDependencyRange = buildSdkDependencyRange(nextSdkVersion);

  console.log(`Preparing Python release (${dryRun ? 'dry run' : 'write mode'})`);
  console.log(`  terse-cli: ${formatVersion(currentCliVersion)} -> ${nextCliVersionString}`);
  console.log(`  terse-sdk: ${formatVersion(currentSdkVersion)} -> ${nextSdkVersionString}`);
  console.log(`  terse-cli SDK dependency: ${nextSdkDependencyRange}`);

  if (dryRun) {
    console.log('No files were changed.');
    return;
  }

  const changedFiles = [];

  if (
    updateFile(cliPyprojectPath, (content) =>
      replaceOrThrow(content, /^version = "[^"]+"$/m, `version = "${nextCliVersionString}"`, 'CLI project version')
    )
  ) {
    changedFiles.push(cliPyprojectPath);
  }

  if (
    updateFile(sdkPyprojectPath, (content) =>
      replaceOrThrow(content, /^version = "[^"]+"$/m, `version = "${nextSdkVersionString}"`, 'SDK project version')
    )
  ) {
    changedFiles.push(sdkPyprojectPath);
  }

  if (
    updateFile(cliInitPath, (content) =>
      replaceOrThrow(content, /__version__ = "[^"]+"/, `__version__ = "${nextCliVersionString}"`, 'CLI __version__')
    )
  ) {
    changedFiles.push(cliInitPath);
  }

  if (
    updateFile(sdkInitPath, (content) =>
      replaceOrThrow(content, /__version__ = "[^"]+"/, `__version__ = "${nextSdkVersionString}"`, 'SDK __version__')
    )
  ) {
    changedFiles.push(sdkInitPath);
  }

  if (
    updateFile(cliPyprojectPath, (content) =>
      replaceOrThrow(
        content,
        /"terse-sdk>=[^"]+"/,
        `"${nextSdkDependencyRange}"`,
        'CLI SDK dependency range'
      )
    )
  ) {
    if (!changedFiles.includes(cliPyprojectPath)) {
      changedFiles.push(cliPyprojectPath);
    }
  }

  if (
    updateFile(cliProjectPath, (content) =>
      replaceOrThrow(content, /or "\d+\.\d+\.\d+"/, `or "${nextSdkVersionString}"`, 'CLI SDK fallback version')
    )
  ) {
    changedFiles.push(cliProjectPath);
  }

  if (
    updateFile(cliInitGenerateTestPath, (content) =>
      replaceOrThrow(
        content,
        /"SDK_DEPENDENCY": "terse-sdk>=[^"]+"/,
        `"SDK_DEPENDENCY": "${nextSdkDependencyRange}"`,
        'CLI init test SDK dependency'
      )
    )
  ) {
    changedFiles.push(cliInitGenerateTestPath);
  }

  execFileSync('uv', ['lock'], {
    cwd: root,
    stdio: 'inherit',
  });

  changedFiles.push(path.join(root, 'uv.lock'));

  console.log('Updated files:');
  for (const filePath of changedFiles) {
    console.log(`  ${path.relative(root, filePath)}`);
  }
  console.log('Next steps:');
  console.log('  1. Review the diff.');
  console.log('  2. Run npm run python:dist:check');
  console.log('  3. Run npm run python:publish when you are ready to upload.');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
