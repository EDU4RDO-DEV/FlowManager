import { prisma } from '../config/prisma';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import { Prisma } from '@prisma/client';

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
  idUsuarioModificador?: number;
};

type RecipeCostEstimate = {
  idProductoTerminado: number;
  actualizarCostoSegunReceta: boolean;
  costoActual: number;
  costoCalculado: number;
  diferencia: number;
  puedeActualizar: boolean;
  motivoNoActualizable: string | null;
};

type RecipeCostPolicyInput = {
  actualizarCostoSegunReceta: boolean;
  idUsuarioModificador?: number;
};

type RecipeCostTransaction = Prisma.TransactionClient;
type StructureValidationClient = Pick<
  Prisma.TransactionClient,
  'inventarioItem' | 'estructuraProducto'
>;

function toStructureDto(structure: {
  Id: number;
  IdProductoTerminado: number;
  IdMateriaPrima: number;
  CantidadRequerida: number;
  FechaRegistro: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
    Id: number;
    Nombre: string;
    Categoria: string;
    Existencia: number;
    CostoPromedio: unknown;
    PrecioVenta: unknown;
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
    idUsuarioModificador: structure.IdUsuarioModificador,
    fechaModificacion: structure.FechaModificacion,
    anulado: structure.Anulado,
    idUsuarioAnulador: structure.IdUsuarioAnulador,
    fechaAnulacion: structure.FechaAnulacion,
    materiaPrima: {
      id: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.Id,
      nombre: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.Nombre,
      categoria: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.Categoria,
      existencia: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.Existencia,
      costoPromedio: Number(structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.CostoPromedio),
      precioVenta: Number(structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.PrecioVenta),
      rutaImagen: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.RutaImagen,
      anulado: structure.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem.Anulado,
    },
  };
}

async function validateRecipePermission(
  id: number,
  db: StructureValidationClient = prisma,
) {
  const product = await db.inventarioItem.findFirst({
    where: {
      Id: id,
      PermitirReceta: true,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (!product) {
    throw new Error('Producto no existe o no permite configurar recetas');
  }
}

async function validateMateriaPrimaExists(
  id: number,
  db: StructureValidationClient = prisma,
) {
  const product = await db.inventarioItem.findFirst({
    where: {
      Id: id,
      Anulado: false,
      Categoria: {
        in: ['MATERIA_PRIMA', 'INSUMO'],
      },
    },
    select: { Id: true },
  });

  if (!product) {
    throw new Error('El componente debe ser una materia prima o insumo activo');
  }
}

async function validateNoCircularStructure(
  idProductoTerminado: number,
  idMateriaPrima: number,
  db: StructureValidationClient = prisma,
) {
  if (idProductoTerminado === idMateriaPrima) {
    throw new Error('Un producto no puede ser componente de sí mismo');
  }

  const relations = await db.estructuraProducto.findMany({
    where: { Anulado: false },
    select: { IdProductoTerminado: true, IdMateriaPrima: true },
  });
  const componentsByProduct = new Map<number, number[]>();
  for (const relation of relations) {
    const components = componentsByProduct.get(relation.IdProductoTerminado) ?? [];
    components.push(relation.IdMateriaPrima);
    componentsByProduct.set(relation.IdProductoTerminado, components);
  }

  const pending = [idMateriaPrima];
  const visited = new Set<number>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === idProductoTerminado) {
      throw new Error('La receta generaría una dependencia circular');
    }
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(componentsByProduct.get(current) ?? []));
  }
}

async function validateUsuarioExists(idUsuario: number) {
  const user = await prisma.usuario.findFirst({
    where: {
      Id: idUsuario,
      Anulado: false,
    },
    select: { Id: true },
  });

  if (!user) {
    throw new Error('Usuario no existe');
  }
}

