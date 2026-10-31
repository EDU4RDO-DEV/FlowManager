ALTER TABLE [PlanillaDetalleComisionFuente]
ALTER COLUMN [IdRutaSesion] INT NULL;

ALTER TABLE [PlanillaDetalleComisionFuente]
ALTER COLUMN [IdUsuarioChofer] INT NULL;

ALTER TABLE [PlanillaDetalleComisionFuente]
ALTER COLUMN [IdUsuarioVendedor] INT NULL;

ALTER TABLE [PlanillaDetalleComisionFuente]
ALTER COLUMN [IdUsuarioAtribuido] INT NULL;

ALTER TABLE [PlanillaDetalleComisionFuente]
ADD [IdEmpleadoAtribuido] INT NULL;

ALTER TABLE [PlanillaDetalleComisionFuente]
ADD CONSTRAINT [FK_PlanillaDetalleComisionFuente_Empleado]
FOREIGN KEY ([IdEmpleadoAtribuido]) REFERENCES [Empleado]([Id])
ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX [IX_PlanillaDetalleComisionFuente_Empleado]
ON [PlanillaDetalleComisionFuente]([IdEmpleadoAtribuido]);
