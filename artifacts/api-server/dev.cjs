const { spawn } = require('child_process');

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: process.platform === 'win32' && command === pnpmCommand,
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Process terminated with signal ${signal}`));
        return;
      }

      if (code && code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
        return;
      }

      resolve();
    });

    child.on('error', reject);
  });
}

async function main() {
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: process.env.PORT || '5000',
  };

  await run(pnpmCommand, ['run', 'build'], env);
  await run('node', ['--enable-source-maps', './dist/index.mjs'], env);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
