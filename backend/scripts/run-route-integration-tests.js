const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const sourceUrl = process.env.DATABASE_URL;
const databaseMatch = sourceUrl?.match(/([;?&]database=)([^;?&]+)/i);

if (!databaseMatch) {
  console.error('DATABASE_URL must include a SQL Server database parameter.');
  process.exit(1);
}

const configuredDatabase = databaseMatch[2].toLowerCase();
if (configuredDatabase !== 'flowmanager' && configuredDatabase !== 'flowmanager_test') {
  console.error('Route integration tests may only target FlowManager_Test.');
  process.exit(1);
}

const testUrl =
  configuredDatabase === 'flowmanager'
    ? sourceUrl.replace(/([;?&]database=)FlowManager(?=;|&|$)/i, '$1FlowManager_Test')
    : sourceUrl;

const backendPath = path.resolve(__dirname, '..');
const vitestPath = require.resolve('vitest/vitest.mjs');
const result = spawnSync(
  process.execPath,
  [
    vitestPath,
    'run',
    '--maxWorkers=1',
    'src/tests/route-flow.sqlserver.integration.spec.ts',
    'src/tests/sale-payment.rollback.integration.spec.ts',
  ],
  {
    cwd: backendPath,
    env: {
      ...process.env,
      DATABASE_URL: testUrl,
      ROUTE_SQLSERVER_INTEGRATION: '1',
    },
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error('Could not start the route integration test runner.');
  process.exit(1);
}

process.exit(result.status ?? 1);
