ALTER TABLE [dbo].[PlanillaMensual]
DROP CONSTRAINT [UQ_PlanillaMensual_EmpleadoPeriodoEstado];

CREATE UNIQUE INDEX [UQ_PlanillaMensual_EmpleadoPeriodoActivo]
ON [dbo].[PlanillaMensual]([IdEmpleado], [Mes], [Anio])
WHERE [Anulado] = 0;

CREATE INDEX [IX_PlanillaMensual_EmpleadoPeriodoEstado]
ON [dbo].[PlanillaMensual]([IdEmpleado], [Mes], [Anio], [Anulado]);

ALTER TABLE [dbo].[PlanillaDetalleComision]
ADD [IdConfiguracionComision] INT,
    [IdReglaComision] INT,
    [CantidadMinimaAplicada] FLOAT(53),
    [CantidadMaximaAplicada] FLOAT(53);

ALTER TABLE [dbo].[PlanillaDetalleComision]
ADD CONSTRAINT [FK_PlanillaDetalleComision_ReglaComision]
FOREIGN KEY ([IdReglaComision]) REFERENCES [dbo].[ReglaComision]([Id])
ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE [dbo].[PlanillaDetalleComisionFuente] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdPlanillaDetalleComision] INT NOT NULL,
    [IdDetalleVenta] INT NOT NULL,
    [IdVenta] INT NOT NULL,
    [IdRutaSesion] INT NOT NULL,
    [FechaSesion] DATETIME NOT NULL,
    [SesionAnulada] BIT NOT NULL,
    [EstadoPago] VARCHAR(20) NOT NULL,
    [VentaAnulada] BIT NOT NULL,
    [DetalleVentaAnulado] BIT NOT NULL,
    [EsBonificacion] BIT NOT NULL,
    [IdUsuarioChofer] INT NOT NULL,
    [IdUsuarioVendedor] INT NOT NULL,
    [IdUsuarioAtribuido] INT NOT NULL,
    [RolAtribucion] VARCHAR(12) NOT NULL,
    [Cantidad] FLOAT(53) NOT NULL,
    [PrecioUnitario] DECIMAL(10,2) NOT NULL,
    [BaseCalculo] DECIMAL(10,2) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF_PlanillaDetalleComisionFuente_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_PlanillaDetalleComisionFuente] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_PlanillaDetalleComisionFuente_Detalle]
        UNIQUE NONCLUSTERED ([IdPlanillaDetalleComision], [IdDetalleVenta]),
    CONSTRAINT [FK_PlanillaDetalleComisionFuente_DetalleComision]
        FOREIGN KEY ([IdPlanillaDetalleComision])
        REFERENCES [dbo].[PlanillaDetalleComision]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [IX_PlanillaDetalleComisionFuente_Venta]
ON [dbo].[PlanillaDetalleComisionFuente]([IdVenta]);

CREATE INDEX [IX_PlanillaDetalleComisionFuente_RutaSesion]
ON [dbo].[PlanillaDetalleComisionFuente]([IdRutaSesion]);
