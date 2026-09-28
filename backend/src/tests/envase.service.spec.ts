import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, registerInventoryMovementMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn() },
    venta: { findFirst: vi.fn() },
    inventarioItem: { findFirst: vi.fn(), update: vi.fn() },
    envaseClienteSaldo: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    movimientoEnvase: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  registerInventoryMovementMock: vi.fn(),
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../services/inventory-movement.service', () => ({
  registerInventoryMovement: registerInventoryMovementMock,
}));

import {
  anulateMovimientoEnvase,
  registrarDevolucionEnvase,
  registrarPrestamoEnvase,
} from '../services/envase.service';

describe('Fase 5 - envases retornables (préstamo/devolución)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
    );
  });

  it('registra un préstamo: descuenta existencia y aumenta el saldo del cliente', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      Categoria: 'ENVASE',
      Existencia: 50,
    });
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValueOnce(null);
    prismaMock.movimientoEnvase.create.mockResolvedValueOnce({
      Id: 10,
      IdInventarioItem: 5,
      IdCliente: 2,
      IdVenta: null,
      IdUsuario: 1,
      TipoMovimiento: 'PRESTAMO',
      Cantidad: 3,
      SaldoAnterior: 0,
      SaldoNuevo: 3,
      RutaFirma: null,
      Observaciones: null,
      FechaMovimiento: new Date(),
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
    });

    const result = await registrarPrestamoEnvase({
      idInventarioItem: 5,
      idCliente: 2,
      idUsuario: 1,
      cantidad: 3,
    });

    expect(result.saldoNuevo).toBe(3);
    expect(prismaMock.envaseClienteSaldo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ CantidadPrestada: 3 }) }),
    );
    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 5 },
      data: { Existencia: 47 },
    });
    expect(registerInventoryMovementMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({ tipoMovimiento: false, cantidad: 3 }),
    );
  });

  it('rechaza el préstamo si no hay stock suficiente en bodega', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      Categoria: 'ENVASE',
      Existencia: 1,
    });

    await expect(
      registrarPrestamoEnvase({ idInventarioItem: 5, idCliente: 2, idUsuario: 1, cantidad: 3 }),
    ).rejects.toThrowError('Stock insuficiente');
  });

  it('rechaza el préstamo si el InventarioItem no es de categoría ENVASE', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Resina',
      Categoria: 'MATERIA_PRIMA',
      Existencia: 100,
    });

    await expect(
      registrarPrestamoEnvase({ idInventarioItem: 5, idCliente: 2, idUsuario: 1, cantidad: 3 }),
    ).rejects.toThrowError('El InventarioItem indicado no es de categoría ENVASE');
  });

  it('rechaza la devolución si la cantidad excede el saldo prestado', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.cliente.findFirst.mockResolvedValueOnce({ Id: 2 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({
      Id: 5,
      Nombre: 'Garrafón 20L',
      Categoria: 'ENVASE',
      Existencia: 10,
    });
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValueOnce({ Id: 9, CantidadPrestada: 2 });

    await expect(
      registrarDevolucionEnvase({ idInventarioItem: 5, idCliente: 2, idUsuario: 1, cantidad: 5 }),
    ).rejects.toThrowError('La cantidad devuelta no puede ser mayor al saldo prestado');
  });

  it('al anular un préstamo, revierte el saldo del cliente y regresa el stock a bodega', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 9 });
    prismaMock.movimientoEnvase.findFirst.mockResolvedValueOnce({
      Id: 10,
      IdCliente: 2,
      IdInventarioItem: 5,
      TipoMovimiento: 'PRESTAMO',
      Cantidad: 3,
    });
    prismaMock.envaseClienteSaldo.findFirst.mockResolvedValueOnce({ Id: 9, CantidadPrestada: 3 });
    prismaMock.inventarioItem.findFirst.mockResolvedValueOnce({ Existencia: 47 });

    await anulateMovimientoEnvase(10, 9);

    expect(prismaMock.envaseClienteSaldo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ CantidadPrestada: 0 }) }),
    );
    expect(prismaMock.inventarioItem.update).toHaveBeenCalledWith({
      where: { Id: 5 },
      data: { Existencia: 50 },
    });
    expect(prismaMock.movimientoEnvase.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { Id: 10 }, data: expect.objectContaining({ Anulado: true }) }),
    );
  });
});
