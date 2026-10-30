import { runSerializableTransaction } from '../utils/serializable-transaction';
import { getRouteInventory } from './route-inventory.service';
import {
  assertVehicleAvailableForSession,
  syncVehicleStateBySessions,
  toRutaSesionDto,
  validateEmpleadoVinculado,
  validateRutaExists,
  validateUsuarioExists,
} from './logistics.service';
import { createVehicleTransferWithinTx, toTransferDto } from './route-transfer.service';

// D-DIST-02/03 (aprobadas): el relevo se modela como custodia COMPARTIDA durante la
// transición, NO como un cierre inmediato de la sesión saliente. createVehicleHandoff:
//   1) crea la RutaSesion "entrante" EN_CURSO con el mismo IdJornada que la saliente
//      (continuidad de jornada), sin tocar el estado de la saliente;
//   2) opcionalmente mueve, como una TransferenciaVehiculo ya CONFIRMADA, solo el
//      inventario que el operador decide transferir en ese momento (puede ser parcial o
//      vacío: el resto queda bajo custodia del vehículo saliente y se transfiere más
//      tarde con los endpoints normales de /transferencias);
//   3) registra el vínculo RelevoVehiculo entre ambas sesiones para trazabilidad.
// La sesión saliente SOLO se cierra mediante el flujo normal de cierre (updateRutaSesion
// con Estado: 'CERRADA'), una vez que su inventario pendiente llegue a cero. Ambos
// vehículos pueden operar simultáneamente mientras tanto; loadRouteInventory ya evita la
// doble contabilización (lo transferido se descuenta del origen de inmediato y solo se
// suma al destino cuando la transferencia queda CONFIRMADA).
//
// D-DIST-07 (aprobada): la comisión corresponde al vendedor que efectivamente realizó la
// venta. Como el relevo NUNCA reutiliza la RutaSesion saliente (crea una nueva), las ventas
// anteriores conservan su IdRutaSesion/IdUsuarioVendedor original y las posteriores quedan
// en la nueva sesión con el vendedor entrante, sin requerir cambios en planilla-mensual.

type HandoffTransferLineInput = {
  idInventarioItem: number;
  cantidad: number;
  estadoEnvase?: 'VACIO' | 'LLENO';
};

type CreateVehicleHandoffInput = {
  motivo: string;
  idRuta: number;
  idVehiculo: number;
  idUsuarioChofer: number;
  idUsuarioVendedor: number;
  kmInicialEntrante: number;
  detalle?: HandoffTransferLineInput[];
};

