import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import { runSerializableTransaction } from '../utils/serializable-transaction';
import { registerInventoryMovement } from './inventory-movement.service';

type RegistrarPrestamoInput = {
  idInventarioItem: number;
  idCliente: number;
  idVenta?: number;
  idUsuario: number;
  cantidad: number;
  rutaFirma?: string;
  observaciones?: string;
};

type RegistrarDevolucionInput = {
  idInventarioItem: number;
  idCliente: number;
  idVenta?: number;
  idUsuario: number;
  cantidad: number;
  rutaFirma?: string;
  observaciones?: string;
};

type ListMovimientosInput = {
  idCliente?: number;
  idInventarioItem?: number;
  idVenta?: number;
  tipoMovimiento?: 'PRESTAMO' | 'DEVOLUCION';
  anulado?: boolean;
};

type ListSaldosInput = {
  idCliente?: number;
  soloConSaldo?: boolean;
};

function toMovimientoDto(movimiento: {
  Id: number;
  IdInventarioItem: number;
  IdCliente: number;
  IdVenta: number | null;
  IdUsuario: number;
  TipoMovimiento: string;
  Cantidad: number;
  SaldoAnterior: number;
  SaldoNuevo: number;
  RutaFirma: string | null;
  Observaciones: string | null;
  FechaMovimiento: Date | null;
  IdUsuarioModificador: number | null;
  FechaModificacion: Date | null;
  Anulado: boolean;
  IdUsuarioAnulador: number | null;
  FechaAnulacion: Date | null;
  InventarioItem?: { Id: number; Nombre: string };
  Cliente?: { Id: number; Entidad: { NombreCompleto: string } };
  Usuario?: { Id: number; Nombre: string };
}) {
  return {
    id: movimiento.Id,
    idInventarioItem: movimiento.IdInventarioItem,
    idCliente: movimiento.IdCliente,
    idVenta: movimiento.IdVenta,
    idUsuario: movimiento.IdUsuario,
    tipoMovimiento: movimiento.TipoMovimiento,
    cantidad: movimiento.Cantidad,
    saldoAnterior: movimiento.SaldoAnterior,
    saldoNuevo: movimiento.SaldoNuevo,
    rutaFirma: movimiento.RutaFirma,
    observaciones: movimiento.Observaciones,
    fechaMovimiento: movimiento.FechaMovimiento,
    idUsuarioModificador: movimiento.IdUsuarioModificador,
    fechaModificacion: movimiento.FechaModificacion,
    anulado: movimiento.Anulado,
    idUsuarioAnulador: movimiento.IdUsuarioAnulador,
    fechaAnulacion: movimiento.FechaAnulacion,
    inventarioItem: movimiento.InventarioItem
      ? { id: movimiento.InventarioItem.Id, nombre: movimiento.InventarioItem.Nombre }
      : undefined,
    cliente: movimiento.Cliente
      ? { id: movimiento.Cliente.Id, nombre: movimiento.Cliente.Entidad.NombreCompleto }
      : undefined,
    usuario: movimiento.Usuario ? { id: movimiento.Usuario.Id, nombre: movimiento.Usuario.Nombre } : undefined,
  };
}

function toSaldoDto(saldo: {
  Id: number;
  IdCliente: number;
  IdInventarioItem: number;
  CantidadPrestada: number;
  FechaActualizacion: Date | null;
  Cliente?: { Id: number; Entidad: { NombreCompleto: string } };
  InventarioItem?: { Id: number; Nombre: string };
}) {
  return {
    id: saldo.Id,
    idCliente: saldo.IdCliente,
    idInventarioItem: saldo.IdInventarioItem,
    cantidadPrestada: saldo.CantidadPrestada,
    fechaActualizacion: saldo.FechaActualizacion,
    cliente: saldo.Cliente ? { id: saldo.Cliente.Id, nombre: saldo.Cliente.Entidad.NombreCompleto } : undefined,
    inventarioItem: saldo.InventarioItem
      ? { id: saldo.InventarioItem.Id, nombre: saldo.InventarioItem.Nombre }
      : undefined,
  };
}

