import fs from 'fs';
import path from 'path';

import multer from 'multer';

const uploadsRoot = path.resolve(process.cwd(), 'uploads');
const productsDir = path.join(uploadsRoot, 'products');
const clientsDir = path.join(uploadsRoot, 'clients');
const employeesDir = path.join(uploadsRoot, 'employees');
const providersDir = path.join(uploadsRoot, 'providers');

if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
}

if (!fs.existsSync(clientsDir)) {
  fs.mkdirSync(clientsDir, { recursive: true });
}

if (!fs.existsSync(employeesDir)) {
  fs.mkdirSync(employeesDir, { recursive: true });
}

if (!fs.existsSync(providersDir)) {
  fs.mkdirSync(providersDir, { recursive: true });
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

function createEntityStorage(targetDir: string, fallbackName: string) {
  return multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, targetDir);
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
      const safeName = `${baseName || fallbackName}-${uniqueSuffix}${extension}`;

      callback(null, safeName);
    },
  });
}

function createImageUploader(targetDir: string, fallbackName: string) {
  return multer({
    storage: createEntityStorage(targetDir, fallbackName),
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter,
  });
}

export const uploadClientImage = createImageUploader(clientsDir, 'cliente');
export const uploadEmployeeImage = createImageUploader(employeesDir, 'empleado');
export const uploadProviderImage = createImageUploader(providersDir, 'proveedor');
