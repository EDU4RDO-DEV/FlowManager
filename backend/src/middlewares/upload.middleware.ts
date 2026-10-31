import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';

import multer from 'multer';

const uploadsRoot = path.resolve(process.cwd(), 'uploads');
const productsDir = path.join(uploadsRoot, 'products');
const clientsDir = path.join(uploadsRoot, 'clients');
const employeesDir = path.join(uploadsRoot, 'employees');
const providersDir = path.join(uploadsRoot, 'providers');
const vehiclesDir = path.join(uploadsRoot, 'vehicles');
const salesDir = path.join(uploadsRoot, 'sales');
const companyLogosDir = path.join(uploadsRoot, 'company-logos');
const payrollPaymentsDir = path.join(uploadsRoot, 'payroll-payments');

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

if (!fs.existsSync(vehiclesDir)) {
  fs.mkdirSync(vehiclesDir, { recursive: true });
}

if (!fs.existsSync(salesDir)) {
  fs.mkdirSync(salesDir, { recursive: true });
}

if (!fs.existsSync(companyLogosDir)) {
  fs.mkdirSync(companyLogosDir, { recursive: true });
}

if (!fs.existsSync(payrollPaymentsDir)) {
  fs.mkdirSync(payrollPaymentsDir, { recursive: true });
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
export const uploadVehicleExpenseImage = createImageUploader(vehiclesDir, 'vehiculo-gasto');
export const uploadSaleProofImage = createImageUploader(salesDir, 'talonario');

const payrollReceiptExtensions: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const uploadPayrollPaymentReceipt = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, payrollPaymentsDir),
    filename: (_req, file, callback) => {
      const extension = payrollReceiptExtensions[file.mimetype];
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!payrollReceiptExtensions[file.mimetype]) {
      callback(new Error('El comprobante debe ser PDF, JPG, PNG o WEBP'));
      return;
    }
    callback(null, true);
  },
});

export { payrollPaymentsDir };

export const uploadCompanyLogo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});