async function validateUsuarioExists(idUsuario: number) {
  const usuario = await prisma.usuario.findFirst({ where: { Id: idUsuario, Anulado: false }, select: { Id: true } });
  if (!usuario) {
    throw new Error('Usuario no existe');
  }
}

async function validateClienteActivo(idCliente: number) {
  const cliente = await prisma.cliente.findFirst({
    where: { Id: idCliente, Anulado: false, Entidad: { Anulado: false } },
    select: { Id: true },
  });
  if (!cliente) {
    throw new Error('Cliente no existe');
  }
}

async function getEnvaseItem(tx: Prisma.TransactionClient, idInventarioItem: number) {
  const item = await tx.inventarioItem.findFirst({
    where: { Id: idInventarioItem, Anulado: false },
    select: { Id: true, Nombre: true, Categoria: true, Existencia: true },
  });

  if (!item) {
    throw new Error('InventarioItem no existe');
  }

  if (item.Categoria !== 'ENVASE') {
    throw new Error('El InventarioItem indicado no es de categoría ENVASE');
  }

  return item;
}

async function validateVentaDeCliente(idVenta: number, idCliente: number) {
  const venta = await prisma.venta.findFirst({
    where: { Id: idVenta, Anulado: false },
    select: { Id: true, IdCliente: true },
  });

  if (!venta) {
    throw new Error('Venta no existe');
  }

  if (venta.IdCliente !== idCliente) {
    throw new Error('La venta indicada no pertenece al cliente');
  }
}

// ===== Consultas =====

export async function listMovimientosEnvase(filters: ListMovimientosInput) {
  const movimientos = await prisma.movimientoEnvase.findMany({
    where: {
      ...(filters.anulado !== undefined ? { Anulado: filters.anulado } : { Anulado: false }),
      ...(filters.idCliente !== undefined ? { IdCliente: filters.idCliente } : {}),
      ...(filters.idInventarioItem !== undefined ? { IdInventarioItem: filters.idInventarioItem } : {}),
      ...(filters.idVenta !== undefined ? { IdVenta: filters.idVenta } : {}),
      ...(filters.tipoMovimiento !== undefined ? { TipoMovimiento: filters.tipoMovimiento } : {}),
    },
    include: {
      InventarioItem: { select: { Id: true, Nombre: true } },
      Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
      Usuario: { select: { Id: true, Nombre: true } },
    },
    orderBy: { Id: 'desc' },
  });

  return movimientos.map(toMovimientoDto);
}

export async function getMovimientoEnvaseById(id: number) {
  const movimiento = await prisma.movimientoEnvase.findFirst({
    where: { Id: id },
    include: {
      InventarioItem: { select: { Id: true, Nombre: true } },
      Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
      Usuario: { select: { Id: true, Nombre: true } },
    },
  });

  if (!movimiento) {
    throw new Error('Movimiento de envase no existe');
  }

  return toMovimientoDto(movimiento);
}

export async function listEnvaseClienteSaldos(filters: ListSaldosInput) {
  const saldos = await prisma.envaseClienteSaldo.findMany({
    where: {
      ...(filters.idCliente !== undefined ? { IdCliente: filters.idCliente } : {}),
      ...(filters.soloConSaldo ? { CantidadPrestada: { gt: 0 } } : {}),
    },
    include: {
      Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
      InventarioItem: { select: { Id: true, Nombre: true } },
    },
    orderBy: [{ IdCliente: 'asc' }, { IdInventarioItem: 'asc' }],
  });

  return saldos.map(toSaldoDto);
}

// ===== Préstamo =====