async function validateUniqueComponent(
  idProductoTerminado: number,
  idMateriaPrima: number,
  excludeId?: number,
  db: StructureValidationClient = prisma,
) {
  const existing = await db.estructuraProducto.findFirst({
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

async function calculateRecipeCost(
  tx: RecipeCostTransaction,
  idProductoTerminado: number,
): Promise<RecipeCostEstimate> {
  const product = await tx.inventarioItem.findFirst({
    where: { Id: idProductoTerminado, Anulado: false },
    select: {
      Id: true,
      PermitirReceta: true,
      EsVendible: true,
      ActualizarCostoSegunReceta: true,
      UnidadMedida: true,
      CostoPromedio: true,
      PrecioVenta: true,
    },
  });

  if (!product || !product.PermitirReceta) {
    throw new Error('Producto no existe o no permite configurar recetas');
  }
  if (!product.UnidadMedida?.trim()) {
    throw new Error('El producto no tiene unidad de medida configurada');
  }

  const recipe = await tx.estructuraProducto.findMany({
    where: { IdProductoTerminado: idProductoTerminado, Anulado: false },
    orderBy: { Id: 'asc' },
    include: {
      InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
        select: {
          Id: true,
          Nombre: true,
          Categoria: true,
          UnidadMedida: true,
          CostoPromedio: true,
          Anulado: true,
        },
      },
    },
  });

  if (recipe.length === 0) {
    throw new Error('La receta no tiene componentes activos');
  }

  let calculatedCost = new Prisma.Decimal(0);
  for (const entry of recipe) {
    const component = entry.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem;
    const quantity = Number(entry.CantidadRequerida);
    const unitCost = new Prisma.Decimal(component.CostoPromedio);

    if (component.Anulado || !['MATERIA_PRIMA', 'INSUMO'].includes(component.Categoria)) {
      throw new Error(`${component.Nombre} no es una materia prima o insumo activo`);
    }
    if (!component.UnidadMedida?.trim()) {
      throw new Error(`Falta definir la unidad de medida de ${component.Nombre}`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`La cantidad requerida de ${component.Nombre} no es válida`);
    }
    if (!unitCost.isFinite() || unitCost.lte(0)) {
      throw new Error(`${component.Nombre} no tiene un costo promedio válido`);
    }

    calculatedCost = calculatedCost.add(unitCost.mul(quantity));
  }

  calculatedCost = calculatedCost.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (!calculatedCost.isFinite() || calculatedCost.lte(0)) {
    throw new Error('El costo calculado de la receta no es válido');
  }

  const currentCost = new Prisma.Decimal(product.CostoPromedio).toDecimalPlaces(2);
  const canUpdate =
    !product.EsVendible || new Prisma.Decimal(product.PrecioVenta).gte(calculatedCost);

  return {
    idProductoTerminado: product.Id,
    actualizarCostoSegunReceta: product.ActualizarCostoSegunReceta,
    costoActual: currentCost.toNumber(),
    costoCalculado: calculatedCost.toNumber(),
    diferencia: calculatedCost.sub(currentCost).toNumber(),
    puedeActualizar: canUpdate,
    motivoNoActualizable: canUpdate
      ? null
      : 'El costo calculado supera el precio de venta; actualice el precio manualmente antes de cambiar el costo.',
  };
}

export async function getRecipeCostEstimate(idProductoTerminado: number) {
  return prisma.$transaction(
    (tx) => calculateRecipeCost(tx, idProductoTerminado),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateRecipeCostPolicy(
  idProductoTerminado: number,
  input: RecipeCostPolicyInput,
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.inventarioItem.findFirst({
      where: {
        Id: idProductoTerminado,
        PermitirReceta: true,
        Anulado: false,
      },
      select: { Id: true },
    });

    if (!product) {
      throw new Error('Producto no existe o no permite configurar recetas');
    }
    if (input.idUsuarioModificador !== undefined) {
      const user = await tx.usuario.findFirst({
        where: { Id: input.idUsuarioModificador, Anulado: false },
        select: { Id: true },
      });
      if (!user) {
        throw new Error('Usuario no existe');
      }
    }

    const updated = await tx.inventarioItem.update({
      where: { Id: product.Id },
      data: {
        ActualizarCostoSegunReceta: input.actualizarCostoSegunReceta,
        ...(input.idUsuarioModificador !== undefined
          ? { IdUsuarioModificador: input.idUsuarioModificador }
          : {}),
        FechaModificacion: new Date(),
      },
      select: { ActualizarCostoSegunReceta: true },
    });

    return { actualizarCostoSegunReceta: updated.ActualizarCostoSegunReceta };
  });
}

export async function applyRecipeCost(
  idProductoTerminado: number,
  expectedCurrentCost: number,
  expectedCalculatedCost: number,
  idUsuarioModificador?: number,
) {
  return prisma.$transaction(async (tx) => {
    const estimate = await calculateRecipeCost(tx, idProductoTerminado);

    if (!estimate.actualizarCostoSegunReceta) {
      throw new Error('La actualización del costo según receta está desactivada');
    }
    if (
      Math.round(estimate.costoActual * 100) !== Math.round(expectedCurrentCost * 100) ||
      Math.round(estimate.costoCalculado * 100) !== Math.round(expectedCalculatedCost * 100)
    ) {
      throw new Error('El costo o la receta cambiaron; vuelva a revisar los valores antes de confirmar');
    }
    if (!estimate.puedeActualizar) {
      throw new Error(estimate.motivoNoActualizable ?? 'No se puede actualizar el costo');
    }
    if (idUsuarioModificador !== undefined) {
      const user = await tx.usuario.findFirst({
        where: { Id: idUsuarioModificador, Anulado: false },
        select: { Id: true },
      });
      if (!user) {
        throw new Error('Usuario no existe');
      }
    }

    await tx.inventarioItem.update({
      where: { Id: idProductoTerminado },
      data: {
        CostoPromedio: estimate.costoCalculado,
        ...(idUsuarioModificador !== undefined ? { IdUsuarioModificador: idUsuarioModificador } : {}),
        FechaModificacion: new Date(),
      },
    });

    return {
      ...estimate,
      costoActual: estimate.costoCalculado,
      diferencia: 0,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listStructureByProduct(input: ListStructureByProductInput) {
  await validateRecipePermission(input.idProducto);

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
          RutaImagen: true,
          Anulado: true,
        },
      },
    },
  });

  return structures.map(toStructureDto);
}

export async function listAnulatedStructureByProduct(idProducto: number) {
  await validateRecipePermission(idProducto);

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
  const created = await runSerializableTransaction(async (tx) => {
    await validateRecipePermission(input.idProductoTerminado, tx);
    await validateMateriaPrimaExists(input.idMateriaPrima, tx);
    await validateNoCircularStructure(input.idProductoTerminado, input.idMateriaPrima, tx);
    await validateUniqueComponent(
      input.idProductoTerminado,
      input.idMateriaPrima,
      undefined,
      tx,
    );

    return tx.estructuraProducto.create({
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
            RutaImagen: true,
            Anulado: true,
          },
        },
      },
    });
  });

  return toStructureDto(created);
}

