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

function buildClient(habilitadoCredito: boolean) {
  return {
    Id: 7,
    IdEntidad: 12,
    IdUsuario: 1,
    HabilitadoCredito: habilitadoCredito,
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

describe('Cliente - autorización de crédito', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );
    prismaMock.usuario.findFirst.mockResolvedValue({ Id: 1 });
  });

  it('guarda la autorización de crédito elegida durante el alta', async () => {
    prismaMock.entidad.create.mockResolvedValueOnce({ Id: 12 });
    prismaMock.cliente.create.mockResolvedValueOnce(buildClient(true));

    const result = await createClient({
      idUsuario: 1,
      habilitadoCredito: true,
      entidad: { nombreCompleto: 'Cliente de prueba' },
    });

    expect(result.habilitadoCredito).toBe(true);
    expect(prismaMock.cliente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ HabilitadoCredito: true }),
      }),
    );
  });

  it('recupera el valor elegido al editar y solo actualiza la autorización', async () => {
    prismaMock.cliente.findFirst.mockResolvedValueOnce({
      Id: 7,
      IdEntidad: 12,
    });
    prismaMock.cliente.update.mockResolvedValueOnce(buildClient(false));

    const result = await updateClient(7, { habilitadoCredito: false });

    expect(result.habilitadoCredito).toBe(false);
    expect(prismaMock.cliente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { Id: 7 },
        data: expect.objectContaining({ HabilitadoCredito: false }),
      }),
    );
  });

  it('crea clientes sin autorización cuando el valor no se proporciona', async () => {
    prismaMock.entidad.create.mockResolvedValueOnce({ Id: 12 });
    prismaMock.cliente.create.mockResolvedValueOnce(buildClient(false));

    const result = await createClient({
      idUsuario: 1,
      entidad: { nombreCompleto: 'Cliente de prueba' },
    });

    expect(result.habilitadoCredito).toBe(false);
    expect(prismaMock.cliente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ HabilitadoCredito: false }),
      }),
    );
  });
});
