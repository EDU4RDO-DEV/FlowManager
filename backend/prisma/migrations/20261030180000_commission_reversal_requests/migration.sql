CREATE TABLE [dbo].[SolicitudReversionComision] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdEmpleado] INT NOT NULL,
    [IdVenta] INT NOT NULL,
    [IdDetalleVenta] INT NOT NULL,
    [IdDevolucionComercial] INT NULL,
    [IdUsuarioSolicitante] INT NOT NULL,
    [IdUsuarioRevisor] INT NULL,
    [IdUsuarioCancelador] INT NULL,
    [Estado] VARCHAR(24) NOT NULL CONSTRAINT [DF_SolicitudReversionComision_Estado] DEFAULT 'PENDIENTE_REVISION',
    [MontoSolicitado] DECIMAL(10,2) NOT NULL,
    [MontoAplicado] DECIMAL(10,2) NOT NULL CONSTRAINT [DF_SolicitudReversionComision_MontoAplicado] DEFAULT 0,
    [Motivo] VARCHAR(255) NOT NULL,
    [ObservacionesRevision] VARCHAR(500) NULL,
    [ObservacionesAnulacion] VARCHAR(500) NULL,
    [ClaveOperacion] CHAR(64) NOT NULL,
    [FechaSolicitud] DATETIME2 NOT NULL CONSTRAINT [DF_SolicitudReversionComision_FechaSolicitud] DEFAULT GETDATE(),
    [FechaRevision] DATETIME2 NULL,
    [FechaAplicacion] DATETIME2 NULL,
    [FechaAnulacion] DATETIME2 NULL,
    CONSTRAINT [PK_SolicitudReversionComision] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_SolicitudReversionComision_Clave] UNIQUE ([ClaveOperacion]),
    CONSTRAINT [FK_SolicitudReversionComision_Empleado] FOREIGN KEY ([IdEmpleado]) REFERENCES [dbo].[Empleado]([Id]),
    CONSTRAINT [FK_SolicitudReversionComision_Venta] FOREIGN KEY ([IdVenta]) REFERENCES [dbo].[Venta]([Id]),
    CONSTRAINT [FK_SolicitudReversionComision_Detalle] FOREIGN KEY ([IdDetalleVenta]) REFERENCES [dbo].[DetalleVenta]([Id]),
    CONSTRAINT [FK_SolicitudReversionComision_Devolucion] FOREIGN KEY ([IdDevolucionComercial]) REFERENCES [dbo].[DevolucionComercial]([Id]),
    CONSTRAINT [FK_SolicitudReversionComision_Solicitante] FOREIGN KEY ([IdUsuarioSolicitante]) REFERENCES [dbo].[Usuario]([Id]),
    CONSTRAINT [FK_SolicitudReversionComision_Revisor] FOREIGN KEY ([IdUsuarioRevisor]) REFERENCES [dbo].[Usuario]([Id]),
    CONSTRAINT [FK_SolicitudReversionComision_Cancelador] FOREIGN KEY ([IdUsuarioCancelador]) REFERENCES [dbo].[Usuario]([Id])
);

CREATE INDEX [IX_SolicitudReversionComision_Empleado_Estado]
    ON [dbo].[SolicitudReversionComision]([IdEmpleado], [Estado], [FechaSolicitud]);

CREATE INDEX [IX_SolicitudReversionComision_Venta_Detalle]
    ON [dbo].[SolicitudReversionComision]([IdVenta], [IdDetalleVenta]);