export async function registrarPrestamoEnvase(input: RegistrarPrestamoInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateClienteActivo(input.idCliente);

  if (input.cantidad <= 0) {
    throw new Error('cantidad debe ser mayor a 0');
  }

  if (input.idVenta !== undefined) {
    await validateVentaDeCliente(input.idVenta, input.idCliente);
  }

  const result = await runSerializableTransaction(async (tx) => {
    const item = await getEnvaseItem(tx, input.idInventarioItem);

    if (item.Existencia < input.cantidad) {
      throw new Error(`Stock insuficiente de ${item.Nombre}. Existencia actual ${item.Existencia}`);
    }

    const saldoExistente = await tx.envaseClienteSaldo.findFirst({
      where: { IdCliente: input.idCliente, IdInventarioItem: input.idInventarioItem },
      select: { Id: true, CantidadPrestada: true },
    });

    const saldoAnterior = saldoExistente?.CantidadPrestada ?? 0;
    const saldoNuevo = Number((saldoAnterior + input.cantidad).toFixed(2));

    if (saldoExistente) {
      await tx.envaseClienteSaldo.update({
        where: { Id: saldoExistente.Id },
        data: { CantidadPrestada: saldoNuevo, FechaActualizacion: new Date() },
      });
    } else {
      await tx.envaseClienteSaldo.create({
        data: {
          IdCliente: input.idCliente,
          IdInventarioItem: input.idInventarioItem,
          CantidadPrestada: saldoNuevo,
        },
      });
    }

    const nuevaExistencia = Number((item.Existencia - input.cantidad).toFixed(2));
    await tx.inventarioItem.update({
      where: { Id: input.idInventarioItem },
      data: { Existencia: nuevaExistencia },
    });

    await registerInventoryMovement(tx, {
      idInventarioItem: input.idInventarioItem,
      idUsuario: input.idUsuario,
      tipoDocumento: 'ENVPR',
      documento: input.idVenta ? input.idVenta.toString() : undefined,
      nombre: `Préstamo de envase a cliente #${input.idCliente} - ${item.Nombre}`,
      tipoMovimiento: false,
      existenciaAnterior: item.Existencia,
      cantidad: input.cantidad,
      nuevaExistencia,
    });

    const created = await tx.movimientoEnvase.create({
      data: {
        IdInventarioItem: input.idInventarioItem,
        IdCliente: input.idCliente,
        IdVenta: input.idVenta,
        IdUsuario: input.idUsuario,
        TipoMovimiento: 'PRESTAMO',
        Cantidad: input.cantidad,
        SaldoAnterior: saldoAnterior,
        SaldoNuevo: saldoNuevo,
        RutaFirma: input.rutaFirma,
        Observaciones: input.observaciones,
        Anulado: false,
      },
      include: {
        InventarioItem: { select: { Id: true, Nombre: true } },
        Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
        Usuario: { select: { Id: true, Nombre: true } },
      },
    });

    return created;
  });

  return toMovimientoDto(result);
}

// ===== Devolución =====

export async function registrarDevolucionEnvase(input: RegistrarDevolucionInput) {
  await validateUsuarioExists(input.idUsuario);
  await validateClienteActivo(input.idCliente);

  if (input.cantidad <= 0) {
    throw new Error('cantidad debe ser mayor a 0');
  }

  if (input.idVenta !== undefined) {
    await validateVentaDeCliente(input.idVenta, input.idCliente);
  }

  const result = await runSerializableTransaction(async (tx) => {
    const item = await getEnvaseItem(tx, input.idInventarioItem);

    const saldoExistente = await tx.envaseClienteSaldo.findFirst({
      where: { IdCliente: input.idCliente, IdInventarioItem: input.idInventarioItem },
      select: { Id: true, CantidadPrestada: true },
    });

    const saldoAnterior = saldoExistente?.CantidadPrestada ?? 0;

    if (input.cantidad > saldoAnterior) {
      throw new Error('La cantidad devuelta no puede ser mayor al saldo prestado');
    }

    const saldoNuevo = Number((saldoAnterior - input.cantidad).toFixed(2));

    await tx.envaseClienteSaldo.update({
      where: { Id: saldoExistente!.Id },
      data: { CantidadPrestada: saldoNuevo, FechaActualizacion: new Date() },
    });

    const nuevaExistencia = Number((item.Existencia + input.cantidad).toFixed(2));
    await tx.inventarioItem.update({
      where: { Id: input.idInventarioItem },
      data: { Existencia: nuevaExistencia },
    });

    await registerInventoryMovement(tx, {
      idInventarioItem: input.idInventarioItem,
      idUsuario: input.idUsuario,
      tipoDocumento: 'ENVDEV',
      documento: input.idVenta ? input.idVenta.toString() : undefined,
      nombre: `Devolución de envase de cliente #${input.idCliente} - ${item.Nombre}`,
      tipoMovimiento: true,
      existenciaAnterior: item.Existencia,
      cantidad: input.cantidad,
      nuevaExistencia,
    });

    const created = await tx.movimientoEnvase.create({
      data: {
        IdInventarioItem: input.idInventarioItem,
        IdCliente: input.idCliente,
        IdVenta: input.idVenta,
        IdUsuario: input.idUsuario,
        TipoMovimiento: 'DEVOLUCION',
        Cantidad: input.cantidad,
        SaldoAnterior: saldoAnterior,
        SaldoNuevo: saldoNuevo,
        RutaFirma: input.rutaFirma,
        Observaciones: input.observaciones,
        Anulado: false,
      },
      include: {
        InventarioItem: { select: { Id: true, Nombre: true } },
        Cliente: { select: { Id: true, Entidad: { select: { NombreCompleto: true } } } },
        Usuario: { select: { Id: true, Nombre: true } },
      },
    });

    return created;
  });

  return toMovimientoDto(result);
}

