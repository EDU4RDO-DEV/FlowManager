import { prisma } from '../config/prisma';

type ListProductsInput = {
  page?: number;
  limit?: number;
  busqueda?: string;
  categoria?: string;
  esProductoFinal?: boolean;
  anulado?: boolean;
  idProveedor?: number;
};

type CreateProductInput = {
  idUsuario: number;
  idProveedor: number;
  nombre: string;
  categoria: string;
  costoPromedio: number;
  precioVenta: number;
  esProductoFinal: boolean;
  rutaImagen?: string;
};

type UpdateProductInput = {
  idUsuario?: number;
  idUsuarioModificador?: number;
  idProveedor?: number;
  nombre?: string;
  categoria?: string;
  costoPromedio?: number;
  precioVenta?: number;
  esProductoFinal?: boolean;
  rutaImagen?: string;
};

function toProductDto(product: {
  Id: number;
  IdUsuario: number;
  IdProveedor: number;
  Nombre: string;
  Categoria: string;
  Existencia: number;
  CostoPromedio: unknown;
  PrecioVenta: unknown;
  EsProductoFinal: boolean;
  RutaImagen: string | null;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  Proveedor: {
    Id: number;
    Nombre: string;
    Anulado: boolean;
  };
}) {
  return {
    id: product.Id,
    idUsuario: product.IdUsuario,
    idProveedor: product.IdProveedor,
    nombre: product.Nombre,
    categoria: product.Categoria,
    existencia: product.Existencia,
    costoPromedio: Number(product.CostoPromedio),
    precioVenta: Number(product.PrecioVenta),
    esProductoFinal: product.EsProductoFinal,
    rutaImagen: product.RutaImagen,
    fechaRegistro: product.FechaRegistro,
    idUsuarioModificador: product.IdUsuarioModificador,
    fechaModificacion: product.FechaModificacion,
    anulado: product.Anulado,
    idUsuarioAnulador: product.IdUsuarioAnulador,
    fechaAnulacion: product.FechaAnulacion,
    proveedor: {
      id: product.Proveedor.Id,
      nombre: product.Proveedor.Nombre,
      anulado: product.Proveedor.Anulado,
    },
  };
}

async function validateUsuarioExists(idUsuario: number) {
  const usuario = await prisma.usuario.findFirst({
    where: { Id: idUsuario, Anulado: false },
    select: { Id: true },
  });

  if (!usuario) {
    throw new Error('Usuario no existe');
  }
}

async function validateProveedorExists(idProveedor: number) {
  const proveedor = await prisma.proveedor.findFirst({
    where: {
      Id: idProveedor,
      Anulado: false,
      Entidad: {
        Anulado: false,
      },
    },
    select: { Id: true },
  });

  if (!proveedor) {
    throw new Error('Proveedor no existe');
  }
}

async function validateUniqueNameInCategory(nombre: string, categoria: string, excludeId?: number) {
  const existing = await prisma.inventarioItem.findFirst({
    where: {
      Nombre: nombre,
      Categoria: categoria,
      ...(excludeId !== undefined ? { NOT: { Id: excludeId } } : {}),
    },
    select: { Id: true, Anulado: true },
  });

  if (existing && !existing.Anulado) {
    throw new Error('Ya existe un producto activo con el mismo nombre y categoría');
  }
}

async function validateProductCanBeAnulated(id: number) {
  const [movementCount, structureCount] = await Promise.all([
    prisma.bitacoraInventario.count({
      where: {
        IdInventarioItem: id,
        Anulado: false,
      },
    }),
    prisma.estructuraProducto.count({
      where: {
        Anulado: false,
        OR: [{ IdProductoTerminado: id }, { IdMateriaPrima: id }],
      },
    }),
  ]);

  if (movementCount > 0) {
    throw new Error('No se puede anular porque tiene movimientos registrados en bitácora');
  }

  if (structureCount > 0) {
    throw new Error('No se puede anular porque participa en una estructura de producto activa');
  }
}

