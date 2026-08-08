import { Request, Response } from 'express';

import {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
} from '../services/employee.service';

function parseId(value: unknown): number {
  if (typeof value === 'string') {
    return Number(value);
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return Number(value[0]);
  }

  return Number.NaN;
}

function isValidPositiveInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) > 0;
}

function isValidNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function listEmployeesController(_req: Request, res: Response) {
  try {
    const data = await listEmployees();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return res.status(500).json({ ok: false, message });
  }
}

export async function getEmployeeByIdController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const data = await getEmployeeById(id);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Empleado no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function createEmployeeController(req: Request, res: Response) {
  try {
    const {
      idUsuario,
      idConfiguracionComision,
      puestoTrabajo,
      descripcionPuesto,
      fechaContratacion,
      fechaSalida,
      sueldoBase,
      entidad,
    } = req.body as {
      idUsuario?: number;
      idConfiguracionComision?: number;
      puestoTrabajo?: string;
      descripcionPuesto?: string;
      fechaContratacion?: string;
      fechaSalida?: string;
      sueldoBase?: number;
      entidad?: {
        nombreCompleto?: string;
        sexo?: string;
        fechaNacimiento?: string;
        telefono1?: string;
        telefono2?: string;
        correoElectronico?: string;
        rutaImagen?: string;
        nit?: string;
        dpi?: string;
      };
    };

    if (!isValidPositiveInteger(idUsuario)) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuario es obligatorio y debe ser entero positivo',
      });
    }

    if (
      idConfiguracionComision !== undefined &&
      !isValidPositiveInteger(idConfiguracionComision)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'idConfiguracionComision debe ser entero positivo cuando se envía',
      });
    }

    if (!puestoTrabajo || !puestoTrabajo.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'puestoTrabajo es obligatorio',
      });
    }

    if (!fechaContratacion) {
      return res.status(400).json({
        ok: false,
        message: 'fechaContratacion es obligatoria',
      });
    }

    if (!isValidNumber(sueldoBase)) {
      return res.status(400).json({
        ok: false,
        message: 'sueldoBase es obligatorio y debe ser numérico',
      });
    }

    if (!entidad || !entidad.nombreCompleto || !entidad.nombreCompleto.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'entidad.nombreCompleto es obligatorio',
      });
    }

    if (entidad.fechaNacimiento !== undefined) {
      const parsedDate = new Date(entidad.fechaNacimiento);
      if (Number.isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ ok: false, message: 'entidad.fechaNacimiento inválida' });
      }
    }

    const parsedFechaContratacion = new Date(fechaContratacion);
    if (Number.isNaN(parsedFechaContratacion.getTime())) {
      return res.status(400).json({ ok: false, message: 'fechaContratacion inválida' });
    }

    if (fechaSalida !== undefined) {
      const parsedFechaSalida = new Date(fechaSalida);
      if (Number.isNaN(parsedFechaSalida.getTime())) {
        return res.status(400).json({ ok: false, message: 'fechaSalida inválida' });
      }
    }

    const data = await createEmployee({
      idUsuario: Number(idUsuario),
      ...(idConfiguracionComision !== undefined
        ? { idConfiguracionComision: Number(idConfiguracionComision) }
        : {}),
      puestoTrabajo: puestoTrabajo.trim(),
      descripcionPuesto,
      fechaContratacion,
      fechaSalida,
      sueldoBase: Number(sueldoBase),
      entidad: {
        nombreCompleto: entidad.nombreCompleto.trim(),
        sexo: entidad.sexo,
        fechaNacimiento: entidad.fechaNacimiento,
        telefono1: entidad.telefono1,
        telefono2: entidad.telefono2,
        correoElectronico: entidad.correoElectronico,
        rutaImagen: entidad.rutaImagen,
        nit: entidad.nit,
        dpi: entidad.dpi,
      },
    });

    return res.status(201).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Usuario no existe' || message === 'Configuracion de comision no existe') {
      return res.status(404).json({ ok: false, message });
    }

    if (
      message === 'fechaNacimiento inválida' ||
      message === 'fechaContratacion inválida' ||
      message === 'fechaSalida inválida'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function updateEmployeeController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const {
      idUsuario,
      idUsuarioModificador,
      idConfiguracionComision,
      puestoTrabajo,
      descripcionPuesto,
      fechaContratacion,
      fechaSalida,
      sueldoBase,
      entidad,
    } = req.body as {
      idUsuario?: number;
      idUsuarioModificador?: number;
      idConfiguracionComision?: number | null;
      puestoTrabajo?: string;
      descripcionPuesto?: string | null;
      fechaContratacion?: string;
      fechaSalida?: string | null;
      sueldoBase?: number;
      entidad?: {
        nombreCompleto?: string;
        sexo?: string;
        fechaNacimiento?: string;
        telefono1?: string;
        telefono2?: string;
        correoElectronico?: string;
        rutaImagen?: string;
        nit?: string;
        dpi?: string;
      };
    };

    if (idUsuario !== undefined && !isValidPositiveInteger(idUsuario)) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuario debe ser entero positivo cuando se envía',
      });
    }

    if (
      idUsuarioModificador !== undefined &&
      !isValidPositiveInteger(idUsuarioModificador)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuarioModificador debe ser entero positivo cuando se envía',
      });
    }

    if (
      idConfiguracionComision !== undefined &&
      idConfiguracionComision !== null &&
      !isValidPositiveInteger(idConfiguracionComision)
    ) {
      return res.status(400).json({
        ok: false,
        message: 'idConfiguracionComision debe ser entero positivo cuando se envía',
      });
    }

    if (puestoTrabajo !== undefined && !puestoTrabajo.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'puestoTrabajo no puede ir vacío',
      });
    }

    if (sueldoBase !== undefined && !isValidNumber(sueldoBase)) {
      return res.status(400).json({
        ok: false,
        message: 'sueldoBase debe ser numérico cuando se envía',
      });
    }

    if (entidad?.nombreCompleto !== undefined && !entidad.nombreCompleto.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'entidad.nombreCompleto no puede ir vacío',
      });
    }

    if (entidad?.fechaNacimiento !== undefined) {
      const parsedDate = new Date(entidad.fechaNacimiento);
      if (Number.isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ ok: false, message: 'entidad.fechaNacimiento inválida' });
      }
    }

    if (fechaContratacion !== undefined) {
      const parsedDate = new Date(fechaContratacion);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ ok: false, message: 'fechaContratacion inválida' });
      }
    }

    if (fechaSalida !== undefined && fechaSalida !== null) {
      const parsedDate = new Date(fechaSalida);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ ok: false, message: 'fechaSalida inválida' });
      }
    }

    const data = await updateEmployee(id, {
      ...(idUsuario !== undefined ? { idUsuario: Number(idUsuario) } : {}),
      ...(idUsuarioModificador !== undefined
        ? { idUsuarioModificador: Number(idUsuarioModificador) }
        : {}),
      ...(idConfiguracionComision !== undefined
        ? { idConfiguracionComision: idConfiguracionComision === null ? null : Number(idConfiguracionComision) }
        : {}),
      ...(puestoTrabajo !== undefined ? { puestoTrabajo: puestoTrabajo.trim() } : {}),
      ...(descripcionPuesto !== undefined ? { descripcionPuesto } : {}),
      ...(fechaContratacion !== undefined ? { fechaContratacion } : {}),
      ...(fechaSalida !== undefined ? { fechaSalida } : {}),
      ...(sueldoBase !== undefined ? { sueldoBase: Number(sueldoBase) } : {}),
      ...(entidad !== undefined
        ? {
            entidad: {
              ...(entidad.nombreCompleto !== undefined
                ? { nombreCompleto: entidad.nombreCompleto.trim() }
                : {}),
              ...(entidad.sexo !== undefined ? { sexo: entidad.sexo } : {}),
              ...(entidad.fechaNacimiento !== undefined
                ? { fechaNacimiento: entidad.fechaNacimiento }
                : {}),
              ...(entidad.telefono1 !== undefined ? { telefono1: entidad.telefono1 } : {}),
              ...(entidad.telefono2 !== undefined ? { telefono2: entidad.telefono2 } : {}),
              ...(entidad.correoElectronico !== undefined
                ? { correoElectronico: entidad.correoElectronico }
                : {}),
              ...(entidad.rutaImagen !== undefined ? { rutaImagen: entidad.rutaImagen } : {}),
              ...(entidad.nit !== undefined ? { nit: entidad.nit } : {}),
              ...(entidad.dpi !== undefined ? { dpi: entidad.dpi } : {}),
            },
          }
        : {}),
    });

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (
      message === 'Empleado no existe' ||
      message === 'Usuario no existe' ||
      message === 'Configuracion de comision no existe'
    ) {
      return res.status(404).json({ ok: false, message });
    }

    if (
      message === 'fechaNacimiento inválida' ||
      message === 'fechaContratacion inválida' ||
      message === 'fechaSalida inválida'
    ) {
      return res.status(400).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}

export async function deleteEmployeeController(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, message: 'id debe ser un entero positivo' });
    }

    const { idUsuarioAnulador } = req.body as { idUsuarioAnulador?: number };

    if (idUsuarioAnulador !== undefined && !isValidPositiveInteger(idUsuarioAnulador)) {
      return res.status(400).json({
        ok: false,
        message: 'idUsuarioAnulador debe ser entero positivo cuando se envía',
      });
    }

    await deleteEmployee(
      id,
      req.auth?.userId ??
        (idUsuarioAnulador !== undefined ? Number(idUsuarioAnulador) : undefined),
    );

    return res.status(200).json({ ok: true, message: 'Empleado anulado correctamente' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno';

    if (message === 'Empleado no existe' || message === 'Usuario no existe') {
      return res.status(404).json({ ok: false, message });
    }

    return res.status(500).json({ ok: false, message });
  }
}
