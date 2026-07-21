const { spawn } = require('child_process');

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(
  pnpmCommand,
  ['--filter', '@workspace/mockup-sandbox', 'run', 'dev'],
  {
    shell: process.platform === 'win32',
    stdio: 'inherit',
    env: {
      ...process.env,
      BASE_PATH: process.env.BASE_PATH || '/',
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
