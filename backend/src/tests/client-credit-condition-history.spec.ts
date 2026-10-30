import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: { findFirst: vi.fn() },
    cliente: { findFirst: vi.fn() },
    tipoCredito: { findFirst: vi.fn() },
    clienteCondicionCredito: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({ prisma: prismaMock }));

import {
  createClienteCondicionCredito,
  listClienteCondicionesCredito,
  updateClienteCondicionCredito,
} from '../services/client-catalog.service';

function conditionRow(overrides: Record<string, unknown> = {}) {
  return {
    Id: 2,
    IdCliente: 4,
    IdTipoCredito: 8,
    IdUsuario: 1,
    HabilitadoCredito: true,
    FechaInicioVigencia: new Date('2026-03-01T00:00:00.000Z'),
    FechaFinVigencia: null,
    Observaciones: null,
    FechaRegistro: new Date('2026-03-01T00:00:00.000Z'),
    IdUsuarioModificador: null,
    FechaModificacion: null,
    Anulado: false,
    IdUsuarioAnulador: null,
    FechaAnulacion: null,
    TipoCredito: { Id: 8, Nombre: 'Crédito prueba' },
    ...overrides,
  };
}

function setupTransaction() {
  prismaMock.usuario.findFirst.mockResolvedValue({ Id: 1 });
  prismaMock.cliente.findFirst.mockResolvedValue({ Id: 4 });
  prismaMock.tipoCredito.findFirst.mockResolvedValue({ Id: 8 });
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
  );
}

describe('client credit condition history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTransaction();
  });

  it('creates the first enabled condition in a serializable transaction', async () => {
    prismaMock.clienteCondicionCredito.findMany.mockResolvedValue([]);
    prismaMock.clienteCondicionCredito.create.mockResolvedValue(conditionRow());

    await createClienteCondicionCredito({
      idUsuario: 1,
      idCliente: 4,
      idTipoCredito: 8,
      fechaInicioVigencia: '2026-03-01',
    });

    expect(prismaMock.$transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: 'Serializable',
    });
    expect(prismaMock.clienteCondicionCredito.create).toHaveBeenCalledOnce();
    expect(prismaMock.clienteCondicionCredito.create.mock.calls[0][0].data.FechaInicioVigencia)
      .toEqual(new Date('2026-03-01T00:00:00.000Z'));
    expect(prismaMock.clienteCondicionCredito.update).not.toHaveBeenCalled();
  });

  it('closes the prior condition the day before a new assignment without changing its type', async () => {
    prismaMock.clienteCondicionCredito.findMany.mockResolvedValue([
      { Id: 1, FechaInicioVigencia: new Date('2026-01-01T00:00:00.000Z') },
    ]);
    prismaMock.clienteCondicionCredito.update.mockResolvedValue({});
    prismaMock.clienteCondicionCredito.create.mockResolvedValue(conditionRow());

    await createClienteCondicionCredito({
      idUsuario: 1,
      idCliente: 4,
      idTipoCredito: 8,
      fechaInicioVigencia: '2026-03-01',
    });

    expect(prismaMock.clienteCondicionCredito.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Id: 1 },
        data: expect.objectContaining({
          FechaFinVigencia: new Date('2026-02-28T00:00:00.000Z'),
        }),
      }),
    );
    expect(prismaMock.clienteCondicionCredito.create).toHaveBeenCalledOnce();
    expect(prismaMock.$transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: 'Serializable',
    });
  });

  it('rejects overlapping enabled conditions that cannot be treated as the preceding assignment', async () => {
    prismaMock.clienteCondicionCredito.findMany.mockResolvedValue([
      { Id: 1, FechaInicioVigencia: new Date('2026-04-01T00:00:00.000Z') },
    ]);

    await expect(
      createClienteCondicionCredito({
        idUsuario: 1,
        idCliente: 4,
        idTipoCredito: 8,
        fechaInicioVigencia: '2026-03-01',
      }),
    ).rejects.toThrow('El período de vigencia se superpone con otra condición habilitada');

    expect(prismaMock.clienteCondicionCredito.update).not.toHaveBeenCalled();
    expect(prismaMock.clienteCondicionCredito.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive credit type before creating a condition', async () => {
    prismaMock.tipoCredito.findFirst.mockResolvedValue(null);

    await expect(
      createClienteCondicionCredito({
        idUsuario: 1,
        idCliente: 4,
        idTipoCredito: 8,
        fechaInicioVigencia: '2026-03-01',
      }),
    ).rejects.toThrow('Tipo de crédito no existe o no está activo');

    expect(prismaMock.clienteCondicionCredito.create).not.toHaveBeenCalled();
  });

  it('does not allow changing the type of an existing historical condition', async () => {
    prismaMock.clienteCondicionCredito.findFirst.mockResolvedValue(
      conditionRow({ IdTipoCredito: 7 }),
    );

    await expect(
      updateClienteCondicionCredito(2, {
        idTipoCredito: 8,
        idUsuarioModificador: 1,
      }),
    ).rejects.toThrow(
      'El tipo de crédito no se modifica en una condición existente; asigne una nueva condición',
    );

    expect(prismaMock.clienteCondicionCredito.update).not.toHaveBeenCalled();
  });

  it('returns annulled and disabled conditions in the customer history', async () => {
    const history = [
      conditionRow(),
      conditionRow({ Id: 3, HabilitadoCredito: false }),
      conditionRow({ Id: 4, Anulado: true }),
    ];
    prismaMock.clienteCondicionCredito.findMany.mockResolvedValue(history);

    const result = await listClienteCondicionesCredito({ idCliente: 4 });

    expect(result).toHaveLength(3);
    expect(result.map((condition) => condition.anulado)).toEqual([false, false, true]);
    expect(prismaMock.clienteCondicionCredito.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { IdCliente: 4 },
      }),
    );
  });
});