// ===== Anulación / restauración de movimientos =====

export async function anulateMovimientoEnvase(id: number, idUsuarioAnulador?: number) {
  if (idUsuarioAnulador !== undefined) {
    await validateUsuarioExists(idUsuarioAnulador);
  }

  await runSerializableTransaction(async (tx) => {
    const movimiento = await tx.movimientoEnvase.findFirst({
      where: { Id: id, Anulado: false },
      select: { Id: true, IdCliente: true, IdInventarioItem: true, TipoMovimiento: true, Cantidad: true },
    });

    if (!movimiento) {
      throw new Error('Movimiento de envase no existe');
    }

    const saldoExistente = await tx.envaseClienteSaldo.findFirst({
      where: { IdCliente: movimiento.IdCliente, IdInventarioItem: movimiento.IdInventarioItem },
      select: { Id: true, CantidadPrestada: true },
    });

    const saldoActual = saldoExistente?.CantidadPrestada ?? 0;
    // Anular un movimiento revierte su efecto sobre el saldo del cliente.
    const saldoRevertido =
      movimiento.TipoMovimiento === 'PRESTAMO'
        ? Number((saldoActual - movimiento.Cantidad).toFixed(2))
        : Number((saldoActual + movimiento.Cantidad).toFixed(2));

    if (saldoRevertido < 0) {
      throw new Error('No es posible anular: el saldo del cliente quedaría negativo');
    }

    if (saldoExistente) {
      await tx.envaseClienteSaldo.update({
        where: { Id: saldoExistente.Id },
        data: { CantidadPrestada: saldoRevertido, FechaActualizacion: new Date() },
      });
    }

    const item = await tx.inventarioItem.findFirst({
      where: { Id: movimiento.IdInventarioItem },
      select: { Existencia: true },
    });

    if (item) {
      // Revertir también el efecto físico en bodega (préstamo anulado regresa stock; devolución anulada lo retira).
      const nuevaExistencia =
        movimiento.TipoMovimiento === 'PRESTAMO'
          ? Number((item.Existencia + movimiento.Cantidad).toFixed(2))
          : Number((item.Existencia - movimiento.Cantidad).toFixed(2));

      if (nuevaExistencia < 0) {
        throw new Error('No es posible anular: la existencia en bodega quedaría negativa');
      }

      await tx.inventarioItem.update({
        where: { Id: movimiento.IdInventarioItem },
        data: { Existencia: nuevaExistencia },
      });

      await registerInventoryMovement(tx, {
        idInventarioItem: movimiento.IdInventarioItem,
        idUsuario: idUsuarioAnulador ?? movimiento.IdCliente,
        tipoDocumento: 'ENVAN',
        documento: movimiento.Id.toString(),
        nombre: `Anulación movimiento de envase #${movimiento.Id}`,
        tipoMovimiento: movimiento.TipoMovimiento === 'PRESTAMO',
        existenciaAnterior: item.Existencia,
        cantidad: movimiento.Cantidad,
        nuevaExistencia,
      });
    }

    await tx.movimientoEnvase.update({
      where: { Id: id },
      data: {
        Anulado: true,
        IdUsuarioAnulador: idUsuarioAnulador,
        FechaAnulacion: new Date(),
      },
    });
  });
}

