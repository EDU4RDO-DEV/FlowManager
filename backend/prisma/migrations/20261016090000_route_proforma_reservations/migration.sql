CREATE TABLE [dbo].[ReservaProforma] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdVenta] INT NOT NULL,
  [IdUsuario] INT NOT NULL,
  [Estado] VARCHAR(20) NOT NULL CONSTRAINT [DF_ReservaProforma_Estado] DEFAULT ('ACTIVA'),
  [FechaExpiracion] DATETIME2 NOT NULL,
  [FechaRegistro] DATETIME2 NOT NULL CONSTRAINT [DF_ReservaProforma_FechaRegistro] DEFAULT (GETDATE()),
  [FechaConsumo] DATETIME2 NULL,
  [IdUsuarioConsumo] INT NULL,
  [FechaLiberacion] DATETIME2 NULL,
  [IdUsuarioLiberacion] INT NULL,
  [MotivoLiberacion] VARCHAR(20) NULL,
  CONSTRAINT [PK_ReservaProforma] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [CK_ReservaProforma_Estado]
    CHECK ([Estado] IN ('ACTIVA', 'CONSUMIDA', 'LIBERADA', 'VENCIDA')),
  CONSTRAINT [CK_ReservaProforma_Finalizacion]
    CHECK (
      ([Estado] = 'ACTIVA' AND [FechaConsumo] IS NULL AND [FechaLiberacion] IS NULL AND [MotivoLiberacion] IS NULL)
      OR ([Estado] = 'CONSUMIDA' AND [FechaConsumo] IS NOT NULL AND [IdUsuarioConsumo] IS NOT NULL AND [FechaLiberacion] IS NULL AND [MotivoLiberacion] IS NULL)
      OR ([Estado] = 'LIBERADA' AND [FechaConsumo] IS NULL AND [FechaLiberacion] IS NOT NULL AND [IdUsuarioLiberacion] IS NOT NULL AND [MotivoLiberacion] = 'CANCELACION')
      OR ([Estado] = 'VENCIDA' AND [FechaConsumo] IS NULL AND [FechaLiberacion] IS NOT NULL AND [IdUsuarioLiberacion] IS NULL AND [MotivoLiberacion] = 'VENCIMIENTO')
    ),
  CONSTRAINT [FK_ReservaProforma_Venta]
    FOREIGN KEY ([IdVenta]) REFERENCES [dbo].[Venta]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_ReservaProforma_Usuario]
    FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_ReservaProforma_UsuarioConsumo]
    FOREIGN KEY ([IdUsuarioConsumo]) REFERENCES [dbo].[Usuario]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_ReservaProforma_UsuarioLiberacion]
    FOREIGN KEY ([IdUsuarioLiberacion]) REFERENCES [dbo].[Usuario]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_ReservaProforma_Venta]
  ON [dbo].[ReservaProforma]([IdVenta]);
CREATE NONCLUSTERED INDEX [IX_ReservaProforma_Estado_Expiracion]
  ON [dbo].[ReservaProforma]([Estado], [FechaExpiracion]);

CREATE TABLE [dbo].[ReservaProformaDetalle] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdReservaProforma] INT NOT NULL,
  [IdDetalleVenta] INT NOT NULL,
  [CantidadReservada] FLOAT NOT NULL,
  CONSTRAINT [PK_ReservaProformaDetalle] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [CK_ReservaProformaDetalle_CantidadPositiva] CHECK ([CantidadReservada] > 0),
  CONSTRAINT [FK_ReservaProformaDetalle_Reserva]
    FOREIGN KEY ([IdReservaProforma]) REFERENCES [dbo].[ReservaProforma]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_ReservaProformaDetalle_DetalleVenta]
    FOREIGN KEY ([IdDetalleVenta]) REFERENCES [dbo].[DetalleVenta]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_ReservaProformaDetalle_DetalleVenta]
  ON [dbo].[ReservaProformaDetalle]([IdDetalleVenta]);
CREATE NONCLUSTERED INDEX [IX_ReservaProformaDetalle_Reserva]
  ON [dbo].[ReservaProformaDetalle]([IdReservaProforma]);
