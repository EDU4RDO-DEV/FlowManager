const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');

const backendPath = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendPath, '.env'), quiet: true });

const command = process.argv[2];
if (!['dev', 'deploy', 'status'].includes(command)) {
  console.error('Usage: node scripts/prisma-migrate.js <dev|deploy|status> [...args]');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseMatch = databaseUrl.match(/[;?&](?:database|initial catalog)=([^;?&]+)/i);
const configuredDatabase = databaseMatch
  ? decodeURIComponent(databaseMatch[1]).toLowerCase()
  : '';

if (configuredDatabase !== 'flowmanager') {
  console.error('Prisma migrations are restricted to the FlowManager database.');
  process.exit(1);
}

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const result = await prisma.$queryRaw`SELECT DB_NAME() AS databaseName`;
    if (result[0]?.databaseName?.toLowerCase() !== 'flowmanager') {
      throw new Error('The connected SQL Server database is not FlowManager.');
    }
  } finally {
    await prisma.$disconnect();
  }

  const prismaCli = require.resolve('prisma/build/index.js');
  const result = spawnSync(
    process.execPath,
    [
      prismaCli,
      'migrate',
      command,
      ...process.argv.slice(3),
      '--schema',
      path.join(backendPath, 'prisma', 'schema.prisma'),
    ],
    {
      cwd: backendPath,
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  console.error(`Prisma migration guard failed: ${error.message}`);
  process.exitCode = 1;
});
