ALTER TABLE [dbo].[RutaSesion]
  ADD [FechaCierre] DATETIME NULL,
      [IdUsuarioCierre] INT NULL;

ALTER TABLE [dbo].[RutaSesion]
  ADD CONSTRAINT [FK_RutaSesion_UsuarioCierre]
  FOREIGN KEY ([IdUsuarioCierre]) REFERENCES [dbo].[Usuario]([Id])
  ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [IX_RutaSesion_Estado_Activo_Fecha]
  ON [dbo].[RutaSesion]([Estado], [Anulado], [FechaSesion]);
CREATE NONCLUSTERED INDEX [IX_Venta_RutaSesion_Activo_Tipo]
  ON [dbo].[Venta]([IdRutaSesion], [Anulado], [TipoRegistro]);

CREATE TABLE [dbo].[DespachoRuta] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdRutaSesion] INT NOT NULL,
  [IdUsuario] INT NOT NULL,
  [Observaciones] VARCHAR(255) NULL,
  [FechaRegistro] DATETIME CONSTRAINT [DF_DespachoRuta_FechaRegistro] DEFAULT GETDATE(),
  CONSTRAINT [PK_DespachoRuta] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [FK_DespachoRuta_RutaSesion]
    FOREIGN KEY ([IdRutaSesion]) REFERENCES [dbo].[RutaSesion]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_DespachoRuta_Usuario]
    FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_DespachoRuta_RutaSesion]
  ON [dbo].[DespachoRuta]([IdRutaSesion]);

CREATE TABLE [dbo].[DespachoRutaDetalle] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdDespachoRuta] INT NOT NULL,
  [IdInventarioItem] INT NOT NULL,
  [NombreSnapshot] VARCHAR(255) NOT NULL,
  [UnidadMedidaSnapshot] VARCHAR(30) NULL,
  [Cantidad] FLOAT NOT NULL,
  CONSTRAINT [PK_DespachoRutaDetalle] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [CK_DespachoRutaDetalle_CantidadPositiva] CHECK ([Cantidad] > 0),
  CONSTRAINT [FK_DespachoRutaDetalle_DespachoRuta]
    FOREIGN KEY ([IdDespachoRuta]) REFERENCES [dbo].[DespachoRuta]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_DespachoRutaDetalle_InventarioItem]
    FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_DespachoRutaDetalle_Despacho_Item]
  ON [dbo].[DespachoRutaDetalle]([IdDespachoRuta], [IdInventarioItem]);
CREATE NONCLUSTERED INDEX [IX_DespachoRutaDetalle_InventarioItem]
  ON [dbo].[DespachoRutaDetalle]([IdInventarioItem]);

CREATE TABLE [dbo].[DevolucionRuta] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdRutaSesion] INT NOT NULL,
  [IdUsuario] INT NOT NULL,
  [Observaciones] VARCHAR(255) NULL,
  [FechaRegistro] DATETIME CONSTRAINT [DF_DevolucionRuta_FechaRegistro] DEFAULT GETDATE(),
  CONSTRAINT [PK_DevolucionRuta] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [FK_DevolucionRuta_RutaSesion]
    FOREIGN KEY ([IdRutaSesion]) REFERENCES [dbo].[RutaSesion]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_DevolucionRuta_Usuario]
    FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_DevolucionRuta_RutaSesion]
  ON [dbo].[DevolucionRuta]([IdRutaSesion]);

CREATE TABLE [dbo].[DevolucionRutaDetalle] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdDevolucionRuta] INT NOT NULL,
  [IdInventarioItem] INT NOT NULL,
  [CantidadRecibida] FLOAT NOT NULL,
  [CantidadDanada] FLOAT NOT NULL CONSTRAINT [DF_DevolucionRutaDetalle_CantidadDanada] DEFAULT (0),
  [Observaciones] VARCHAR(255) NULL,
  CONSTRAINT [PK_DevolucionRutaDetalle] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [CK_DevolucionRutaDetalle_CantidadRecibidaPositiva] CHECK ([CantidadRecibida] > 0),
  CONSTRAINT [CK_DevolucionRutaDetalle_CantidadDanadaValida]
    CHECK ([CantidadDanada] >= 0 AND [CantidadDanada] <= [CantidadRecibida]),
  CONSTRAINT [FK_DevolucionRutaDetalle_DevolucionRuta]
    FOREIGN KEY ([IdDevolucionRuta]) REFERENCES [dbo].[DevolucionRuta]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_DevolucionRutaDetalle_InventarioItem]
    FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_DevolucionRutaDetalle_Devolucion_Item]
  ON [dbo].[DevolucionRutaDetalle]([IdDevolucionRuta], [IdInventarioItem]);
CREATE NONCLUSTERED INDEX [IX_DevolucionRutaDetalle_InventarioItem]
  ON [dbo].[DevolucionRutaDetalle]([IdInventarioItem]);

CREATE TABLE [dbo].[AjusteRuta] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdRutaSesion] INT NOT NULL,
  [IdInventarioItem] INT NOT NULL,
  [IdUsuario] INT NOT NULL,
  [Clasificacion] VARCHAR(30) NOT NULL,
  [Cantidad] FLOAT NOT NULL,
  [Motivo] VARCHAR(255) NOT NULL,
  [FechaRegistro] DATETIME CONSTRAINT [DF_AjusteRuta_FechaRegistro] DEFAULT GETDATE(),
  CONSTRAINT [PK_AjusteRuta] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [CK_AjusteRuta_CantidadPositiva] CHECK ([Cantidad] > 0),
  CONSTRAINT [CK_AjusteRuta_Clasificacion]
    CHECK ([Clasificacion] IN ('FALTANTE', 'DANADO', 'OTRO')),
  CONSTRAINT [FK_AjusteRuta_RutaSesion]
    FOREIGN KEY ([IdRutaSesion]) REFERENCES [dbo].[RutaSesion]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_AjusteRuta_InventarioItem]
    FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_AjusteRuta_Usuario]
    FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_AjusteRuta_Sesion_Item]
  ON [dbo].[AjusteRuta]([IdRutaSesion], [IdInventarioItem]);
