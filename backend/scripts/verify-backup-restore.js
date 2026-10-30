/*
 * Verifica, en tres pasos no intercambiables, que un respaldo de FlowManager es utilizable:
 *   1) RESTORE VERIFYONLY  -> el archivo no está corrupto (integridad).
 *   2) RESTORE DATABASE a un nombre temporal + DBCC CHECKDB -> el respaldo es realmente restaurable.
 *   3) Comparación de conteos de filas (incluidas tablas protegidas) entre el origen y la copia restaurada.
 *
 * Un checksum o un RESTORE VERIFYONLY exitoso por sí solos NO autorizan cambios sobre la base existente;
 * solo el paso 2 completado con éxito lo hace (ver docs/MATRIZ_TAREAS_TECNICAS.md, T-F1-BASE-05).
 *
 * La base temporal de verificación siempre se elimina al finalizar, incluso si algún paso falla.
 *
 * Uso:
 *   node scripts/verify-backup-restore.js --file "C:\...\Backup\BD_FlowManager_30_10_2026.bak"
 *   node scripts/verify-backup-restore.js --latest
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

const backendPath = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendPath, '.env'), quiet: true });

const TABLES_TO_COMPARE = [
  // Tablas protegidas (ventas, pagos, créditos y FEL) — ver docs/DECISIONES_TECNICAS_PENDIENTES.md, D-BASE-05.
  'Venta',
  'DetalleVenta',
  'PagoVenta',
  'CuentaPorCobrar',
  'SolicitudPagoIdempotente',
  'ReservaProforma',
  'DevolucionComercial',
  'Talonario',
  // Muestra operativa adicional, para detectar corrupción fuera de las tablas protegidas.
  'Usuario',
  'InventarioItem',
  'RutaSesion',
];

function parseArgs(argv) {
  const options = { file: undefined, latest: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file') {
      options.file = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--file=')) {
      options.file = arg.slice('--file='.length);
    } else if (arg === '--latest') {
      options.latest = true;
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }
  if (!options.file && !options.latest) {
    throw new Error('Provide --file <ruta .bak> or --latest (usa el respaldo más reciente registrado en msdb).');
  }
  return options;
}

async function assertSourceIsFlowManager(prisma) {
  const [target] = await prisma.$queryRaw`
    SELECT DB_NAME() AS databaseName, CAST(DATABASEPROPERTYEX(DB_NAME(), 'Status') AS nvarchar(60)) AS databaseStatus
  `;
  if (target?.databaseName?.toLowerCase() !== 'flowmanager' || target?.databaseStatus !== 'ONLINE') {
    throw new Error('Esta verificación solo está autorizada contra la base FlowManager en línea.');
  }
}

async function resolveBackupFile(prisma, options) {
  if (options.file) {
    return options.file;
  }
  const [latest] = await prisma.$queryRaw`
    SELECT TOP 1 bmf.physical_device_name AS physicalDeviceName
    FROM msdb.dbo.backupset bs
    JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
    WHERE bs.database_name = 'FlowManager'
    ORDER BY bs.backup_finish_date DESC
  `;
  if (!latest) {
    throw new Error('No se encontró ningún respaldo registrado de FlowManager en msdb.dbo.backupset.');
  }
  return latest.physicalDeviceName;
}

function assertSafeFilePath(filePath) {
  if (filePath.includes("'")) {
    throw new Error("La ruta del respaldo no puede contener comillas simples (').");
  }
  return filePath;
}

async function assertDatabaseDoesNotExist(prisma, dbName) {
  const [existing] = await prisma.$queryRaw`SELECT name FROM sys.databases WHERE name = ${dbName}`;
  if (existing) {
    throw new Error(
      `${dbName} ya existe en el servidor; no se procederá para evitar sobrescribir una base existente por coincidencia de nombre.`,
    );
  }
}

function sanitizeForFileName(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const testDbName = `FlowManager_RestoreCheck_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  let restoredByThisRun = false;

  try {
    await assertSourceIsFlowManager(prisma);
    const backupFile = assertSafeFilePath(await resolveBackupFile(prisma, options));
    console.log(`Respaldo a verificar: ${backupFile}`);

    console.log('\n[1/3] RESTORE VERIFYONLY (integridad del archivo)...');
    await prisma.$executeRawUnsafe(`RESTORE VERIFYONLY FROM DISK = N'${backupFile}'`);
    console.log('  OK: el archivo de respaldo no está corrupto.');

    console.log('\n[2/3] RESTORE DATABASE a nombre temporal + DBCC CHECKDB (restaurabilidad real)...');
    await assertDatabaseDoesNotExist(prisma, testDbName);
    const fileList = await prisma.$queryRawUnsafe(`RESTORE FILELISTONLY FROM DISK = N'${backupFile}'`);
    const dataDir = path.win32.dirname(fileList.find((f) => f.Type === 'D').PhysicalName);
    const moveClauses = fileList
      .map((f) => {
        const ext = f.Type === 'L' ? 'ldf' : 'mdf';
        const uniqueSuffix = sanitizeForFileName(f.LogicalName);
        const target = path.win32.join(dataDir, `${testDbName}_${uniqueSuffix}.${ext}`);
        return `MOVE N'${f.LogicalName}' TO N'${target}'`;
      })
      .join(',\n     ');
    // Sin REPLACE: si testDbName o cualquier ruta física de destino ya existieran
    // (por ejemplo, una colisión no detectada por el chequeo anterior), SQL Server
    // debe rechazar la restauración en vez de sobrescribir silenciosamente.
    await prisma.$executeRawUnsafe(
      `RESTORE DATABASE [${testDbName}] FROM DISK = N'${backupFile}' WITH ${moveClauses}`,
    );
    // Solo a partir de aquí la base temporal fue efectivamente creada por esta ejecución;
    // el bloque "finally" NUNCA debe intentar eliminarla si no llegamos a este punto
    // (por ejemplo, si assertDatabaseDoesNotExist detectó una base preexistente con ese
    // nombre y abortó antes: esa base NO fue creada por nosotros y no debe tocarse).
    restoredByThisRun = true;
    await prisma.$executeRawUnsafe(`DBCC CHECKDB(N'${testDbName}') WITH NO_INFOMSGS`);
    console.log(`  OK: ${testDbName} restaurada y consistente (DBCC CHECKDB sin errores).`);

    console.log('\n[3/3] Comparación de conteos (origen vs. restaurada)...');
    let allMatch = true;
    for (const table of TABLES_TO_COMPARE) {
      const [origin] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM FlowManager.dbo.${table}`);
      const [restored] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM [${testDbName}].dbo.${table}`);
      const originCount = Number(origin.c);
      const restoredCount = Number(restored.c);
      const match = originCount === restoredCount;
      allMatch = allMatch && match;
      console.log(`  ${table.padEnd(26)} origen=${originCount} restaurada=${restoredCount} ${match ? 'OK' : 'DIFIERE'}`);
    }

    if (!allMatch) {
      throw new Error('Los conteos no coinciden entre el origen y la base restaurada; el respaldo NO debe considerarse verificado.');
    }

    console.log('\nResultado: respaldo VERIFICADO como restaurable. Puede autorizarse el cambio pendiente.');
  } finally {
    if (restoredByThisRun) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER DATABASE [${testDbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${testDbName}];`,
        );
      } catch (cleanupError) {
        console.error(`Advertencia: no se pudo limpiar ${testDbName} automáticamente: ${cleanupError.message}`);
      }
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Verificación de respaldo/restauración fallida: ${error.message}`);
  process.exitCode = 1;
});
