import { z } from 'zod';

import type { ReportDefinition } from '../types';
import { buildDateTimeRangeFilter, nowIso } from '../helpers';
import { optionalDateParam, optionalPositiveIntParam } from '../params';
import { prisma } from './_shared';

const CATEGORIA = 'administracion';
const CATEGORIA_LABEL = 'Administración';

// 72. Usuarios por rol y estado -----------------------------------------------------------------------
const usuariosPorRolSchema = z.object({
  idRol: optionalPositiveIntParam,
  estado: z.enum(['activos', 'anulados', 'todos']).default('activos'),
});
type UsuariosPorRolParams = z.infer<typeof usuariosPorRolSchema>;

const usuariosPorRol: ReportDefinition<UsuariosPorRolParams> = {
  id: 'usuarios-por-rol',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Usuarios por rol y estado',
  descripcion: 'Distribución de usuarios del sistema según su rol asignado.',
  moduloPermiso: 'usuarios',
  parametros: [
    { key: 'idRol', label: 'Rol', type: 'select', optionsEndpoint: '/api/roles' },
    {
      key: 'estado',
      label: 'Estado',
      type: 'select',
      options: [
        { value: 'activos', label: 'Activos' },
        { value: 'anulados', label: 'Anulados' },
        { value: 'todos', label: 'Todos' },
      ],
    },
  ],
  schema: usuariosPorRolSchema,
  async run(params) {
    const usuarios = await prisma.usuario.findMany({
      where: {
        ...(params.estado === 'activos' ? { Anulado: false } : {}),
        ...(params.estado === 'anulados' ? { Anulado: true } : {}),
        ...(params.idRol ? { IdRol: params.idRol } : {}),
      },
      select: { Nombre: true, Correo: true, Anulado: true, Rol_Usuario_IdRolToRol: { select: { Nombre: true } } },
      orderBy: { Id: 'desc' },
      take: 5000,
    });

    const rows = usuarios.map((u) => ({
      usuario: u.Nombre,
      correo: u.Correo,
      rol: u.Rol_Usuario_IdRolToRol?.Nombre ?? 'Sin rol',
      estado: u.Anulado ? 'Anulado' : 'Activo',
    }));

    const byRol = new Map<string, number>();
    for (const row of rows) {
      byRol.set(row.rol, (byRol.get(row.rol) ?? 0) + 1);
    }

    return {
      columns: [
        { key: 'usuario', label: 'Usuario', type: 'text' },
        { key: 'correo', label: 'Correo', type: 'text' },
        { key: 'rol', label: 'Rol', type: 'badge' },
        { key: 'estado', label: 'Estado', type: 'badge' },
      ],
      rows,
      indicators: Array.from(byRol.entries()).map(([rol, conteo]) => ({ label: rol, value: conteo })),
      meta: { totalRegistros: rows.length, truncado: usuarios.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 73. Permisos configurados por rol -----------------------------------------------------------------
const permisosRolSchema = z.object({
  idRol: optionalPositiveIntParam.refine((v) => v !== undefined, 'idRol es obligatorio'),
});
type PermisosRolParams = z.infer<typeof permisosRolSchema>;

const permisosPorRol: ReportDefinition<PermisosRolParams> = {
  id: 'permisos-por-rol',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Permisos configurados por rol',
  descripcion: 'Matriz de módulos y acciones permitidas para un rol.',
  moduloPermiso: 'roles',
  orientacionPdf: 'landscape',
  parametros: [{ key: 'idRol', label: 'Rol', type: 'select', required: true, optionsEndpoint: '/api/roles' }],
  schema: permisosRolSchema,
  async run(params) {
    const permisos = await prisma.rolPermiso.findMany({
      where: { IdRol: params.idRol as number, Anulado: false, Permitido: true },
      include: { ModuloSistema: { select: { Nombre: true } }, AccionSistema: { select: { Nombre: true } } },
    });

    const byModulo = new Map<string, Set<string>>();
    for (const permiso of permisos) {
      const modulo = permiso.ModuloSistema.Nombre;
      const set = byModulo.get(modulo) ?? new Set<string>();
      set.add(permiso.AccionSistema.Nombre);
      byModulo.set(modulo, set);
    }

    const rows = Array.from(byModulo.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([modulo, acciones]) => ({ modulo, acciones: Array.from(acciones).join(', ') }));

    return {
      columns: [
        { key: 'modulo', label: 'Módulo', type: 'text' },
        { key: 'acciones', label: 'Acciones permitidas', type: 'text' },
      ],
      rows,
      indicators: [{ label: 'Módulos con permiso', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: false, generadoEn: nowIso() },
    };
  },
};

// 74. Sesiones / actividad de acceso ------------------------------------------------------------------
const sesionesActividadSchema = z.object({ idUsuario: optionalPositiveIntParam, fechaInicio: optionalDateParam, fechaFin: optionalDateParam });
type SesionesActividadParams = z.infer<typeof sesionesActividadSchema>;

const sesionesActividad: ReportDefinition<SesionesActividadParams> = {
  id: 'sesiones-actividad',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Sesiones y actividad de acceso',
  descripcion: 'Inicios de sesión registrados por usuario.',
  moduloPermiso: 'sesiones',
  parametros: [
    { key: 'idUsuario', label: 'Usuario', type: 'select', optionsEndpoint: '/api/users' },
    { key: 'fechaInicio', label: 'Fecha inicial', type: 'date' },
    { key: 'fechaFin', label: 'Fecha final', type: 'date' },
  ],
  schema: sesionesActividadSchema,
  async run(params) {
    const fechaFilter = buildDateTimeRangeFilter(params.fechaInicio, params.fechaFin);
    const sesiones = await prisma.sesion.findMany({
      where: {
        ...(params.idUsuario ? { IdUsuario: params.idUsuario } : {}),
        ...(fechaFilter ? { FechaRegistro: fechaFilter } : {}),
      },
      include: { Usuario: { select: { Nombre: true } } },
      orderBy: { Id: 'desc' },
      take: 5000,
    });

    const rows = sesiones.map((s) => ({
      fecha: s.FechaRegistro,
      usuario: s.Usuario.Nombre,
      ip: s.IP,
      dispositivo: s.NombreDispositivo,
      estado: s.Anulado ? 'Cerrada' : 'Activa',
    }));

    const byUsuario = new Map<string, number>();
    for (const row of rows) {
      byUsuario.set(row.usuario, (byUsuario.get(row.usuario) ?? 0) + 1);
    }

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'usuario', label: 'Usuario', type: 'text' },
        { key: 'ip', label: 'IP', type: 'text' },
        { key: 'dispositivo', label: 'Dispositivo', type: 'text' },
        { key: 'estado', label: 'Estado', type: 'badge' },
      ],
      rows,
      indicators: [{ label: 'Sesiones registradas', value: rows.length }, { label: 'Usuarios distintos', value: byUsuario.size }],
      meta: { totalRegistros: rows.length, truncado: sesiones.length >= 5000, generadoEn: nowIso() },
    };
  },
};

// 75. Historial de reportes generados ------------------------------------------------------------------
const historialReportesSchema = z.object({ idUsuario: optionalPositiveIntParam, claveReporte: z.string().trim().optional() });
type HistorialReportesParams = z.infer<typeof historialReportesSchema>;

const historialReportesGenerados: ReportDefinition<HistorialReportesParams> = {
  id: 'historial-reportes-generados',
  categoria: CATEGORIA,
  categoriaLabel: CATEGORIA_LABEL,
  nombre: 'Historial de reportes generados',
  descripcion: 'Auditoría de quién generó/exportó cada reporte y cuándo.',
  moduloPermiso: 'reportes',
  parametros: [
    { key: 'idUsuario', label: 'Usuario', type: 'select', optionsEndpoint: '/api/users' },
    { key: 'claveReporte', label: 'Clave de reporte', type: 'text', placeholder: 'ej. ventas-por-periodo' },
  ],
  schema: historialReportesSchema,
  async run(params) {
    const historial = await prisma.reporteHistorial.findMany({
      where: {
        ...(params.idUsuario ? { IdUsuario: params.idUsuario } : {}),
        ...(params.claveReporte ? { ClaveReporte: params.claveReporte } : {}),
      },
      include: { Usuario: { select: { Nombre: true } } },
      orderBy: { Id: 'desc' },
      take: 5000,
    });

    const rows = historial.map((h) => ({
      fecha: h.FechaGeneracion,
      usuario: h.Usuario.Nombre,
      categoria: h.Categoria,
      reporte: h.NombreReporte,
      formato: h.FormatoExportado ?? 'Vista previa',
      totalRegistros: h.TotalRegistros ?? 0,
    }));

    return {
      columns: [
        { key: 'fecha', label: 'Fecha', type: 'date' },
        { key: 'usuario', label: 'Usuario', type: 'text' },
        { key: 'categoria', label: 'Categoría', type: 'text' },
        { key: 'reporte', label: 'Reporte', type: 'text' },
        { key: 'formato', label: 'Formato', type: 'badge' },
        { key: 'totalRegistros', label: '# Registros', type: 'number' },
      ],
      rows,
      indicators: [{ label: 'Generaciones registradas', value: rows.length }],
      meta: { totalRegistros: rows.length, truncado: historial.length >= 5000, generadoEn: nowIso() },
    };
  },
};

export const administrationReports = [usuariosPorRol, permisosPorRol, sesionesActividad, historialReportesGenerados];
