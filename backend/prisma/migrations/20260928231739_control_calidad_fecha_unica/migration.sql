-- Fase 8: solo puede existir un registro activo de control de calidad por fecha.
CREATE UNIQUE NONCLUSTERED INDEX [UQ_ControlCalidadAgua_Fecha_Activo]
ON [dbo].[ControlCalidadAgua] ([Fecha])
WHERE [Anulado] = 0;
