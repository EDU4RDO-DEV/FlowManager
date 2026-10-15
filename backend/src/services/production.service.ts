import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { buildPaginationMeta, resolvePagination } from '../utils/pagination';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import { registerInventoryMovement } from './inventory-movement.service';

type ListProductionOrdersInput = {
  page?: number;
  limit?: number;
  busqueda?: string;
  estado?: 'PENDIENTE' | 'FABRICADA' | 'CANCELADA';
};

type CreateProductionOrderInput = {
  idProductoTerminado: number;
  cantidadProducir: number;
  idUsuario: number;
};

type RecipeComponentInput = {
  idInventarioItem: number;
  nombre: string;
  cantidadPorUnidad: number;
  unidadMedida: string;
  existencia: number;
};

export function calculateProductionRequirements(
  cantidadProducir: number,
  recipe: RecipeComponentInput[],
) {
  if (!Number.isFinite(cantidadProducir) || cantidadProducir <= 0) {
    throw new Error('La cantidad a producir debe ser mayor a 0');
  }

  if (recipe.length === 0) {
    throw new Error('El producto no tiene una receta activa');
  }

  return recipe.map((component) => {
    if (!Number.isFinite(component.cantidadPorUnidad) || component.cantidadPorUnidad <= 0) {
      throw new Error(`La receta de ${component.nombre} tiene una cantidad inválida`);
    }
    if (!component.unidadMedida.trim()) {
      throw new Error(`Falta definir la unidad de medida de ${component.nombre}`);
    }

    const cantidadRequerida = cantidadProducir * component.cantidadPorUnidad;
    if (!Number.isFinite(cantidadRequerida) || cantidadRequerida <= 0) {
      throw new Error(`El consumo calculado para ${component.nombre} no es válido`);
    }

    return {
      ...component,
      cantidadRequerida,
      saldoProyectado: component.existencia - cantidadRequerida,
    };
  });
}

const orderInclude = {
  InventarioItem: {
    select: {
      Id: true,
      Nombre: true,
      UnidadMedida: true,
    },
  },
  Detalles: {
    orderBy: { Id: 'asc' as const },
    include: {
      InventarioItem: {
        select: {
          Id: true,
          Nombre: true,
        },
      },
    },
  },
};

function toProductionOrderDto(
  order: Prisma.OrdenProduccionGetPayload<{ include: typeof orderInclude }>,
) {
  return {
    id: order.Id,
    idProductoTerminado: order.IdProductoTerminado,
    productoTerminado: {
      id: order.InventarioItem.Id,
      nombre: order.NombreProductoTerminadoSnapshot,
    },
    cantidadProducir: order.CantidadProducir,
    unidadMedida: order.UnidadMedidaSnapshot,
    estado: order.Estado,
    fechaRegistro: order.FechaRegistro,
    detalles: order.Detalles.map((detail) => ({
      idInventarioItem: detail.IdInventarioItem,
      nombre: detail.NombreSnapshot,
      cantidadPorUnidad: detail.CantidadPorUnidad,
      cantidadRequerida: detail.CantidadTotal,
      unidadMedida: detail.UnidadMedidaSnapshot,
    })),
  };
}

