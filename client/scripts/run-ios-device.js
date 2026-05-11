#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const { spawn } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const NPX_COMMAND = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const ENV_FILES = ['.env.local', '.env'];

function main() {
  const env = {
    ...loadProjectEnv(),
    ...process.env,
  };
  const appleTeamId = env.EXPO_IOS_APPLE_TEAM_ID;
  const bundleIdentifier = env.EXPO_IOS_BUNDLE_IDENTIFIER;

  if (!appleTeamId || !bundleIdentifier) {
    console.error('');
    console.error('[ios-device] Missing local iOS signing configuration.');
    console.error('Set both EXPO_IOS_APPLE_TEAM_ID and EXPO_IOS_BUNDLE_IDENTIFIER, then retry.');
    console.error('');
    console.error('Example:');
    console.error(
      '  EXPO_IOS_APPLE_TEAM_ID=ABCDE12345 EXPO_IOS_BUNDLE_IDENTIFIER=com.example.todolog npm run ios:device'
    );
    console.error('');
    console.error('If you only need a simulator build, use:');
    console.error('  npm run dev:ios:sim');
    console.error('');
    process.exit(1);
  }

  const extraArgs = process.argv.slice(2);
  const args = ['expo', 'run:ios', '--device', ...extraArgs];

  console.log('');
  console.log('[ios-device] Launching Expo iOS device build');
  console.log(`  team id: ${appleTeamId}`);
  console.log(`  bundle id: ${bundleIdentifier}`);
  console.log(`  command: npx ${args.join(' ')}`);
  console.log('');

  const child = spawn(NPX_COMMAND, args, {
    cwd: PROJECT_ROOT,
    env,
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error('[ios-device] Failed to execute Expo CLI.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

function loadProjectEnv() {
  return ENV_FILES.reduce((accumulator, fileName) => {
    const filePath = path.join(PROJECT_ROOT, fileName);
    if (!fs.existsSync(filePath)) {
      return accumulator;
    }

    const contents = fs.readFileSync(filePath, 'utf8');
    const parsed = parseEnvFile(contents);
    return {
      ...accumulator,
      ...parsed,
    };
  }, {});
}

function parseEnvFile(contents) {
  return contents.split(/\r?\n/).reduce((accumulator, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return accumulator;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return accumulator;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      return accumulator;
    }

    accumulator[key] = stripWrappingQuotes(rawValue);
    return accumulator;
  }, {});
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

main();
