CREATE TABLE [dbo].[DevolucionComercial] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdVenta] INT NOT NULL,
  [IdUsuarioAutorizacion] INT NOT NULL,
  [IdempotencyKey] VARCHAR(100) NOT NULL,
  [PayloadHash] VARCHAR(64) NOT NULL,
  [FechaAutorizacion] DATETIME2 NOT NULL CONSTRAINT [DF_DevolucionComercial_FechaAutorizacion] DEFAULT (GETDATE()),
  CONSTRAINT [PK_DevolucionComercial] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [FK_DevolucionComercial_Venta]
    FOREIGN KEY ([IdVenta]) REFERENCES [dbo].[Venta]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_DevolucionComercial_Usuario]
    FOREIGN KEY ([IdUsuarioAutorizacion]) REFERENCES [dbo].[Usuario]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_DevolucionComercial_IdempotencyKey]
  ON [dbo].[DevolucionComercial]([IdempotencyKey]);
CREATE NONCLUSTERED INDEX [IX_DevolucionComercial_Venta_Fecha]
  ON [dbo].[DevolucionComercial]([IdVenta], [FechaAutorizacion]);

CREATE TABLE [dbo].[DevolucionComercialDetalle] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdDevolucionComercial] INT NOT NULL,
  [IdDetalleVenta] INT NOT NULL,
  [Cantidad] FLOAT NOT NULL,
  [Motivo] VARCHAR(255) NOT NULL,
  [CondicionFisica] VARCHAR(20) NOT NULL,
  [UbicacionNoVendible] VARCHAR(255) NULL,
  CONSTRAINT [PK_DevolucionComercialDetalle] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [CK_DevolucionComercialDetalle_CantidadPositiva] CHECK ([Cantidad] > 0),
  CONSTRAINT [CK_DevolucionComercialDetalle_Motivo] CHECK (LEN(LTRIM(RTRIM([Motivo]))) >= 3),
  CONSTRAINT [CK_DevolucionComercialDetalle_Condicion] CHECK ([CondicionFisica] IN ('VENDIBLE', 'DANADO', 'NO_VENDIBLE')),
  CONSTRAINT [CK_DevolucionComercialDetalle_UbicacionNoVendible]
    CHECK (
      ([CondicionFisica] = 'VENDIBLE' AND [UbicacionNoVendible] IS NULL)
      OR ([CondicionFisica] <> 'VENDIBLE' AND [UbicacionNoVendible] IS NOT NULL AND LEN(LTRIM(RTRIM([UbicacionNoVendible]))) > 0)
    ),
  CONSTRAINT [FK_DevolucionComercialDetalle_Devolucion]
    FOREIGN KEY ([IdDevolucionComercial]) REFERENCES [dbo].[DevolucionComercial]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_DevolucionComercialDetalle_DetalleVenta]
    FOREIGN KEY ([IdDetalleVenta]) REFERENCES [dbo].[DetalleVenta]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE NONCLUSTERED INDEX [IX_DevolucionComercialDetalle_DetalleVenta]
  ON [dbo].[DevolucionComercialDetalle]([IdDetalleVenta]);
CREATE NONCLUSTERED INDEX [IX_DevolucionComercialDetalle_Devolucion]
  ON [dbo].[DevolucionComercialDetalle]([IdDevolucionComercial]);