export async function updateProductStructure(id: number, input: UpdateProductStructureInput) {
  const existing = await prisma.estructuraProducto.findFirst({
    where: { Id: id, Anulado: false },
    select: {
      Id: true,
      IdProductoTerminado: true,
      IdMateriaPrima: true,
    },
  });

  if (!existing) {
    throw new Error('Componente de estructura no existe');
  }

  await validateRecipePermission(existing.IdProductoTerminado);
  await validateMateriaPrimaExists(existing.IdMateriaPrima);

  if (input.idUsuarioModificador !== undefined) {
    await validateUsuarioExists(input.idUsuarioModificador);
  }

  const updated = await prisma.estructuraProducto.update({
    where: { Id: id },
    data: {
      ...(input.cantidadRequerida !== undefined
        ? { CantidadRequerida: input.cantidadRequerida }
        : {}),
      ...(input.idUsuarioModificador !== undefined
        ? { IdUsuarioModificador: input.idUsuarioModificador }
        : {}),
      FechaModificacion: new Date(),
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
          RutaImagen: true,
          Anulado: true,
        },
      },
    },
  });

  return toStructureDto(updated);
}

export async function deleteProductStructure(id: number, idUsuarioAnulador?: number) {
  const existing = await prisma.estructuraProducto.findFirst({
    where: { Id: id, Anulado: false },
    select: { Id: true },
  });

  if (!existing) {
    throw new Error('Componente de estructura no existe');
  }

  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await prisma.estructuraProducto.update({
    where: { Id: id },
    data: {
      Anulado: true,
      IdUsuarioAnulador: idUsuarioAnulador,
      FechaAnulacion: new Date(),
    },
  });
}

export async function restoreProductStructure(id: number, idUsuarioModificador?: number) {
  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  const restored = await runSerializableTransaction(async (tx) => {
    const existing = await tx.estructuraProducto.findFirst({
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

    await validateRecipePermission(existing.IdProductoTerminado, tx);
    await validateMateriaPrimaExists(existing.IdMateriaPrima, tx);
    await validateNoCircularStructure(existing.IdProductoTerminado, existing.IdMateriaPrima, tx);
    await validateUniqueComponent(
      existing.IdProductoTerminado,
      existing.IdMateriaPrima,
      id,
      tx,
    );

    return tx.estructuraProducto.update({
      where: { Id: id },
      data: {
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        ...(idUsuarioModificador !== undefined ? { IdUsuarioModificador: idUsuarioModificador } : {}),
        FechaModificacion: new Date(),
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
            RutaImagen: true,
            Anulado: true,
          },
        },
      },
    });
  });

  return toStructureDto(restored);
}
