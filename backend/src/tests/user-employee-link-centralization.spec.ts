import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    usuario: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    empleado: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    entidad: {
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

import { createUser, updateUser } from '../services/user.service';
import { listEmployees } from '../services/employee.service';
import { createEmployeeSchema, updateEmployeeSchema } from '../validators/employee.validators';

function userRecord(id: number, idEntidad: number | null = null) {
  return {
    Id: id,
    IdUsuario: null,
    IdEntidad: idEntidad,
    IdRol: null,
    Nombre: 'Cuenta de prueba',
    Correo: `user${id}@example.test`,
    FechaRegistro: null,
    IdUsuarioModificador: null,
    FechaModificacion: null,
    Anulado: false,
    IdUsuarioAnulador: null,
    FechaAnulacion: null,
    Entidad_Usuario_IdEntidadToEntidad: null,
  };
}

describe('centralized Usuario-Empleado association', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a user linked to an existing employee in one transaction', async () => {
    prismaMock.usuario.findFirst
      .mockResolvedValueOnce(null) // email available
      .mockResolvedValueOnce({ Id: 2 }) // acting user exists
      .mockResolvedValueOnce(null); // entity not linked to another user
    prismaMock.empleado.findFirst
      .mockResolvedValueOnce({ IdUsuarioVinculado: null }) // employee available
      .mockResolvedValueOnce({
        IdEntidad: 30,
        Entidad: { NombreCompleto: 'Persona' },
      }); // employee entity
    prismaMock.entidad.findFirst.mockResolvedValueOnce({ Id: 30 });

    const tx = {
      usuario: {
        create: vi.fn().mockResolvedValue({ Id: 15 }),
        findFirstOrThrow: vi.fn().mockResolvedValue(userRecord(15, 30)),
      },
      empleado: {
        update: vi.fn().mockResolvedValue({ Id: 3 }),
      },
      entidad: {
        update: vi.fn().mockResolvedValue({ Id: 30 }),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await createUser({
      nombre: 'Cuenta de prueba',
      correo: 'user15@example.test',
      clave: 'Password123!',
      idEmpleadoVinculado: 3,
      idUsuarioModificador: 2,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(tx.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ IdEntidad: 30, Nombre: 'Persona' }),
      }),
    );
    expect(tx.empleado.update).toHaveBeenCalledWith({
      where: { Id: 3 },
      data: expect.objectContaining({
        IdUsuarioVinculado: 15,
        IdUsuarioModificador: 2,
        FechaModificacion: expect.any(Date),
      }),
    });
    expect(tx.entidad.update).not.toHaveBeenCalled();
  });

  it('rejects an employee already assigned to another active user', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({ Id: 8 });
    prismaMock.empleado.findFirst.mockResolvedValueOnce({ IdUsuarioVinculado: 9 });

    await expect(updateUser(8, { idEmpleadoVinculado: 3 })).rejects.toThrow(
      'El empleado ya está vinculado a otro usuario',
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('moves an existing association by clearing the old employee and setting the new one atomically', async () => {
    prismaMock.usuario.findFirst
      .mockResolvedValueOnce({ Id: 8 }) // user exists
      .mockResolvedValueOnce(null) // target entity is not linked to another user
      .mockResolvedValueOnce({ Id: 11 }) // acting user exists
      .mockResolvedValueOnce(userRecord(8, 50)); // refreshed user
    prismaMock.empleado.findFirst
      .mockResolvedValueOnce({ IdUsuarioVinculado: null }) // new employee available
      .mockResolvedValueOnce({
        IdEntidad: 50,
        Entidad: { NombreCompleto: 'Persona destino' },
      }); // new employee entity
    prismaMock.entidad.findFirst.mockResolvedValueOnce({ Id: 50 });

    const tx = {
      usuario: {
        update: vi.fn().mockResolvedValue(userRecord(8, 50)),
      },
      empleado: {
        findFirst: vi.fn().mockResolvedValue({
          Id: 3,
          IdEntidad: 30,
          Entidad: { NombreCompleto: 'Persona origen' },
        }),
        update: vi.fn().mockResolvedValue({ Id: 3 }),
      },
      entidad: {
        update: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await updateUser(8, {
      idEmpleadoVinculado: 4,
      nombre: 'No debe prevalecer',
      idUsuarioModificador: 11,
      entidad: { nombreCompleto: 'No debe modificar empleado' },
    });

    expect(tx.empleado.update).toHaveBeenNthCalledWith(1, {
      where: { Id: 3 },
      data: expect.objectContaining({
        IdUsuarioVinculado: null,
        IdUsuarioModificador: 11,
        FechaModificacion: expect.any(Date),
      }),
    });
    expect(tx.empleado.update).toHaveBeenNthCalledWith(2, {
      where: { Id: 4 },
      data: expect.objectContaining({
        IdUsuarioVinculado: 8,
        IdUsuarioModificador: 11,
        FechaModificacion: expect.any(Date),
      }),
    });
    expect(tx.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ Nombre: 'Persona destino' }),
      }),
    );
    expect(tx.entidad.update).not.toHaveBeenCalled();
  });

  it('employee reads expose linked account information and the unlinked state', async () => {
    const employee = {
      Id: 3,
      IdEntidad: 30,
      IdUsuario: 1,
      IdUsuarioVinculado: 15,
      IdConfiguracionComision: null,
      IdTipoTrabajador: null,
      PuestoTrabajo: 'Chofer',
      DescripcionPuesto: null,
      FechaContratacion: new Date('2025-01-01'),
      FechaSalida: null,
      SueldoBase: 100,
      FechaRegistro: null,
      IdUsuarioModificador: null,
      FechaModificacion: null,
      Anulado: false,
      IdUsuarioAnulador: null,
      FechaAnulacion: null,
      TipoTrabajador: null,
      HistorialSueldos: [],
      Entidad: {
        Id: 30,
        NombreCompleto: 'Persona',
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
      UsuarioVinculado: {
        Id: 15,
        Nombre: 'Cuenta',
        Correo: 'cuenta@example.test',
        Anulado: false,
      },
    };
    prismaMock.empleado.findMany.mockResolvedValueOnce([
      employee,
      { ...employee, Id: 4, IdUsuarioVinculado: null, UsuarioVinculado: null },
    ]);

    const employees = await listEmployees();

    expect(employees[0]?.usuarioVinculado).toEqual({
      id: 15,
      nombre: 'Cuenta',
      correo: 'cuenta@example.test',
      anulado: false,
    });
    expect(employees[1]?.usuarioVinculado).toBeNull();
  });

  it('employee create and update payloads reject attempts to manage the association', () => {
    expect(
      createEmployeeSchema.safeParse({
        idUsuario: 1,
        idUsuarioVinculado: 15,
        idTipoTrabajador: 1,
        puestoTrabajo: 'Chofer',
        fechaContratacion: '2025-01-01',
        sueldoBase: 100,
        entidad: { nombreCompleto: 'Persona' },
      }).success,
    ).toBe(false);

    expect(
      updateEmployeeSchema.safeParse({ idUsuarioVinculado: null }).success,
    ).toBe(false);
  });
});
