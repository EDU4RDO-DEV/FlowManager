const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');

const backendPath = path.resolve(__dirname, '..');
const schemaPath = path.join(backendPath, 'prisma', 'schema.prisma');
const migrationsPath = path.join(backendPath, 'prisma', 'migrations');
dotenv.config({ path: path.join(backendPath, '.env'), quiet: true });

const command = process.argv[2];
const args = process.argv.slice(3);
if (!['create', 'deploy', 'status'].includes(command)) {
  console.error('Usage: node scripts/prisma-migrate.js <create|deploy|status> [--name migration_name]');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseMatch = databaseUrl.match(/[;?&](?:database|initial catalog)=([^;?&]+)/i);
const configuredDatabase = databaseMatch
  ? decodeURIComponent(databaseMatch[1]).toLowerCase()
  : '';

if (!databaseUrl || configuredDatabase !== 'flowmanager') {
  console.error('Prisma migrations are restricted to the FlowManager database.');
  process.exit(1);
}

function runPrisma(prismaCli, prismaArgs, stdio = 'inherit') {
  const result = spawnSync(process.execPath, [prismaCli, ...prismaArgs], {
    cwd: backendPath,
    env: process.env,
    encoding: stdio === 'pipe' ? 'utf8' : undefined,
    maxBuffer: 16 * 1024 * 1024,
    stdio,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function assertNoUnexpectedArgs(allowedNames) {
  const unexpectedArgs = args.filter((arg) => !allowedNames.includes(arg));
  if (unexpectedArgs.length > 0) {
    throw new Error(`Unsupported migration arguments: ${unexpectedArgs.join(' ')}`);
  }
}

function hasExecutableSql(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim().length > 0;
}

function getMigrationOptions() {
  let name;
  let sqlFile;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--name') {
      name = args[index + 1];
      index += 1;
    } else if (arg.startsWith('--name=')) {
      name = arg.slice('--name='.length);
    } else if (arg === '--sql-file') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--sql-file requires a path to reviewed SQL.');
      }
      sqlFile = value;
      index += 1;
    } else if (arg.startsWith('--sql-file=')) {
      sqlFile = arg.slice('--sql-file='.length);
    } else {
      throw new Error(`Unsupported create argument: ${arg}`);
    }
  }

  if (!name || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(name)) {
    throw new Error('Provide --name with a lowercase snake_case migration name.');
  }

  if (sqlFile !== undefined && !sqlFile.trim()) {
    throw new Error('--sql-file requires a path to reviewed SQL.');
  }

  return { name, sqlFile };
}

async function verifyConnection() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const result = await prisma.$queryRaw`
      SELECT
        CAST(@@SERVERNAME AS nvarchar(128)) AS serverName,
        DB_NAME() AS databaseName,
        CAST(DATABASEPROPERTYEX(DB_NAME(), 'Status') AS nvarchar(60)) AS databaseStatus
    `;
    const target = result[0];
    if (target?.databaseName?.toLowerCase() !== 'flowmanager' || target?.databaseStatus !== 'ONLINE') {
      throw new Error('The effective Prisma connection is not an online FlowManager database.');
    }
    console.log(`Verified Prisma target: ${target.serverName}/${target.databaseName} (${target.databaseStatus}).`);
  } finally {
    await prisma.$disconnect();
  }
}

function prismaMigrateArgs(action) {
  return ['migrate', action, '--schema', schemaPath];
}

function ensureMigrationHistoryIsCurrent(prismaCli) {
  const result = runPrisma(prismaCli, prismaMigrateArgs('status'));
  if (result.status !== 0) {
    throw new Error('Resolve existing pending or failed migrations before generating a new migration.');
  }
}

function latestMigrationTimestamp() {
  const timestamps = fs.readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.match(/^(\d{14})_/))
    .filter(Boolean)
    .map((match) => match[1]);

  if (timestamps.length === 0) {
    return 0;
  }

  const latest = timestamps.sort().at(-1);
  const parts = latest.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  const latestTime = Date.UTC(
    Number(parts[1]),
    Number(parts[2]) - 1,
    Number(parts[3]),
    Number(parts[4]),
    Number(parts[5]),
    Number(parts[6]),
  );
  return Number.isNaN(latestTime) ? 0 : latestTime;
}

function nextMigrationTimestamp() {
  const now = Date.now();
  const nextAfterLatest = latestMigrationTimestamp() + 1000;
  const date = new Date(Math.max(now, nextAfterLatest));
  return date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

function createMigration(prismaCli) {
  const { name, sqlFile } = getMigrationOptions();
  ensureMigrationHistoryIsCurrent(prismaCli);

  let sql;
  if (sqlFile) {
    const sourcePath = path.resolve(backendPath, sqlFile);
    sql = fs.readFileSync(sourcePath, 'utf8').trim();
    if (!hasExecutableSql(sql)) {
      throw new Error('The custom SQL file must contain executable SQL, not only comments.');
    }
  } else {
    const diff = runPrisma(
      prismaCli,
      [
        'migrate',
        'diff',
        '--from-schema-datasource',
        schemaPath,
        '--to-schema-datamodel',
        schemaPath,
        '--script',
      ],
      'pipe',
    );

    if (diff.status !== 0) {
      if (diff.stdout) process.stdout.write(diff.stdout);
      if (diff.stderr) process.stderr.write(diff.stderr);
      throw new Error('Prisma could not generate a schema diff from FlowManager.');
    }
    if (diff.stderr) process.stderr.write(diff.stderr);
    sql = diff.stdout.trim();
    if (!hasExecutableSql(sql)) {
      throw new Error('The FlowManager schema already matches schema.prisma; no migration was created.');
    }
  }

  const migrationName = `${nextMigrationTimestamp()}_${name}`;
  const migrationDirectory = path.join(migrationsPath, migrationName);
  if (fs.existsSync(migrationDirectory)) {
    throw new Error(`Migration directory already exists: ${migrationName}`);
  }

  fs.mkdirSync(migrationDirectory);
  fs.writeFileSync(path.join(migrationDirectory, 'migration.sql'), `${sql}\n`, 'utf8');
  console.log(`Created versioned migration: prisma/migrations/${migrationName}/migration.sql`);
  console.log('Review the generated SQL, especially any DROP statements, before running prisma:migrate:deploy.');
}

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prismaCli = require.resolve('prisma/build/index.js');
  await verifyConnection();

  if (command === 'create') {
    createMigration(prismaCli);
    return;
  }

  assertNoUnexpectedArgs([]);
  const result = runPrisma(prismaCli, prismaMigrateArgs(command));
  if (result.status !== 0 || command !== 'deploy') {
    process.exitCode = result.status ?? 1;
    return;
  }

  await verifyConnection();
  const verification = runPrisma(prismaCli, prismaMigrateArgs('status'));
  if (verification.status !== 0) {
    throw new Error('Migration command returned successfully, but pending migrations remain.');
  }
}

main().catch((error) => {
  console.error(`Prisma migration guard failed: ${error.message}`);
  process.exitCode = 1;
});
