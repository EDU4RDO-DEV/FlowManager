import fs from 'fs';
import path from 'path';

import multer from 'multer';

const uploadsRoot = path.resolve(process.cwd(), 'uploads');
const productsDir = path.join(uploadsRoot, 'products');

if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, productsDir);
  },
  filename: (_req, file, callback) => {
    const baseName = path
      .parse(file.originalname)
      .name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60);

    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = `${baseName || 'producto'}-${uniqueSuffix}${extension}`;

    callback(null, safeName);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback,
) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    callback(new Error('Tipo de archivo no permitido. Solo se aceptan JPG, PNG y WEBP'));
    return;
  }

  callback(null, true);
}

export const uploadProductImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});
