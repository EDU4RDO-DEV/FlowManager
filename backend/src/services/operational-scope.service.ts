import { Prisma } from '@prisma/client';

type RouteSessionAccessClient = Pick<Prisma.TransactionClient, 'rutaSesion'>;
type RouteSessionReadClient = Pick<
  Prisma.TransactionClient,
  'rutaSesion' | 'transferenciaVehiculo' | 'relevoVehiculo'
>;
type SaleAccessClient = Pick<Prisma.TransactionClient, 'venta'>;
type RouteSessionVisibilityFilter = Prisma.RutaSesionWhereInput;

export type OperationalActor = {
  userId: number;
  roleName?: string | null;
};

function normalizedRole(roleName?: string | null): string {
  return roleName?.trim().toLocaleLowerCase('es') ?? '';
}

export function getRouteSessionVisibilityWhere(
  actor: OperationalActor,
): RouteSessionVisibilityFilter | undefined {
  switch (normalizedRole(actor.roleName)) {
    case 'vendedor':
      return {
        OR: [
          { IdUsuarioVendedor: actor.userId },
          {
            Empleado_RutaSesion_IdEmpleadoVendedorToEmpleado: {
              is: { IdUsuarioVinculado: actor.userId, Anulado: false },
            },
          },
        ],
      };
    case 'chofer':
      return {
        OR: [
          { IdUsuarioChofer: actor.userId },
          {
            Empleado_RutaSesion_IdEmpleadoChoferToEmpleado: {
              is: { IdUsuarioVinculado: actor.userId, Anulado: false },
            },
          },
        ],
      };
    default:
      return undefined;
  }
}

export async function getRouteSessionReadVisibilityIds(
  client: RouteSessionReadClient,
  actor: OperationalActor,
): Promise<number[] | undefined> {
  const assignmentWhere = getRouteSessionVisibilityWhere(actor);
  if (!assignmentWhere) return undefined;

  const assignedSessions = await client.rutaSesion.findMany({
    where: { Anulado: false, ...assignmentWhere },
    select: { Id: true },
  });
  const assignedIds = assignedSessions.map((session) => session.Id);
  if (assignedIds.length === 0) return [];

  const [transfers, handoffs] = await Promise.all([
    client.transferenciaVehiculo.findMany({
      where: {
        Anulado: false,
        EstadoConfirmacion: { in: ['PENDIENTE', 'CONFIRMADA'] },
        OR: [
          { IdRutaSesionOrigen: { in: assignedIds } },
          { IdRutaSesionDestino: { in: assignedIds } },
        ],
      },
      select: {
        IdRutaSesionOrigen: true,
        IdRutaSesionDestino: true,
      },
    }),
    client.relevoVehiculo.findMany({
      where: {
        Anulado: false,
        OR: [
          { IdRutaSesionSaliente: { in: assignedIds } },
          { IdRutaSesionEntrante: { in: assignedIds } },
        ],
      },
      select: {
        IdRutaSesionSaliente: true,
        IdRutaSesionEntrante: true,
      },
    }),
  ]);

  const candidateIds = new Set(assignedIds);
  for (const transfer of transfers) {
    candidateIds.add(transfer.IdRutaSesionOrigen);
    candidateIds.add(transfer.IdRutaSesionDestino);
  }
  for (const handoff of handoffs) {
    candidateIds.add(handoff.IdRutaSesionSaliente);
    candidateIds.add(handoff.IdRutaSesionEntrante);
  }

  const visibleSessions = await client.rutaSesion.findMany({
    where: {
      Id: { in: [...candidateIds] },
      Anulado: false,
    },
    select: { Id: true },
  });
  return visibleSessions.map((session) => session.Id);
}

export function getSaleVisibilityWhere(actor: OperationalActor): Prisma.VentaWhereInput | undefined {
  switch (normalizedRole(actor.roleName)) {
    case 'vendedor':
      return {
        OR: [
          { IdUsuario: actor.userId },
          {
            RutaSesion: {
              is: {
                OR: [
                  { IdUsuarioVendedor: actor.userId },
                  {
                    Empleado_RutaSesion_IdEmpleadoVendedorToEmpleado: {
                      is: { IdUsuarioVinculado: actor.userId, Anulado: false },
                    },
                  },
                ],
              },
            },
          },
          { EmpleadoVendedor: { is: { IdUsuarioVinculado: actor.userId } } },
        ],
      };
    case 'chofer':
      return {
        RutaSesion: {
          is: {
            OR: [
              { IdUsuarioChofer: actor.userId },
              {
                Empleado_RutaSesion_IdEmpleadoChoferToEmpleado: {
                  is: { IdUsuarioVinculado: actor.userId, Anulado: false },
                },
              },
            ],
          },
        },
      };
    default:
      return undefined;
  }
}

export async function assertRouteSessionAccess(
  client: RouteSessionAccessClient,
  idRutaSesion: number,
  actor: OperationalActor,
): Promise<void> {
  const visibilityWhere = getRouteSessionVisibilityWhere(actor);
  if (!visibilityWhere) return;

  const session = await client.rutaSesion.findFirst({
    where: {
      Id: idRutaSesion,
      Anulado: false,
      ...visibilityWhere,
    },
    select: { Id: true },
  });

  if (!session) {
    throw new Error('RutaSesion no existe o no está asignada al usuario');
  }
}

export async function assertSaleAccess(
  client: SaleAccessClient,
  idVenta: number,
  actor: OperationalActor,
): Promise<void> {
  const visibilityWhere = getSaleVisibilityWhere(actor);
  if (!visibilityWhere) return;

  const sale = await client.venta.findFirst({
    where: {
      Id: idVenta,
      ...visibilityWhere,
    },
    select: { Id: true },
  });

  if (!sale) {
    throw new Error('Venta no existe o no está asignada al usuario');
  }
}
