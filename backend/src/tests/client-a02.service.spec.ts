import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    cliente: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    entidad: {
      create: vi.fn(),
      update: vi.fn(),
    },
    tipoCliente: {
      findFirst: vi.fn(),
    },
    usuario: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

import { createClient, updateClient } from '../services/client.service';

function buildClient(idTipoCliente: number | null) {
  return {
    Id: 7,
    IdEntidad: 12,
    IdUsuario: 1,
    IdTipoCliente: idTipoCliente,
    FechaRegistro: null,
    IdUsuarioModificador: null,
    FechaModificacion: null,
    Anulado: false,
    IdUsuarioAnulador: null,
    FechaAnulacion: null,
    Entidad: {
      Id: 12,
      NombreCompleto: 'Cliente de prueba',
      Sexo: null,
      FechaNacimiento: null,
      Telefono1: null,
      Telefono2: null,
      CorreoElectronico: null,
      RutaImagen: null,
      Nit: null,
      Dpi: null,
      Anulado: false,
    },
  };
}

describe('AUD-A02-001 - clasificación de clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 1 });
  });

  it('asigna un tipo de cliente activo durante el alta', async () => {
    prismaMock.tipoCliente.findFirst.mockResolvedValueOnce({ Id: 4 });
    prismaMock.entidad.create.mockResolvedValueOnce({ Id: 12 });
    prismaMock.cliente.create.mockResolvedValueOnce(buildClient(4));

    const result = await createClient({
      idUsuario: 1,
      idTipoCliente: 4,
      entidad: { nombreCompleto: 'Cliente de prueba' },
    });

    expect(result.idTipoCliente).toBe(4);
    expect(prismaMock.tipoCliente.findFirst).toHaveBeenCalledWith({
      where: { Id: 4, Anulado: false },
      select: { Id: true },
    });
    expect(prismaMock.cliente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ IdTipoCliente: 4 }),
      }),
    );
  });

  it('rechaza asignar un tipo inexistente o anulado sin crear la entidad', async () => {
    prismaMock.tipoCliente.findFirst.mockResolvedValueOnce(null);

    await expect(
      createClient({
        idUsuario: 1,
        idTipoCliente: 4,
        entidad: { nombreCompleto: 'Cliente de prueba' },
      }),
    ).rejects.toThrow('Tipo de cliente no existe o está inactivo');

    expect(prismaMock.entidad.create).not.toHaveBeenCalled();
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
  });

  it('permite retirar el tipo asignado sin afectar los datos de entidad', async () => {
    prismaMock.cliente.findFirst.mockResolvedValueOnce({
      Id: 7,
      IdEntidad: 12,
      IdTipoCliente: 4,
    });
    prismaMock.cliente.update.mockResolvedValueOnce(buildClient(null));

    const result = await updateClient(7, { idTipoCliente: null });

    expect(result.idTipoCliente).toBeNull();
    expect(prismaMock.tipoCliente.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.cliente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Id: 7 },
        data: expect.objectContaining({ IdTipoCliente: null }),
      }),
    );
  });
});
