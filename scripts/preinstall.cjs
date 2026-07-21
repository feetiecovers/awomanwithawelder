const fs = require('fs');
const path = require('path');

for (const fileName of ['package-lock.json', 'yarn.lock']) {
  const filePath = path.join(process.cwd(), fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

const userAgent = process.env.npm_config_user_agent || '';
if (!userAgent.startsWith('pnpm/')) {
  console.error('Use pnpm instead');
  process.exit(1);
}