export async function createVehicleHandoff(
  idRutaSesionSaliente: number,
  idUsuarioAutoriza: number,
  input: CreateVehicleHandoffInput,
) {
  await validateUsuarioExists(idUsuarioAutoriza);
  await validateRutaExists(input.idRuta);
  await validateEmpleadoVinculado(input.idUsuarioChofer, 'Chofer');
  await validateEmpleadoVinculado(input.idUsuarioVendedor, 'Vendedor');

  const result = await runSerializableTransaction(async (tx) => {
    const saliente = await tx.rutaSesion.findFirst({
      where: { Id: idRutaSesionSaliente, Anulado: false },
      select: {
        Id: true,
        Estado: true,
        IdVehiculo: true,
        IdJornada: true,
        FechaSesion: true,
      },
    });
    if (!saliente) {
      throw new Error('RutaSesion saliente no existe');
    }
    if (saliente.Estado !== 'EN_CURSO') {
      throw new Error('La sesión saliente debe estar EN_CURSO para registrar un relevo');
    }

    // No se excluye la sesión saliente del chequeo de disponibilidad: al NO cerrarse de
    // inmediato (custodia compartida), un mismo vehículo no puede tener dos sesiones
    // EN_CURSO simultáneas. El relevo es para SUSTITUCIÓN por otro vehículo; un cambio de
    // personal sobre el mismo vehículo se realiza cerrando la sesión actual primero.
    if (input.idVehiculo === saliente.IdVehiculo) {
      throw new Error(
        'El relevo requiere un vehículo distinto al de la sesión saliente; para cambios de personal sobre el mismo vehículo cierre la sesión y cree una nueva',
      );
    }

    await assertVehicleAvailableForSession(tx, {
      idVehiculo: input.idVehiculo,
      fechaSesion: saliente.FechaSesion,
      targetEstado: 'EN_CURSO',
    });

    const entrante = await tx.rutaSesion.create({
      data: {
        IdRuta: input.idRuta,
        IdVehiculo: input.idVehiculo,
        IdUsuarioChofer: input.idUsuarioChofer,
        IdUsuarioVendedor: input.idUsuarioVendedor,
        IdJornada: saliente.IdJornada,
        FechaSesion: saliente.FechaSesion,
        KmInicial: input.kmInicialEntrante,
        Estado: 'EN_CURSO',
        Anulado: false,
      },
      include: {
        Ruta: { select: { Id: true, Nombre: true } },
        Vehiculo: { select: { Id: true, Placa: true, Marca: true, Modelo: true } },
        Usuario_RutaSesion_IdUsuarioChoferToUsuario: { select: { Id: true, Nombre: true, Correo: true } },
        Usuario_RutaSesion_IdUsuarioVendedorToUsuario: { select: { Id: true, Nombre: true, Correo: true } },
      },
    });

    // Transferencia inicial OPCIONAL: solo lo que el operador decide mover ahora. El resto
    // permanece bajo custodia del vehículo saliente hasta una transferencia posterior.
    let transfer: Awaited<ReturnType<typeof createVehicleTransferWithinTx>> | null = null;
    if (input.detalle && input.detalle.length > 0) {
      transfer = await createVehicleTransferWithinTx(
        tx,
        idUsuarioAutoriza,
        {
          idRutaSesionOrigen: idRutaSesionSaliente,
          idRutaSesionDestino: entrante.Id,
          motivo: `Relevo de vehículo: ${input.motivo}`,
          detalle: input.detalle,
        },
        { estadoConfirmacionInicial: 'CONFIRMADA', idUsuarioConfirma: idUsuarioAutoriza },
      );
    }

    const relevo = await tx.relevoVehiculo.create({
      data: {
        IdRutaSesionSaliente: idRutaSesionSaliente,
        IdRutaSesionEntrante: entrante.Id,
        IdUsuarioAutoriza: idUsuarioAutoriza,
        Motivo: input.motivo,
      },
    });

    // El vehículo saliente no cambia de estado (su sesión sigue EN_CURSO); solo se
    // sincroniza el del vehículo entrante, que ahora queda EN_RUTA.
    await syncVehicleStateBySessions(tx, input.idVehiculo);

    return {
      relevo: {
        id: relevo.Id,
        idRutaSesionSaliente: relevo.IdRutaSesionSaliente,
        idRutaSesionEntrante: relevo.IdRutaSesionEntrante,
        idUsuarioAutoriza: relevo.IdUsuarioAutoriza,
        motivo: relevo.Motivo,
        fechaRegistro: relevo.FechaRegistro,
      },
      sesionEntrante: toRutaSesionDto(entrante),
      transferenciaInventario: transfer ? toTransferDto(transfer) : null,
      idRutaSesionSaliente,
    };
  });

  // Fuera de la transacción principal (ambas sesiones ya existen y están EN_CURSO):
  // se expone la custodia actual de cada vehículo para que quede claro qué permanece en
  // el saliente y qué ya se transfirió al entrante, sin recalcular nada por separado.
  const [custodiaSaliente, custodiaEntrante] = await Promise.all([
    getRouteInventory(result.idRutaSesionSaliente),
    getRouteInventory(result.sesionEntrante.id),
  ]);

  return {
    relevo: result.relevo,
    sesionEntrante: result.sesionEntrante,
    transferenciaInventario: result.transferenciaInventario,
    custodia: {
      saliente: { idRutaSesion: result.idRutaSesionSaliente, productos: custodiaSaliente.productos },
      entrante: { idRutaSesion: result.sesionEntrante.id, productos: custodiaEntrante.productos },
    },
  };
}
