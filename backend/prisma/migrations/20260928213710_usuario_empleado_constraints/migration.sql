-- Fase 1: Empleado.IdUsuarioVinculado es la única fuente de verdad de la relación laboral.
-- Prisma no soporta índices únicos filtrados en schema.prisma; se agregan como SQL manual.

-- Un usuario activo no puede estar vinculado como empleado a más de un empleado activo.
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Empleado_UsuarioVinculado_Activo]
ON [dbo].[Empleado] ([IdUsuarioVinculado])
WHERE [IdUsuarioVinculado] IS NOT NULL AND [Anulado] = 0;

-- Una entidad (persona) no puede representar a más de un empleado activo.
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Empleado_Entidad_Activo]
ON [dbo].[Empleado] ([IdEntidad])
WHERE [Anulado] = 0;

-- Una entidad (persona) no puede estar vinculada a más de un usuario activo.
CREATE UNIQUE NONCLUSTERED INDEX [UQ_Usuario_Entidad_Activo]
ON [dbo].[Usuario] ([IdEntidad])
WHERE [IdEntidad] IS NOT NULL AND [Anulado] = 0;
