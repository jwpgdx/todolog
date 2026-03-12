#!/usr/bin/env node

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const process = require('node:process');
const { spawn, spawnSync } = require('node:child_process');

const CLIENT_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(CLIENT_ROOT, '..');
const NODE_COMMAND = process.execPath;
const NPX_COMMAND = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const DEFAULT_WEB_PORT = 4100;

async function main() {
  const { mode, options, positionals } = parseArgs(process.argv.slice(2));

  if (!mode || mode === 'help') {
    printHelp();
    return;
  }

  if (mode !== 'web' && mode !== 'playwright') {
    console.error(`Unknown mode: ${mode}`);
    printHelp();
    process.exit(1);
  }

  const serverPort = resolveServerPort();
  const apiUrl = process.env.CODEX_API_URL || `http://127.0.0.1:${serverPort}/api`;
  const webPort = await resolveWebPort(options.port);
  const env = buildEnv({ apiUrl, webPort });

  if (mode === 'web') {
    runCommand({
      command: NODE_COMMAND,
      args: [
        path.join(CLIENT_ROOT, 'scripts', 'dev-launcher.js'),
        '--target', 'web',
        '--non-interactive',
        '--host', 'localhost',
        '--port', String(webPort),
      ],
      env,
      label: `Codex web launcher on ${webPort}`,
    });
    return;
  }

  await runPlaywrightWithManagedWebServer({
    env,
    positionals,
    webPort,
    apiUrl,
  });
}

function parseArgs(argv) {
  const [mode = 'help', ...rest] = argv;
  const options = {
    port: '',
  };
  const positionals = [];

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === '--help' || arg === '-h') {
      return {
        mode: 'help',
        options,
        positionals,
      };
    }

    if (arg === '--port') {
      options.port = rest[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--port=')) {
      options.port = arg.split('=')[1] || '';
      continue;
    }

    positionals.push(arg);
  }

  return {
    mode,
    options,
    positionals,
  };
}

function printHelp() {
  console.log(`
Usage:
  node ./scripts/codex-test-env.js playwright [playwright-args...]
  node ./scripts/codex-test-env.js web [--port <number>]

Examples:
  npm run codex:test:smoke
  npm run codex:test:real:category
  npm run codex:web

Behavior:
  - Forces EXPO_PUBLIC_API_URL to localhost using server/.env PORT
  - Forces PW_REAL_API_BASE_URL to the same localhost API
  - Chooses a free PW_WEB_PORT automatically unless --port is provided
`);
}

function resolveServerPort() {
  if (process.env.CODEX_SERVER_PORT) {
    return normalizePort(process.env.CODEX_SERVER_PORT);
  }

  const serverEnvPath = path.join(REPO_ROOT, 'server', '.env');
  try {
    const content = fs.readFileSync(serverEnvPath, 'utf8');
    const match = content.match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
    if (match) {
      return normalizePort(match[1]);
    }
  } catch {
    // Ignore and fall back to the known local default.
  }

  return 5001;
}

async function resolveWebPort(requestedPort) {
  if (requestedPort) {
    const normalized = normalizePort(requestedPort);
    const available = await isPortAvailable(normalized);
    if (!available) {
      console.error(`Requested port ${normalized} is already in use.`);
      process.exit(1);
    }
    return normalized;
  }

  return findAvailablePort(DEFAULT_WEB_PORT, 100);
}

function buildEnv({ apiUrl, webPort }) {
  const env = { ...process.env };

  env.EXPO_PUBLIC_API_URL = apiUrl;
  env.EXPO_NO_DOTENV = '1';
  delete env.EXPO_NO_CLIENT_ENV_VARS;
  env.PW_REAL_API_BASE_URL = process.env.PW_REAL_API_BASE_URL || apiUrl;
  env.PW_WEB_PORT = process.env.PW_WEB_PORT || String(webPort);
  env.PW_BASE_URL = process.env.PW_BASE_URL || `http://127.0.0.1:${env.PW_WEB_PORT}`;

  return env;
}

function runCommand({ command, args, env, label }) {
  console.log('');
  console.log(`[codex-test-env] ${label}`);
  console.log(`  api url: ${env.EXPO_PUBLIC_API_URL}`);
  console.log(`  web port: ${env.PW_WEB_PORT}`);
  console.log(`  command: ${command} ${args.join(' ')}`);
  console.log('');

  const child = spawn(command, args, {
    cwd: CLIENT_ROOT,
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
    console.error('[codex-test-env] Failed to execute command.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

async function runPlaywrightWithManagedWebServer({ env, positionals, webPort, apiUrl }) {
  const shouldManageWebServer = process.env.PW_SKIP_WEBSERVER !== '1';
  let webChild = null;

  if (shouldManageWebServer) {
    env.PW_SKIP_WEBSERVER = '1';
    webChild = await startManagedWebServer(env, webPort);
  }

  console.log('');
  console.log(`[codex-test-env] Codex Playwright on ${webPort} -> ${apiUrl}`);
  console.log(`  api url: ${env.EXPO_PUBLIC_API_URL}`);
  console.log(`  web port: ${env.PW_WEB_PORT}`);
  console.log(`  command: ${NPX_COMMAND} playwright test ${positionals.join(' ')}`);
  console.log('');

  const child = spawn(NPX_COMMAND, ['playwright', 'test', ...positionals], {
    cwd: CLIENT_ROOT,
    env,
    stdio: 'inherit',
  });

  const cleanup = () => {
    if (webChild && !webChild.killed) {
      webChild.kill('SIGINT');
    }
  };

  child.on('exit', (code, signal) => {
    cleanup();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    cleanup();
    console.error('[codex-test-env] Failed to execute Playwright.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

async function startManagedWebServer(env, webPort) {
  console.log('');
  console.log(`[codex-test-env] Starting managed web server on ${webPort}`);
  console.log(`  api url: ${env.EXPO_PUBLIC_API_URL}`);
  console.log('');

  const child = spawn(
    NODE_COMMAND,
    [
      path.join(CLIENT_ROOT, 'scripts', 'dev-launcher.js'),
      '--target', 'web',
      '--non-interactive',
      '--host', 'localhost',
      '--port', String(webPort),
    ],
    {
      cwd: CLIENT_ROOT,
      env,
      stdio: 'inherit',
    }
  );

  child.on('error', (error) => {
    console.error('[codex-test-env] Failed to start managed web server.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });

  const ready = await waitForUrl(`http://127.0.0.1:${webPort}`, 120_000);
  if (!ready) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
    console.error(`[codex-test-env] Managed web server did not become ready on port ${webPort}.`);
    process.exit(1);
  }

  return child;
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

function hasListeningProcess(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
    cwd: CLIENT_ROOT,
    encoding: 'utf8',
  });

  return result.status === 0 && Boolean((result.stdout || '').trim());
}

function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`Invalid port: ${value}`);
    process.exit(1);
  }
  return port;
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Keep polling until timeout.
    }

    await delay(1000);
  }

  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error('[codex-test-env] Failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
