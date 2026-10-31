ALTER TABLE [dbo].[RutaSesion]
ALTER COLUMN [IdUsuarioChofer] INT NULL;

ALTER TABLE [dbo].[RutaSesion]
ALTER COLUMN [IdUsuarioVendedor] INT NULL;

ALTER TABLE [dbo].[RutaSesion]
ADD [IdEmpleadoChofer] INT NULL,
    [IdEmpleadoVendedor] INT NULL;

ALTER TABLE [dbo].[Venta]
ADD [IdEmpleadoVendedor] INT NULL,
    [FechaVentaEfectiva] DATETIME2 NULL;

ALTER TABLE [dbo].[RutaSesion]
ADD CONSTRAINT [FK_RutaSesion_EmpleadoChofer]
FOREIGN KEY ([IdEmpleadoChofer]) REFERENCES [dbo].[Empleado]([Id]);

ALTER TABLE [dbo].[RutaSesion]
ADD CONSTRAINT [FK_RutaSesion_EmpleadoVendedor]
FOREIGN KEY ([IdEmpleadoVendedor]) REFERENCES [dbo].[Empleado]([Id]);

ALTER TABLE [dbo].[Venta]
ADD CONSTRAINT [FK_Venta_EmpleadoVendedor]
FOREIGN KEY ([IdEmpleadoVendedor]) REFERENCES [dbo].[Empleado]([Id]);

CREATE INDEX [IX_RutaSesion_EmpleadoChofer_Fecha]
ON [dbo].[RutaSesion]([IdEmpleadoChofer], [FechaSesion]);

CREATE INDEX [IX_RutaSesion_EmpleadoVendedor_Fecha]
ON [dbo].[RutaSesion]([IdEmpleadoVendedor], [FechaSesion]);

CREATE INDEX [IX_Venta_EmpleadoVendedor_Fecha]
ON [dbo].[Venta]([IdEmpleadoVendedor], [FechaVentaEfectiva]);
