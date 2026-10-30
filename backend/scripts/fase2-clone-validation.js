/*
 * Fase 2 - validación en clon desechable (NO toca FlowManager real salvo por el BACKUP, que es de solo lectura).
 *   1) BACKUP DATABASE FlowManager (con checksum) a un archivo nuevo.
 *   2) RESTORE VERIFYONLY sobre ese archivo (integridad).
 *   3) RESTORE DATABASE a FlowManager_Fase2_Test (nombre fijo, sin REPLACE; aborta si ya existe).
 *   4) DBCC CHECKDB sobre el clon.
 *   5) Comparación de conteos de filas (incluidas tablas protegidas) origen vs. clon.
 *
 * El clon NO se elimina al final de este script (se usará para aplicar la migración y probar
 * Fase 2 a continuación). Repo-existing pattern: backend/scripts/verify-backup-restore.js.
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

const backendPath = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendPath, '.env'), quiet: true });

const CLONE_DB_NAME = 'FlowManager_Fase2_Test';

const TABLES_TO_COMPARE = [
  'Venta',
  'DetalleVenta',
  'PagoVenta',
  'CuentaPorCobrar',
  'SolicitudPagoIdempotente',
  'ReservaProforma',
  'DevolucionComercial',
  'Talonario',
  'Usuario',
  'InventarioItem',
  'RutaSesion',
];

function sanitizeForFileName(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function assertSourceIsFlowManager(prisma) {
  const [target] = await prisma.$queryRaw`
    SELECT DB_NAME() AS databaseName, CAST(DATABASEPROPERTYEX(DB_NAME(), 'Status') AS nvarchar(60)) AS databaseStatus
  `;
  if (target?.databaseName?.toLowerCase() !== 'flowmanager' || target?.databaseStatus !== 'ONLINE') {
    throw new Error('Este script solo está autorizado contra la base FlowManager en línea.');
  }
}

async function assertDatabaseDoesNotExist(prisma, dbName) {
  const [existing] = await prisma.$queryRaw`SELECT name FROM sys.databases WHERE name = ${dbName}`;
  if (existing) {
    throw new Error(`${dbName} ya existe en el servidor; no se procederá para evitar sobrescribirla.`);
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await assertSourceIsFlowManager(prisma);

    const [backupDirRow] = await prisma.$queryRaw`
      SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(512)) AS backupDir
    `;
    const backupDir = backupDirRow.backupDir;
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const backupFile = path.win32.join(backupDir, `FlowManager_Fase2_prevalidacion_${timestamp}.bak`);

    console.log(`\n[1/5] BACKUP DATABASE FlowManager -> ${backupFile}`);
    await prisma.$executeRawUnsafe(
      `BACKUP DATABASE [FlowManager] TO DISK = N'${backupFile}' WITH INIT, CHECKSUM, NAME = N'FlowManager Fase2 pre-validacion'`,
    );
    console.log('  OK: respaldo creado.');

    console.log('\n[2/5] RESTORE VERIFYONLY (integridad del archivo)...');
    await prisma.$executeRawUnsafe(`RESTORE VERIFYONLY FROM DISK = N'${backupFile}' WITH CHECKSUM`);
    console.log('  OK: el archivo de respaldo no está corrupto.');

    console.log(`\n[3/5] RESTORE DATABASE -> ${CLONE_DB_NAME} (clon desechable)...`);
    await assertDatabaseDoesNotExist(prisma, CLONE_DB_NAME);
    const fileList = await prisma.$queryRawUnsafe(`RESTORE FILELISTONLY FROM DISK = N'${backupFile}'`);
    const dataDir = path.win32.dirname(fileList.find((f) => f.Type === 'D').PhysicalName);
    const moveClauses = fileList
      .map((f) => {
        const ext = f.Type === 'L' ? 'ldf' : 'mdf';
        const uniqueSuffix = sanitizeForFileName(f.LogicalName);
        const target = path.win32.join(dataDir, `${CLONE_DB_NAME}_${uniqueSuffix}.${ext}`);
        return `MOVE N'${f.LogicalName}' TO N'${target}'`;
      })
      .join(',\n     ');
    await prisma.$executeRawUnsafe(
      `RESTORE DATABASE [${CLONE_DB_NAME}] FROM DISK = N'${backupFile}' WITH ${moveClauses}`,
    );
    console.log(`  OK: ${CLONE_DB_NAME} restaurada.`);

    console.log('\n[4/5] DBCC CHECKDB sobre el clon...');
    await prisma.$executeRawUnsafe(`DBCC CHECKDB(N'${CLONE_DB_NAME}') WITH NO_INFOMSGS`);
    console.log('  OK: clon consistente, sin errores de integridad.');

    console.log('\n[5/5] Comparación de conteos (FlowManager vs. clon)...');
    let allMatch = true;
    for (const table of TABLES_TO_COMPARE) {
      const [origin] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM FlowManager.dbo.${table}`);
      const [cloned] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM [${CLONE_DB_NAME}].dbo.${table}`);
      const originCount = Number(origin.c);
      const clonedCount = Number(cloned.c);
      const match = originCount === clonedCount;
      allMatch = allMatch && match;
      console.log(`  ${table.padEnd(26)} origen=${originCount} clon=${clonedCount} ${match ? 'OK' : 'DIFIERE'}`);
    }
    if (!allMatch) {
      throw new Error('Los conteos no coinciden entre FlowManager y el clon.');
    }

    console.log(`\nResultado: backup verificado y clon ${CLONE_DB_NAME} listo para aplicar la migración de Fase 2.`);
    console.log(`Archivo de respaldo: ${backupFile}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Fallo en la preparación del clon: ${error.message}`);
  process.exitCode = 1;
});
