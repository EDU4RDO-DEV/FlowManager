// Copia los templates Handlebars y hojas de estilo del módulo de reportes a dist/.
// tsc solo compila archivos .ts; estos recursos (.hbs/.css) se leen en runtime con
// fs.readFileSync(__dirname, ...) por lo que deben existir junto al JS compilado.
//
// NOTA: se usa una copia recursiva manual (no fs.cpSync) porque en este entorno
// fs.cpSync falla con un crash nativo (STATUS_STACK_BUFFER_OVERRUN) cuando la ruta
// del proyecto contiene caracteres acentuados (ej. "Mariano Gálvez").
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'modules', 'reports', 'export', 'templates');
const DEST = path.join(__dirname, '..', 'dist', 'modules', 'reports', 'export', 'templates');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(SRC)) {
  console.warn(`[copy-report-templates] No existe ${SRC}, se omite la copia.`);
  process.exit(0);
}

copyRecursive(SRC, DEST);
console.log(`[copy-report-templates] Copiado ${SRC} -> ${DEST}`);