export async function listProducts(input: ListProductsInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(input.anulado !== undefined ? { Anulado: input.anulado } : { Anulado: false }),
    ...(input.categoria !== undefined ? { Categoria: input.categoria } : {}),
    ...(input.esProductoFinal !== undefined ? { EsProductoFinal: input.esProductoFinal } : {}),
    ...(input.idProveedor !== undefined ? { IdProveedor: input.idProveedor } : {}),
    ...(input.busqueda
      ? {
          Nombre: {
            contains: input.busqueda,
          },
        }
      : {}),
  };

  const [total, products] = await Promise.all([
    prisma.inventarioItem.count({ where }),
    prisma.inventarioItem.findMany({
      where,
      orderBy: { Id: 'desc' },
      skip,
      take: limit,
      include: {
        Proveedor: {
          select: {
            Id: true,
            Nombre: true,
            Anulado: true,
          },
        },
      },
    }),
  ]);

  return {
    items: products.map(toProductDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function listAnulatedProducts() {
  const products = await prisma.inventarioItem.findMany({
    where: {
      Anulado: true,
    },
    orderBy: { FechaAnulacion: 'desc' },
    include: {
      Proveedor: {
        select: {
          Id: true,
          Nombre: true,
          Anulado: true,
        },
      },
    },
  });

  return products.map(toProductDto);
}

export async function getProductById(id: number) {
  const product = await prisma.inventarioItem.findFirst({
    where: { Id: id, Anulado: false },
    include: {
      Proveedor: {
        select: {
          Id: true,
          Nombre: true,
          Anulado: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error('Producto no existe');
  }

  return toProductDto(product);
}

export async function createProduct(input: CreateProductInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateProveedorExists(input.idProveedor);
  await validateUniqueNameInCategory(input.nombre, input.categoria);

  const created = await prisma.inventarioItem.create({
    data: {
      IdUsuario: input.idUsuario,
      IdProveedor: input.idProveedor,
      Nombre: input.nombre,
      Categoria: input.categoria,
      Existencia: 0,
      CostoPromedio: input.costoPromedio,
      PrecioVenta: input.precioVenta,
      EsProductoFinal: input.esProductoFinal,
      RutaImagen: input.rutaImagen,
      Anulado: false,
    },
    include: {
      Proveedor: {
        select: {
          Id: true,
          Nombre: true,
          Anulado: true,
        },
      },
    },
  });

  return toProductDto(created);
}

export async function updateProduct(id: number, input: UpdateProductInput) {
  const existing = await prisma.inventarioItem.findFirst({
    where: { Id: id, Anulado: false },
    select: {
      Id: true,
      Nombre: true,
      Categoria: true,
      CostoPromedio: true,
      PrecioVenta: true,
    },
  });

  if (!existing) {
    throw new Error('Producto no existe');
  }

  if (input.idUsuario !== undefined) {
    await validateUsuarioExists(input.idUsuario);
  }

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  if (input.idProveedor !== undefined) {
    await validateProveedorExists(input.idProveedor);
  }

  const nextNombre = input.nombre ?? existing.Nombre;
  const nextCategoria = input.categoria ?? existing.Categoria;
  await validateUniqueNameInCategory(nextNombre, nextCategoria, id);

  const costoPromedio = input.costoPromedio ?? Number(existing.CostoPromedio);
  const precioVenta = input.precioVenta ?? Number(existing.PrecioVenta);

  if (precioVenta < costoPromedio) {
    throw new Error('precioVenta debe ser mayor o igual a costoPromedio');
  }

  const updated = await prisma.inventarioItem.update({
    where: { Id: id },
    data: {
      ...(input.idUsuario !== undefined ? { IdUsuario: input.idUsuario } : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      ...(input.idProveedor !== undefined ? { IdProveedor: input.idProveedor } : {}),
      ...(input.nombre !== undefined ? { Nombre: input.nombre } : {}),
      ...(input.categoria !== undefined ? { Categoria: input.categoria } : {}),
      ...(input.costoPromedio !== undefined ? { CostoPromedio: input.costoPromedio } : {}),
      ...(input.precioVenta !== undefined ? { PrecioVenta: input.precioVenta } : {}),
      ...(input.esProductoFinal !== undefined
        ? { EsProductoFinal: input.esProductoFinal }
        : {}),
      ...(input.rutaImagen !== undefined ? { RutaImagen: input.rutaImagen } : {}),
      FechaModificacion: new Date(),
    },
    include: {
      Proveedor: {
        select: {
          Id: true,
          Nombre: true,
          Anulado: true,
        },
      },
    },
  });

  return toProductDto(updated);
}

export async function deleteProduct(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.inventarioItem.findFirst({
    where: { Id: id, Anulado: false },
    select: {
      Id: true,
      Existencia: true,
    },
  });

  if (!existing) {
    throw new Error('Producto no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  if (existing.Existencia > 0) {
    throw new Error('No se puede anular un producto con existencia mayor a 0');
  }

  await validateProductCanBeAnulated(id);

  await prisma.inventarioItem.update({
    where: { Id: id },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreProduct(id: number, idUsuarioModificador?: number) {
  const existing = await prisma.inventarioItem.findFirst({
    where: { Id: id, Anulado: true },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Producto anulado no existe');
  }

  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const restored = await prisma.inventarioItem.update({
    where: { Id: id },
    data: {
      Anulado: false,
      ...(idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    },
    include: {
      Proveedor: {
        select: {
          Id: true,
          Nombre: true,
          Anulado: true,
        },
      },
    },
  });

  return toProductDto(restored);
}
