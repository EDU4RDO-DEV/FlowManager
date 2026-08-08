import { prisma } from '../config/prisma';

type ListStructureByProductInput = {
  idProducto: number;
  anulado?: boolean;
};

type CreateProductStructureInput = {
  idProductoTerminado: number;
  idMateriaPrima: number;
  cantidadRequerida: number;
};

type UpdateProductStructureInput = {
  cantidadRequerida?: number;
};

function toStructureDto(structure: {
  Id: number;
  IdProductoTerminado: number;
  IdMateriaPrima: number;
  CantidadRequerida: number;
  FechaRegistro: Date | null;
  Anulado: boolean;
  InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
    Id: number;
    Nombre: string;
    Categoria: string;
    Existencia: number;
    CostoPromedio: unknown;
    PrecioVenta: unknown;
    EsProductoFinal: boolean;
    RutaImagen: string | null;
    Anulado: boolean;
  };
}) {
  return {
    id: structure.Id,
    idProductoTerminado: structure.IdProductoTerminado,
    idMateriaPrima: structure.IdMateriaPrima,
    cantidadRequerida: structure.CantidadRequerida,
    fechaRegistro: structure.FechaRegistro,
    anulado: structure.Anulado,
    materiaPrima: {
      id: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.Id,
      nombre: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.Nombre,
      categoria: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.Categoria,
      existencia: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.Existencia,
      costoPromedio: Number(structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.CostoPromedio),
      precioVenta: Number(structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.PrecioVenta),
      esProductoFinal: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.EsProductoFinal,
      rutaImagen: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.RutaImagen,
      anulado: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.Anulado,
    },
  };
}

async function validateProductoTerminadoExists(id: number) {
  const product = await prisma.inventarioItem.findFirst({
    where: {
      Id: id,
      EsProductoFinal: true,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (!product) {
    throw new Error('Producto terminado no existe o no es un producto final');
  }
}

async function validateMateriaPrimaExists(id: number) {
  const product = await prisma.inventarioItem.findFirst({
    where: {
      Id: id,
      Anulado: false,
      Categoria: {
        in: ['MATERIA_PRIMA', 'INSUMO', 'ENVASE'],
      },
    },
    select: { Id: true },
  });

  if (!product) {
    throw new Error('El componente debe ser una materia prima, insumo o envase activo');
  }
}

async function validateNotCircular(idProductoTerminado: number, idMateriaPrima: number) {
  if (idProductoTerminado === idMateriaPrima) {
    throw new Error('Un producto no puede ser componente de sí mismo');
  }
}

async function validateUniqueComponent(
  idProductoTerminado: number,
  idMateriaPrima: number,
  excludeId?: number,
) {
  const existing = await prisma.estructuraProducto.findFirst({
    where: {
      IdProductoTerminado: idProductoTerminado,
      IdMateriaPrima: idMateriaPrima,
      Anulado: false,
      ...(excludeId !== undefined ? { NOT: { Id: excludeId } } : {}),
    },
    select: { Id: true },
  });

  if (existing) {
    throw new Error('Este componente ya existe en la estructura del producto');
  }
}

export async function listStructureByProduct(input: ListStructureByProductInput) {
  await validateProductoTerminadoExists(input.idProducto);

  const structures = await prisma.estructuraProducto.findMany({
    where: {
      IdProductoTerminado: input.idProducto,
      ...(input.anulado !== undefined ? { Anulado: input.anulado } : { Anulado: false }),
    },
    orderBy: { Id: 'asc' },
    include: {
      InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
        select: {
          Id: true,
          Nombre: true,
          Categoria: true,
          Existencia: true,
          CostoPromedio: true,
          PrecioVenta: true,
          EsProductoFinal: true,
          RutaImagen: true,
          Anulado: true,
        },
      },
    },
  });

  return structures.map(toStructureDto);
}

export async function listAnulatedStructureByProduct(idProducto: number) {
  await validateProductoTerminadoExists(idProducto);

  const structures = await prisma.estructuraProducto.findMany({
    where: {
      IdProductoTerminado: idProducto,
      Anulado: true,
    },
    orderBy: { Id: 'desc' },
    include: {
      InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
        select: {
          Id: true,
          Nombre: true,
          Categoria: true,
          Existencia: true,
          CostoPromedio: true,
          PrecioVenta: true,
          EsProductoFinal: true,
          RutaImagen: true,
          Anulado: true,
        },
      },
    },
  });

  return structures.map(toStructureDto);
}

export async function getStructureById(id: number) {
  const structure = await prisma.estructuraProducto.findFirst({
    where: { Id: id, Anulado: false },
    include: {
      InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
        select: {
          Id: true,
          Nombre: true,
          Categoria: true,
          Existencia: true,
          CostoPromedio: true,
          PrecioVenta: true,
          EsProductoFinal: true,
          RutaImagen: true,
          Anulado: true,
        },
      },
    },
  });

  if (!structure) {
    throw new Error('Componente de estructura no existe');
  }

  return toStructureDto(structure);
}

