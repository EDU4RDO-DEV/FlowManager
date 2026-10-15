ALTER TABLE [dbo].[InventarioItem]
  ADD [UnidadMedida] VARCHAR(30) NULL;

IF OBJECT_ID(N'[dbo].[CK_InventarioItem_Existencia_NoNegativa]', N'C') IS NOT NULL
  ALTER TABLE [dbo].[InventarioItem]
    DROP CONSTRAINT [CK_InventarioItem_Existencia_NoNegativa];

IF OBJECT_ID(N'[dbo].[CK_BitacoraInventario_ExistenciaAnterior_NoNegativa]', N'C') IS NOT NULL
  ALTER TABLE [dbo].[BitacoraInventario]
    DROP CONSTRAINT [CK_BitacoraInventario_ExistenciaAnterior_NoNegativa];

IF OBJECT_ID(N'[dbo].[CK_BitacoraInventario_NuevaExistencia_NoNegativa]', N'C') IS NOT NULL
  ALTER TABLE [dbo].[BitacoraInventario]
    DROP CONSTRAINT [CK_BitacoraInventario_NuevaExistencia_NoNegativa];

CREATE TABLE [dbo].[OrdenProduccion] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdProductoTerminado] INT NOT NULL,
  [NombreProductoTerminadoSnapshot] VARCHAR(255) NOT NULL,
  [CantidadProducir] FLOAT NOT NULL,
  [UnidadMedidaSnapshot] VARCHAR(30) NOT NULL,
  [Estado] VARCHAR(20) NOT NULL CONSTRAINT [DF_OrdenProduccion_Estado] DEFAULT ('PENDIENTE'),
  [IdUsuario] INT NOT NULL,
  [FechaRegistro] DATETIME CONSTRAINT [DF_OrdenProduccion_FechaRegistro] DEFAULT GETDATE(),
  [IdUsuarioModificador] INT NULL,
  [FechaModificacion] DATETIME NULL,
  [Anulado] BIT NOT NULL CONSTRAINT [DF_OrdenProduccion_Anulado] DEFAULT (0),
  [IdUsuarioAnulador] INT NULL,
  [FechaAnulacion] DATETIME NULL,
  CONSTRAINT [PK_OrdenProduccion] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [CK_OrdenProduccion_CantidadPositiva] CHECK ([CantidadProducir] > 0),
  CONSTRAINT [CK_OrdenProduccion_Estado] CHECK ([Estado] IN ('PENDIENTE', 'FABRICADA', 'CANCELADA')),
  CONSTRAINT [FK_OrdenProduccion_ProductoTerminado]
    FOREIGN KEY ([IdProductoTerminado]) REFERENCES [dbo].[InventarioItem]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_OrdenProduccion_Usuario]
    FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE NONCLUSTERED INDEX [IX_OrdenProduccion_Estado_Fecha]
  ON [dbo].[OrdenProduccion]([Estado], [Anulado], [FechaRegistro]);

CREATE TABLE [dbo].[DetalleOrdenProduccion] (
  [Id] INT IDENTITY(1,1) NOT NULL,
  [IdOrdenProduccion] INT NOT NULL,
  [IdInventarioItem] INT NOT NULL,
  [NombreSnapshot] VARCHAR(255) NOT NULL,
  [CantidadPorUnidad] FLOAT NOT NULL,
  [CantidadTotal] FLOAT NOT NULL,
  [UnidadMedidaSnapshot] VARCHAR(30) NOT NULL,
  CONSTRAINT [PK_DetalleOrdenProduccion] PRIMARY KEY CLUSTERED ([Id]),
  CONSTRAINT [CK_DetalleOrdenProduccion_CantidadPorUnidadPositiva] CHECK ([CantidadPorUnidad] > 0),
  CONSTRAINT [CK_DetalleOrdenProduccion_CantidadTotalPositiva] CHECK ([CantidadTotal] > 0),
  CONSTRAINT [FK_DetalleOrdenProduccion_Orden]
    FOREIGN KEY ([IdOrdenProduccion]) REFERENCES [dbo].[OrdenProduccion]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [FK_DetalleOrdenProduccion_InventarioItem]
    FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id])
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_DetalleOrdenProduccion_Orden_Item]
  ON [dbo].[DetalleOrdenProduccion]([IdOrdenProduccion], [IdInventarioItem]);

CREATE NONCLUSTERED INDEX [IX_DetalleOrdenProduccion_InventarioItem]
  ON [dbo].[DetalleOrdenProduccion]([IdInventarioItem]);

IF NOT EXISTS (SELECT 1 FROM [dbo].[AccionSistema] WHERE [Clave] = 'allow-negative-stock')
  INSERT INTO [dbo].[AccionSistema] ([Clave], [Nombre], [Anulado])
  VALUES ('allow-negative-stock', 'Permitir saldo negativo', 0);

IF NOT EXISTS (SELECT 1 FROM [dbo].[ModuloSistema] WHERE [Clave] = 'produccion')
  INSERT INTO [dbo].[ModuloSistema] ([Clave], [Nombre], [Anulado])
  VALUES ('produccion', 'Produccion', 0);

DECLARE @productionModuleId INT =
  (SELECT TOP (1) [Id] FROM [dbo].[ModuloSistema] WHERE [Clave] = 'produccion' AND [Anulado] = 0 ORDER BY [Id]);
DECLARE @negativeStockActionId INT =
  (SELECT TOP (1) [Id] FROM [dbo].[AccionSistema] WHERE [Clave] = 'allow-negative-stock' AND [Anulado] = 0 ORDER BY [Id]);

INSERT INTO [dbo].[RolPermiso]
  ([IdRol], [IdModuloSistema], [IdAccionSistema], [Permitido], [IdUsuario], [Anulado])
SELECT r.[Id], @productionModuleId, @negativeStockActionId, 1, u.[Id], 0
FROM [dbo].[Rol] r
CROSS JOIN (SELECT TOP (1) [Id] FROM [dbo].[Usuario] WHERE [Anulado] = 0 ORDER BY [Id]) u
WHERE r.[Nombre] = 'Administrador'
  AND r.[Anulado] = 0
  AND @productionModuleId IS NOT NULL
  AND @negativeStockActionId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM [dbo].[RolPermiso] rp
    WHERE rp.[IdRol] = r.[Id]
      AND rp.[IdModuloSistema] = @productionModuleId
      AND rp.[IdAccionSistema] = @negativeStockActionId
      AND rp.[Anulado] = 0
      AND rp.[Permitido] = 1
  );
