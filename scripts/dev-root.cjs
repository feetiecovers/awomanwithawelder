const { spawn } = require('child_process');

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const children = [];
let shuttingDown = false;

function spawnProcess(args, envOverrides) {
  const child = spawn(pnpmCommand, args, {
    shell: process.platform === 'win32',
    stdio: 'inherit',
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  children.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    for (const otherChild of children) {
      if (otherChild !== child && !otherChild.killed) {
        otherChild.kill();
      }
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(error.message);
    for (const otherChild of children) {
      if (!otherChild.killed) {
        otherChild.kill();
      }
    }
    process.exit(1);
  });
}

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

spawnProcess(
  ['--filter', '@workspace/api-server', 'run', 'dev'],
  {
    NODE_ENV: 'development',
    PORT: process.env.PORT || '5000',
  },
);

spawnProcess(
  ['--filter', '@workspace/awww-site', 'run', 'dev'],
  {
    BASE_PATH: process.env.BASE_PATH || '/',
  },
);