export async function createProductStructure(input: CreateProductStructureInput) {
  await validateProductoTerminadoExists(input.idProductoTerminado);
  await validateMateriaPrimaExists(input.idMateriaPrima);
  await validateNotCircular(input.idProductoTerminado, input.idMateriaPrima);
  await validateUniqueComponent(input.idProductoTerminado, input.idMateriaPrima);

  const created = await prisma.estructuraProducto.create({
    data: {
      IdProductoTerminado: input.idProductoTerminado,
      IdMateriaPrima: input.idMateriaPrima,
      CantidadRequerida: input.cantidadRequerida,
      Anulado: false,
    },
    include: {
      InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
        select: {
          Id: true,
          Nombre: true,
          Categoria: true,
          Existencia: true,
          CostoPromedio: true,
          PrecioVenta: true,
          EsProductoFinal: true,
          RutaImagen: true,
          Anulado: true,
        },
      },
    },
  });

  return toStructureDto(created);
}

export async function updateProductStructure(id: number, input: UpdateProductStructureInput) {
  const existing = await prisma.estructuraProducto.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Componente de estructura no existe');
  }

  const updated = await prisma.estructuraProducto.update({
    where: { Id: id },
    data: {
      ...(input.cantidadRequerida !== undefined
        ? { CantidadRequerida: input.cantidadRequerida }
        : {}),
    },
    include: {
      InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
        select: {
          Id: true,
          Nombre: true,
          Categoria: true,
          Existencia: true,
          CostoPromedio: true,
          PrecioVenta: true,
          EsProductoFinal: true,
          RutaImagen: true,
          Anulado: true,
        },
      },
    },
  });

  return toStructureDto(updated);
}

export async function deleteProductStructure(id: number) {
  const existing = await prisma.estructuraProducto.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Componente de estructura no existe');
  }

  await prisma.estructuraProducto.update({
    where: { Id: id },
    data: {
      Anulado: true,
    },
  });
}

export async function restoreProductStructure(id: number) {
  const existing = await prisma.estructuraProducto.findFirst({
    where: { Id: id, Anulado: true },
    select: {
      Id: true,
      IdProductoTerminado: true,
      IdMateriaPrima: true,
    },
  });

  if (!existing) {
    throw new Error('Componente anulado no existe');
  }

  await validateProductoTerminadoExists(existing.IdProductoTerminado);
  await validateMateriaPrimaExists(existing.IdMateriaPrima);
  await validateUniqueComponent(existing.IdProductoTerminado, existing.IdMateriaPrima, id);

  const restored = await prisma.estructuraProducto.update({
    where: { Id: id },
    data: {
      Anulado: false,
    },
    include: {
      InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
        select: {
          Id: true,
          Nombre: true,
          Categoria: true,
          Existencia: true,
          CostoPromedio: true,
          PrecioVenta: true,
          EsProductoFinal: true,
          RutaImagen: true,
          Anulado: true,
        },
      },
    },
  });

  return toStructureDto(restored);
}
