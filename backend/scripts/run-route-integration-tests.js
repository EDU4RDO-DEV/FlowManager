const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

const backendPath = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendPath, '.env'), quiet: true });

if (process.env.FLOWMANAGER_SQLSERVER_INTEGRATION !== '1') {
  console.error(
    'Route integration tests are disabled. Set FLOWMANAGER_SQLSERVER_INTEGRATION=1 only for FlowManager.',
  );
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$queryRaw`SELECT DB_NAME() AS databaseName`;
    if (result[0]?.databaseName !== 'FlowManager') {
      throw new Error('Route integration tests are restricted to the FlowManager database.');
    }
  } finally {
    await prisma.$disconnect();
  }

  const vitestCli = require.resolve('vitest/vitest.mjs');
  const result = spawnSync(
    process.execPath,
    [vitestCli, 'run', 'src/tests/route-flow.sqlserver.integration.spec.ts'],
    {
      cwd: backendPath,
      env: { ...process.env, ROUTE_SQLSERVER_INTEGRATION: '1' },
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  console.error(`Route integration safety check failed: ${error.message}`);
  process.exitCode = 1;
});
