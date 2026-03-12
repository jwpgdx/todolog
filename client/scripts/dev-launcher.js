#!/usr/bin/env node

const net = require('node:net');
const path = require('node:path');
const process = require('node:process');
const readline = require('node:readline/promises');
const { spawn, spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const NPX_COMMAND = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const DEFAULT_PORT = Number(process.env.RCT_METRO_PORT) || 8081;
const ALLOWED_HOSTS = new Set(['localhost', 'lan', 'tunnel']);

const TARGETS = {
  'ios-sim': {
    label: 'iOS Simulator',
    command: 'expo-start',
    defaultHost: 'localhost',
    startArgs: ['start', '--dev-client', '--ios'],
    prepare: ensureIosSimulator,
  },
  'android-emu': {
    label: 'Android Emulator',
    command: 'expo-start',
    defaultHost: 'localhost',
    startArgs: ['start', '--dev-client', '--android'],
  },
  device: {
    label: 'Physical Device (Tunnel)',
    command: 'expo-start',
    defaultHost: 'tunnel',
    startArgs: ['start', '--dev-client'],
  },
  web: {
    label: 'Web',
    command: 'expo-start',
    defaultHost: 'localhost',
    startArgs: ['start', '--web'],
  },
  server: {
    label: 'Dev Client Server Only',
    command: 'expo-start',
    defaultHost: 'localhost',
    startArgs: ['start', '--dev-client'],
  },
  'ios-install': {
    label: 'Install / Rebuild iOS App',
    command: 'expo-run',
    runArgs: ['run:ios', '--no-bundler'],
    prepare: ensureIosSimulator,
  },
  'android-install': {
    label: 'Install / Rebuild Android App',
    command: 'expo-run',
    runArgs: ['run:android', '--no-bundler'],
  },
};

const MENU_OPTIONS = [
  { key: '1', target: 'ios-sim' },
  { key: '2', target: 'android-emu' },
  { key: '3', target: 'device' },
  { key: '4', target: 'web' },
  { key: '5', target: 'server' },
  { key: '6', target: 'ios-install' },
  { key: '7', target: 'android-install' },
];

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  let targetName = options.target;

  if (!targetName) {
    if (!process.stdin.isTTY || options.nonInteractive) {
      console.error('Target is required in non-interactive mode. Use --target <name>.');
      printHelp();
      process.exit(1);
    }

    targetName = await promptForTarget();
    if (!targetName) {
      return;
    }
  }

  const target = TARGETS[targetName];
  if (!target) {
    console.error(`Unknown target: ${targetName}`);
    printHelp();
    process.exit(1);
  }

  const host = options.host || target.defaultHost;
  if (host && !ALLOWED_HOSTS.has(host)) {
    console.error(`Invalid host: ${host}`);
    process.exit(1);
  }

  const port = await resolvePort(target, options.port);

  if (typeof target.prepare === 'function') {
    await target.prepare();
  }

  const commandArgs = buildCommandArgs(target, { host, port, clear: options.clear });
  printLaunchSummary(targetName, target, host, port, commandArgs);

  const child = spawn(NPX_COMMAND, ['expo', ...commandArgs], {
    cwd: PROJECT_ROOT,
    env: buildEnv(port),
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
    console.error('[dev-launcher] Failed to execute Expo CLI.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

function parseArgs(argv) {
  const options = {
    clear: false,
    help: false,
    host: '',
    nonInteractive: false,
    port: undefined,
    target: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--non-interactive') {
      options.nonInteractive = true;
      continue;
    }

    if (arg === '--clear' || arg === '-c') {
      options.clear = true;
      continue;
    }

    if (arg === '--target') {
      options.target = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--target=')) {
      options.target = arg.split('=')[1] || '';
      continue;
    }

    if (arg === '--host') {
      options.host = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--host=')) {
      options.host = arg.split('=')[1] || '';
      continue;
    }

    if (arg === '--port') {
      options.port = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--port=')) {
      options.port = arg.split('=')[1] || '';
      continue;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  npm run dev
  npm run dev -- --target ios-sim --non-interactive

Targets:
  ios-sim         Start Expo dev client on iOS simulator
  android-emu     Start Expo dev client on Android emulator
  device          Start Expo dev client in tunnel mode for physical devices
  web             Start Expo web dev server
  server          Start Expo dev client server only
  ios-install     Install / rebuild the iOS app without starting Metro
  android-install Install / rebuild the Android app without starting Metro

Options:
  --target <name>         Target to run
  --host <localhost|lan|tunnel>
  --port <number>         Preferred Metro port
  --non-interactive       Fail instead of prompting
  --clear, -c             Clear Metro cache before start
  --help, -h              Show this help
`);
}

async function promptForTarget() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('');
  console.log('Expo Dev Launcher');
  console.log('-----------------');
  MENU_OPTIONS.forEach(({ key, target }) => {
    console.log(`${key}. ${TARGETS[target].label}`);
  });
  console.log('q. Exit');
  console.log('');

  const answer = (await rl.question('Select target: ')).trim().toLowerCase();
  rl.close();

  if (!answer || answer === 'q' || answer === 'quit' || answer === 'exit') {
    return '';
  }

  const matched = MENU_OPTIONS.find((option) => option.key === answer);
  if (matched) {
    return matched.target;
  }

  if (TARGETS[answer]) {
    return answer;
  }

  console.error(`Unknown selection: ${answer}`);
  process.exit(1);
}

async function resolvePort(target, requestedPort) {
  if (target.command !== 'expo-start') {
    return undefined;
  }

  if (requestedPort) {
    const normalized = normalizePort(requestedPort);
    const available = await isPortAvailable(normalized);
    if (!available) {
      console.error(`Requested port ${normalized} is already in use.`);
      process.exit(1);
    }
    return normalized;
  }

  return findAvailablePort(DEFAULT_PORT, 100);
}

function buildCommandArgs(target, options) {
  if (target.command === 'expo-run') {
    return [...target.runArgs];
  }

  const args = [...target.startArgs];

  if (options.host) {
    args.push('--host', options.host);
  }

  if (options.port && target.command === 'expo-start' && options.host !== 'tunnel') {
    args.push('--port', String(options.port));
  }

  if (options.clear) {
    args.push('--clear');
  }

  return args;
}

function buildEnv(port) {
  const env = { ...process.env };

  if (port) {
    env.RCT_METRO_PORT = String(port);
  }

  // If the caller already pinned a public API URL, don't let Expo reload
  // client/.env and overwrite it during web/native bundling.
  if (env.EXPO_PUBLIC_API_URL) {
    env.EXPO_NO_DOTENV = '1';
    delete env.EXPO_NO_CLIENT_ENV_VARS;
  }

  return env;
}

function printLaunchSummary(targetName, target, host, port, args) {
  console.log('');
  console.log('[dev-launcher] Launching target');
  console.log(`  target: ${targetName} (${target.label})`);
  if (host) {
    console.log(`  host: ${host}`);
  }
  if (port) {
    console.log(`  metro port: ${port}`);
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log(`  api url: ${process.env.EXPO_PUBLIC_API_URL}`);
  }
  console.log(`  command: npx expo ${args.join(' ')}`);
  console.log('');
}

async function findAvailablePort(startPort, attempts) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = startPort + offset;
    const available = await isPortAvailable(candidate);
    if (available) {
      return candidate;
    }
  }

  console.error(`Unable to find a free port in range ${startPort}-${startPort + attempts - 1}.`);
  process.exit(1);
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.unref();
    server.on('error', (error) => {
      if (error && (error.code === 'EPERM' || error.code === 'EACCES')) {
        resolve(!hasListeningProcess(port));
        return;
      }
      resolve(false);
    });
    server.listen({ port, host: '127.0.0.1' }, () => {
      server.close(() => resolve(true));
    });
  });
}

function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`Invalid port: ${value}`);
    process.exit(1);
  }
  return port;
}

async function ensureIosSimulator() {
  const simctl = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });

  if (simctl.status !== 0) {
    console.warn('[dev-launcher] Unable to inspect iOS simulators. Expo will try to launch one.');
    return;
  }

  const devices = parseSimctlDevices(simctl.stdout);
  if (!devices.length) {
    console.warn('[dev-launcher] No available iOS simulator metadata found.');
    return;
  }

  const booted = devices.find((device) => device.state === 'Booted' && /iPhone/i.test(device.name));
  if (booted) {
    return;
  }

  const preferred = devices.find((device) => /iPhone/i.test(device.name));
  if (!preferred) {
    console.warn('[dev-launcher] No available iPhone simulator found.');
    return;
  }

  console.log(`[dev-launcher] Booting iOS simulator: ${preferred.name}`);
  spawnSync('xcrun', ['simctl', 'boot', preferred.udid], {
    cwd: PROJECT_ROOT,
    stdio: 'ignore',
  });
  spawnSync('open', ['-a', 'Simulator'], {
    cwd: PROJECT_ROOT,
    stdio: 'ignore',
  });

  const bootedInTime = await waitForSimulatorBoot(preferred.udid, 30_000);
  if (!bootedInTime) {
    console.warn('[dev-launcher] iOS simulator boot wait timed out. Expo will continue anyway.');
  }
}

async function waitForSimulatorBoot(udid, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const simctl = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });

    if (simctl.status === 0) {
      const devices = parseSimctlDevices(simctl.stdout);
      const matching = devices.find((device) => device.udid === udid);
      if (matching && matching.state === 'Booted') {
        return true;
      }
    }

    await delay(1000);
  }

  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasListeningProcess(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });

  return result.status === 0 && Boolean((result.stdout || '').trim());
}

function parseSimctlDevices(stdout) {
  try {
    const parsed = JSON.parse(stdout || '{}');
    return Object.values(parsed.devices || {})
      .flat()
      .filter((device) => device && device.isAvailable !== false);
  } catch (error) {
    console.warn('[dev-launcher] Failed to parse simulator list output.');
    return [];
  }
}

main().catch((error) => {
  console.error('[dev-launcher] Failed to start.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
