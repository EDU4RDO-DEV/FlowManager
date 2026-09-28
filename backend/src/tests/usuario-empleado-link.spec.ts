import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    empleado: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    entidad: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    rol: {
      findFirst: vi.fn(),
    },
    ruta: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { updateUser } from '../services/user.service';
import { createRutaSesion } from '../services/logistics.service';

describe('Fase 1 - relación Usuario-Empleado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza vincular un empleado que ya tiene otro usuario activo vinculado', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 5 }); // existing user
    prismaMock.empleado.findFirst.mockResolvedValueOnce({ IdUsuarioVinculado: 99 }); // validateEmpleadoDisponibleParaUsuario

    await expect(
      updateUser(5, { idEmpleadoVinculado: 3 }),
    ).rejects.toThrowError('El empleado ya está vinculado a otro usuario');
  });

  it('al vincular usuario-empleado, escribe Empleado.IdUsuarioVinculado como fuente autoritativa', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 5 }); // existing user
    prismaMock.empleado.findFirst.mockResolvedValueOnce({ IdUsuarioVinculado: null }); // disponible
    prismaMock.empleado.findFirst.mockResolvedValueOnce({ IdEntidad: 40 }); // getEmployeeEntidadId
    prismaMock.entidad.findFirst.mockResolvedValueOnce({ Id: 40 }); // validateEntidadExists
    prismaMock.usuario.findFirst.mockResolvedValueOnce(null); // validateEntidadNotLinkedToOtherUser -> nadie más

    const tx = {
      usuario: {
        update: vi.fn().mockResolvedValue({
          Id: 5,
          IdUsuario: null,
          IdEntidad: 40,
          IdRol: null,
          Nombre: 'Ana',
          Correo: 'ana@flow.com',
          FechaRegistro: null,
          IdUsuarioModificador: null,
          FechaModificacion: null,
          Anulado: false,
          IdUsuarioAnulador: null,
          FechaAnulacion: null,
        }),
      },
      empleado: {
        findFirst: vi.fn().mockResolvedValueOnce(null), // sin empleado previo vinculado a este usuario
        update: vi.fn().mockResolvedValue({ Id: 3 }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    );

    prismaMock.usuario.findFirst.mockResolvedValueOnce({
      Id: 5,
      IdUsuario: null,
      IdEntidad: 40,
      IdRol: null,
      Nombre: 'Ana',
      Correo: 'ana@flow.com',
      FechaRegistro: null,
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      Entidad_Usuario_IdEntidadToEntidad: null,
    });

    await updateUser(5, { idEmpleadoVinculado: 3 });

    expect(tx.empleado.update).toHaveBeenCalledWith({
      where: { Id: 3 },
      data: { IdUsuarioVinculado: 5 },
    });
  });

  it('al desvincular (idEmpleadoVinculado: null), limpia el empleado previamente vinculado', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 5 }); // existing user

    const tx = {
      usuario: {
        update: vi.fn().mockResolvedValue({
          Id: 5,
          IdUsuario: null,
          IdEntidad: null,
          IdRol: null,
          Nombre: 'Ana',
          Correo: 'ana@flow.com',
          FechaRegistro: null,
          IdUsuarioModificador: null,
          FechaModificacion: null,
          Anulado: false,
          IdUsuarioAnulador: null,
          FechaAnulacion: null,
        }),
      },
      empleado: {
        findFirst: vi.fn().mockResolvedValueOnce({ Id: 3 }), // empleado previamente vinculado
        update: vi.fn().mockResolvedValue({ Id: 3 }),
      },
    };

    prismaMock.$transaction.mockImplementationOnce(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    );

    prismaMock.usuario.findFirst.mockResolvedValueOnce({
      Id: 5,
      IdUsuario: null,
      IdEntidad: null,
      IdRol: null,
      Nombre: 'Ana',
      Correo: 'ana@flow.com',
      FechaRegistro: null,
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      Entidad_Usuario_IdEntidadToEntidad: null,
    });

    await updateUser(5, { idEmpleadoVinculado: null });

    expect(tx.empleado.update).toHaveBeenCalledWith({
      where: { Id: 3 },
      data: { IdUsuarioVinculado: null },
    });
  });

  it('logística ya no resuelve empleado por IdUsuario de registro, solo por IdUsuarioVinculado', async () => {
    prismaMock.ruta.findFirst.mockResolvedValueOnce({ Id: 1 });
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 77 }); // validateUsuarioExists (chofer)
    prismaMock.empleado.findFirst.mockResolvedValueOnce(null); // no hay empleado con IdUsuarioVinculado = 77

    await expect(
      createRutaSesion({
        idRuta: 1,
        idVehiculo: 1,
        idUsuarioChofer: 77,
        idUsuarioVendedor: 88,
        fechaSesion: '2026-09-28',
        estado: 'ABIERTA',
      } as never),
    ).rejects.toThrowError('Chofer no tiene empleado activo vinculado');

    expect(prismaMock.empleado.findFirst).toHaveBeenCalledWith({
      where: { Anulado: false, IdUsuarioVinculado: 77 },
      select: { Id: true },
    });
  });
});