export async function listProductionRecipes() {
  const products = await prisma.inventarioItem.findMany({
    where: {
      Categoria: 'PRODUCTO_TERMINADO',
      Anulado: false,
    },
    orderBy: { Nombre: 'asc' },
    select: {
      Id: true,
      Nombre: true,
      Existencia: true,
      UnidadMedida: true,
      EstructuraProducto_EstructuraProducto_IdProductoTerminadoToInventarioItem: {
        where: { Anulado: false },
        orderBy: { Id: 'asc' },
        select: {
          CantidadRequerida: true,
          InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
            select: {
              Id: true,
              Nombre: true,
              Categoria: true,
              Existencia: true,
              UnidadMedida: true,
              Anulado: true,
            },
          },
        },
      },
    },
  });

  return products.map((product) => {
    const details = product.EstructuraProducto_EstructuraProducto_IdProductoTerminadoToInventarioItem;
    const components = details.map((detail) => {
      const item = detail.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem;
      return {
        idInventarioItem: item.Id,
        nombre: item.Nombre,
        categoria: item.Categoria,
        cantidadPorUnidad: detail.CantidadRequerida,
        unidadMedida: item.UnidadMedida,
        existencia: item.Existencia,
        activo: !item.Anulado,
      };
    });
    const errores = [
      ...(!product.UnidadMedida?.trim() ? ['Falta definir la unidad del producto terminado'] : []),
      ...(components.length === 0 ? ['No tiene receta activa'] : []),
      ...components
        .filter(
          (component) =>
            !component.activo ||
            !['MATERIA_PRIMA', 'INSUMO'].includes(component.categoria) ||
            !component.unidadMedida?.trim() ||
            !Number.isFinite(component.cantidadPorUnidad) ||
            component.cantidadPorUnidad <= 0,
        )
        .map((component) => `${component.nombre}: componente inactivo, inválido o sin unidad de medida`),
    ];

    return {
      id: product.Id,
      nombre: product.Nombre,
      existencia: product.Existencia,
      unidadMedida: product.UnidadMedida,
      componentes: components,
      aptoParaProduccion: errores.length === 0,
      errores,
    };
  });
}