export async function restoreMovimientoEnvase(id: number, idUsuarioModificador?: number) {
  if (idUsuarioModificador !== undefined) {
    await validateUsuarioExists(idUsuarioModificador);
  }

  await runSerializableTransaction(async (tx) => {
    const movimiento = await tx.movimientoEnvase.findFirst({
      where: { Id: id, Anulado: true },
      select: { Id: true, IdCliente: true, IdInventarioItem: true, TipoMovimiento: true, Cantidad: true },
    });

    if (!movimiento) {
      throw new Error('Movimiento de envase anulado no existe');
    }

    const saldoExistente = await tx.envaseClienteSaldo.findFirst({
      where: { IdCliente: movimiento.IdCliente, IdInventarioItem: movimiento.IdInventarioItem },
      select: { Id: true, CantidadPrestada: true },
    });

    const saldoActual = saldoExistente?.CantidadPrestada ?? 0;
    const saldoReaplicado =
      movimiento.TipoMovimiento === 'PRESTAMO'
        ? Number((saldoActual + movimiento.Cantidad).toFixed(2))
        : Number((saldoActual - movimiento.Cantidad).toFixed(2));

    if (saldoReaplicado < 0) {
      throw new Error('No es posible restaurar: el saldo del cliente quedaría negativo');
    }

    if (saldoExistente) {
      await tx.envaseClienteSaldo.update({
        where: { Id: saldoExistente.Id },
        data: { CantidadPrestada: saldoReaplicado, FechaActualizacion: new Date() },
      });
    } else {
      await tx.envaseClienteSaldo.create({
        data: {
          IdCliente: movimiento.IdCliente,
          IdInventarioItem: movimiento.IdInventarioItem,
          CantidadPrestada: saldoReaplicado,
        },
      });
    }

    const item = await tx.inventarioItem.findFirst({
      where: { Id: movimiento.IdInventarioItem },
      select: { Existencia: true },
    });

    if (item) {
      const nuevaExistencia =
        movimiento.TipoMovimiento === 'PRESTAMO'
          ? Number((item.Existencia - movimiento.Cantidad).toFixed(2))
          : Number((item.Existencia + movimiento.Cantidad).toFixed(2));

      if (nuevaExistencia < 0) {
        throw new Error('No es posible restaurar: la existencia en bodega quedaría negativa');
      }

      await tx.inventarioItem.update({
        where: { Id: movimiento.IdInventarioItem },
        data: { Existencia: nuevaExistencia },
      });

      await registerInventoryMovement(tx, {
        idInventarioItem: movimiento.IdInventarioItem,
        idUsuario: idUsuarioModificador ?? movimiento.IdCliente,
        tipoDocumento: 'ENVRE',
        documento: movimiento.Id.toString(),
        nombre: `Restauración movimiento de envase #${movimiento.Id}`,
        tipoMovimiento: movimiento.TipoMovimiento !== 'PRESTAMO',
        existenciaAnterior: item.Existencia,
        cantidad: movimiento.Cantidad,
        nuevaExistencia,
      });
    }

    await tx.movimientoEnvase.update({
      where: { Id: id },
      data: {
        Anulado: false,
        IdUsuarioAnulador: null,
        FechaAnulacion: null,
        IdUsuarioModificador: idUsuarioModificador,
        FechaModificacion: new Date(),
      },
    });
  });

  return getMovimientoEnvaseById(id);
}