export async function listProductionOrders(input: ListProductionOrdersInput) {
  const { page, limit, skip } = resolvePagination(input);
  const normalizedSearch = input.busqueda?.trim();
  const numericId = normalizedSearch && /^\d+$/.test(normalizedSearch) ? Number(normalizedSearch) : null;
  const where: Prisma.OrdenProduccionWhereInput = {
    ...(input.estado ? { Estado: input.estado } : {}),
    ...(normalizedSearch
      ? {
          OR: [
            ...(numericId !== null ? [{ Id: numericId }] : []),
            { InventarioItem: { Nombre: { contains: normalizedSearch } } },
          ],
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.ordenProduccion.count({ where }),
    prisma.ordenProduccion.findMany({
      where,
      orderBy: { Id: 'desc' },
      skip,
      take: limit,
      include: orderInclude,
    }),
  ]);

  return {
    items: orders.map(toProductionOrderDto),
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function getProductionOrder(id: number) {
  const order = await prisma.ordenProduccion.findUnique({
    where: { Id: id },
    include: orderInclude,
  });

  if (!order) {
    throw new Error('Orden de producción no existe');
  }

  const movements = await prisma.bitacoraInventario.findMany({
    where: {
      TipoDocumento: 'PROD',
      Documento: id.toString(),
      UbicacionEnvase: null,
    },
    orderBy: { Id: 'asc' },
    select: {
      Id: true,
      IdInventarioItem: true,
      Nombre: true,
      TipoMovimiento: true,
      ExistenciaAnterior: true,
      Cantidad: true,
      NuevaExistencia: true,
      FechaRegistro: true,
      Anulado: true,
    },
  });
  const orderDto = toProductionOrderDto(order);
  const unitsByInventoryItem = new Map<number, string>([
    [orderDto.idProductoTerminado, orderDto.unidadMedida],
    ...orderDto.detalles.map((detail) => [detail.idInventarioItem, detail.unidadMedida] as [number, string]),
  ]);

  return {
    ...orderDto,
    movimientos: movements.map((movement) => ({
      id: movement.Id,
      idInventarioItem: movement.IdInventarioItem,
      nombre: movement.Nombre,
      tipo: movement.TipoMovimiento ? 'ENTRADA' as const : 'CONSUMO' as const,
      cantidad: movement.Cantidad,
      existenciaAnterior: movement.ExistenciaAnterior,
      nuevaExistencia: movement.NuevaExistencia,
      unidadMedida: unitsByInventoryItem.get(movement.IdInventarioItem) ?? null,
      fechaRegistro: movement.FechaRegistro,
      anulado: movement.Anulado,
    })),
  };
}

export async function createProductionOrder(input: CreateProductionOrderInput) {
  return runSerializableTransaction(async (tx) => {
    const product = await tx.inventarioItem.findFirst({
      where: {
        Id: input.idProductoTerminado,
        Categoria: 'PRODUCTO_TERMINADO',
        Anulado: false,
      },
      select: { Id: true, Nombre: true, UnidadMedida: true },
    });
    if (!product) {
      throw new Error('Producto terminado no existe o está inactivo');
    }
    if (!product.UnidadMedida?.trim()) {
      throw new Error('Falta definir la unidad de medida del producto terminado');
    }

    const recipe = await tx.estructuraProducto.findMany({
      where: {
        IdProductoTerminado: product.Id,
        Anulado: false,
      },
      orderBy: { Id: 'asc' },
      include: {
        InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem: {
          select: {
            Id: true,
            Nombre: true,
            Categoria: true,
            Existencia: true,
            UnidadMedida: true,
            Anulado: true,
          },
        },
      },
    });
    if (recipe.length === 0) {
      throw new Error('El producto no tiene una receta activa');
    }

    const componentInputs = recipe.map((entry) => {
      const item = entry.InventarioItem_EstructuraProducto_IdMateriaPrimaToInventarioItem;
      if (item.Anulado || !['MATERIA_PRIMA', 'INSUMO'].includes(item.Categoria)) {
        throw new Error(`${item.Nombre} no es una materia prima o insumo activo`);
      }
      if (!item.UnidadMedida?.trim()) {
        throw new Error(`Falta definir la unidad de medida de ${item.Nombre}`);
      }
      return {
        idInventarioItem: item.Id,
        nombre: item.Nombre,
        cantidadPorUnidad: entry.CantidadRequerida,
        unidadMedida: item.UnidadMedida,
        existencia: item.Existencia,
      };
    });
    const requirements = calculateProductionRequirements(input.cantidadProducir, componentInputs);

    const order = await tx.ordenProduccion.create({
      data: {
        IdProductoTerminado: product.Id,
        NombreProductoTerminadoSnapshot: product.Nombre,
        CantidadProducir: input.cantidadProducir,
        UnidadMedidaSnapshot: product.UnidadMedida.trim(),
        Estado: 'PENDIENTE',
        IdUsuario: input.idUsuario,
        Anulado: false,
        Detalles: {
          create: requirements.map((item) => ({
            IdInventarioItem: item.idInventarioItem,
            NombreSnapshot: item.nombre,
            CantidadPorUnidad: item.cantidadPorUnidad,
            CantidadTotal: item.cantidadRequerida,
            UnidadMedidaSnapshot: item.unidadMedida.trim(),
          })),
        },
      },
      include: orderInclude,
    });

    return toProductionOrderDto(order);
  });
}

export async function confirmProductionOrder(
  id: number,
  idUsuario: number,
  allowNegativeStock: boolean,
) {
  return runSerializableTransaction(async (tx) => {
    const order = await tx.ordenProduccion.findUnique({
      where: { Id: id },
      include: {
        ...orderInclude,
        Detalles: {
          orderBy: { Id: 'asc' },
          include: {
            InventarioItem: {
              select: { Id: true, Nombre: true, Categoria: true, UnidadMedida: true, Existencia: true, Anulado: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Orden de producción no existe');
    }
    if (order.Anulado || order.Estado !== 'PENDIENTE') {
      throw new Error('La orden ya fue confirmada o cancelada');
    }

    const existingMovements = await tx.bitacoraInventario.count({
      where: { TipoDocumento: 'PROD', Documento: id.toString() },
    });
    if (existingMovements > 0) {
      throw new Error('La orden ya tiene movimientos de inventario asociados');
    }

    const finished = await tx.inventarioItem.findFirst({
      where: {
        Id: order.IdProductoTerminado,
        Categoria: 'PRODUCTO_TERMINADO',
        Anulado: false,
      },
      select: {
        Id: true,
        Nombre: true,
        Existencia: true,
        UnidadMedida: true,
      },
    });
    if (!finished) {
      throw new Error('Producto terminado no existe o está inactivo');
    }
    if (finished.UnidadMedida?.trim().toLocaleUpperCase() !== order.UnidadMedidaSnapshot.trim().toLocaleUpperCase()) {
      throw new Error('La unidad del producto terminado cambió; crea una nueva orden');
    }

    const components = order.Detalles.map((detail) => {
      const item = detail.InventarioItem;
      if (item.Anulado || !['MATERIA_PRIMA', 'INSUMO'].includes(item.Categoria)) {
        throw new Error(`${item.Nombre} ya no es una materia prima o insumo activo`);
      }
      if (item.UnidadMedida?.trim().toLocaleUpperCase() !== detail.UnidadMedidaSnapshot.trim().toLocaleUpperCase()) {
        throw new Error(`La unidad de ${item.Nombre} cambió; crea una nueva orden`);
      }
      return { detail, item };
    });

    const componentMovements = components.map(({ detail, item }) => {
      const nuevaExistencia = item.Existencia - detail.CantidadTotal;
      if (nuevaExistencia < 0 && !allowNegativeStock) {
        throw new Error(
          `Existencia insuficiente para ${item.Nombre}. Disponible ${item.Existencia} ${detail.UnidadMedidaSnapshot}; requerido ${detail.CantidadTotal} ${detail.UnidadMedidaSnapshot}`,
        );
      }

      return { detail, item, nuevaExistencia };
    });

    for (const { detail, item, nuevaExistencia } of componentMovements) {
      await tx.inventarioItem.update({
        where: { Id: item.Id },
        data: { Existencia: nuevaExistencia },
      });
      await registerInventoryMovement(tx, {
        idInventarioItem: item.Id,
        idUsuario,
        tipoDocumento: 'PROD',
        documento: id.toString(),
        nombre: `Consumo producción orden #${id} - ${item.Nombre}`,
        tipoMovimiento: false,
        existenciaAnterior: item.Existencia,
        cantidad: detail.CantidadTotal,
        nuevaExistencia,
      });
    }

    const nuevaExistenciaFinal = finished.Existencia + order.CantidadProducir;
    if (!Number.isFinite(nuevaExistenciaFinal)) {
      throw new Error('La existencia resultante del producto terminado no es válida');
    }
    await tx.inventarioItem.update({
      where: { Id: finished.Id },
      data: { Existencia: nuevaExistenciaFinal },
    });
    await registerInventoryMovement(tx, {
      idInventarioItem: finished.Id,
      idUsuario,
      tipoDocumento: 'PROD',
      documento: id.toString(),
      nombre: `Entrada producción orden #${id} - ${finished.Nombre}`,
      tipoMovimiento: true,
      existenciaAnterior: finished.Existencia,
      cantidad: order.CantidadProducir,
      nuevaExistencia: nuevaExistenciaFinal,
    });
    const updated = await tx.ordenProduccion.updateMany({
      where: { Id: id, Estado: 'PENDIENTE', Anulado: false },
      data: {
        Estado: 'FABRICADA',
        IdUsuarioModificador: idUsuario,
        FechaModificacion: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw new Error('La orden cambió de estado; vuelve a cargarla');
    }

    const confirmed = await tx.ordenProduccion.findUnique({
      where: { Id: id },
      include: orderInclude,
    });
    if (!confirmed) {
      throw new Error('No se pudo recuperar la orden confirmada');
    }

    return toProductionOrderDto(confirmed);
  });
}

export async function cancelProductionOrder(id: number, idUsuario: number) {
  return runSerializableTransaction(async (tx) => {
    const order = await tx.ordenProduccion.findUnique({
      where: { Id: id },
      select: { Id: true, Estado: true, Anulado: true },
    });
    if (!order) {
      throw new Error('Orden de producción no existe');
    }
    if (order.Anulado || order.Estado !== 'PENDIENTE') {
      throw new Error('Sólo se pueden cancelar órdenes pendientes');
    }

    const existingMovements = await tx.bitacoraInventario.count({
      where: { TipoDocumento: 'PROD', Documento: id.toString() },
    });
    if (existingMovements > 0) {
      throw new Error('No se puede cancelar una orden con movimientos de inventario asociados');
    }

    const canceled = await tx.ordenProduccion.updateMany({
      where: { Id: id, Estado: 'PENDIENTE', Anulado: false },
      data: {
        Estado: 'CANCELADA',
        Anulado: true,
        IdUsuarioAnulador: idUsuario,
        FechaAnulacion: new Date(),
      },
    });
    if (canceled.count !== 1) {
      throw new Error('La orden cambió de estado; vuelve a cargarla');
    }

    const result = await tx.ordenProduccion.findUnique({
      where: { Id: id },
      include: orderInclude,
    });
    if (!result) {
      throw new Error('No se pudo recuperar la orden cancelada');
    }
    return toProductionOrderDto(result);
  });
}
