BEGIN TRY
  BEGIN TRAN;

  ALTER TABLE [dbo].[InventarioItem]
    ADD [EsVendible] BIT NOT NULL CONSTRAINT [DF_InventarioItem_EsVendible] DEFAULT (0),
        [EsEnvaseRetornable] BIT NOT NULL CONSTRAINT [DF_InventarioItem_EsEnvaseRetornable] DEFAULT (0),
        [CapacidadEnvaseGalones] DECIMAL(8,3) NULL,
        [IdEnvasePresentacion] INT NULL,
        [UnidadesEnvasePorUnidad] INT NULL;

  EXEC sys.sp_executesql N'
    UPDATE [dbo].[InventarioItem]
      SET [EsVendible] = 1
      WHERE [Categoria] = N''PRODUCTO_TERMINADO'';
  ';

  EXEC sys.sp_executesql N'
    UPDATE [dbo].[InventarioItem]
      SET [EsEnvaseRetornable] = 1
      WHERE [Categoria] = N''ENVASE'';
  ';

  EXEC sys.sp_executesql N'
    ALTER TABLE [dbo].[InventarioItem]
      ADD CONSTRAINT [FK_InventarioItem_EnvasePresentacion]
        FOREIGN KEY ([IdEnvasePresentacion]) REFERENCES [dbo].[InventarioItem]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT [CK_InventarioItem_CapacidadEnvase]
        CHECK ([CapacidadEnvaseGalones] IS NULL OR [CapacidadEnvaseGalones] > 0),
          CONSTRAINT [CK_InventarioItem_UnidadesEnvase]
        CHECK ([UnidadesEnvasePorUnidad] IS NULL OR [UnidadesEnvasePorUnidad] > 0);
  ';

  ALTER TABLE [dbo].[BitacoraInventario]
    ADD [ClaveMovimiento] UNIQUEIDENTIFIER NULL,
        [UbicacionEnvase] VARCHAR(30) NULL,
        [EstadoEnvase] VARCHAR(30) NULL,
        [IdRutaSesion] INT NULL,
        [IdMovimientoEnvase] INT NULL,
        [IdDetalleVenta] INT NULL;

  EXEC sys.sp_executesql N'
    ALTER TABLE [dbo].[BitacoraInventario]
      ADD CONSTRAINT [FK_BitacoraInventario_RutaSesion]
        FOREIGN KEY ([IdRutaSesion]) REFERENCES [dbo].[RutaSesion]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT [FK_BitacoraInventario_MovimientoEnvase]
        FOREIGN KEY ([IdMovimientoEnvase]) REFERENCES [dbo].[MovimientoEnvase]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT [FK_BitacoraInventario_DetalleVenta]
        FOREIGN KEY ([IdDetalleVenta]) REFERENCES [dbo].[DetalleVenta]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT [CK_BitacoraInventario_EnvaseDimensions]
        CHECK (
          ([UbicacionEnvase] IS NULL AND [EstadoEnvase] IS NULL AND [IdRutaSesion] IS NULL)
          OR (
            [UbicacionEnvase] IN (N''PLANTA'', N''RUTA'', N''CUARENTENA'')
            AND [EstadoEnvase] IN (N''VACIO'', N''LLENO'', N''DANADO'', N''PENDIENTE_CONTEO'')
            AND (
              ([UbicacionEnvase] = N''RUTA'' AND [IdRutaSesion] IS NOT NULL)
              OR ([UbicacionEnvase] IN (N''PLANTA'', N''CUARENTENA'') AND [IdRutaSesion] IS NULL)
            )
          )
        );
  ';

  EXEC sys.sp_executesql N'
    CREATE NONCLUSTERED INDEX [IX_BitacoraInventario_EnvaseEstadoUbicacion]
      ON [dbo].[BitacoraInventario]
        ([IdInventarioItem], [UbicacionEnvase], [EstadoEnvase], [IdRutaSesion], [Anulado]);
  ';

  EXEC sys.sp_executesql N'
    CREATE NONCLUSTERED INDEX [IX_BitacoraInventario_ClaveMovimiento]
      ON [dbo].[BitacoraInventario]([ClaveMovimiento]);
  ';

  ALTER TABLE [dbo].[DetalleVenta]
    ADD [EstadoEnvase] VARCHAR(30) NULL;

  EXEC sys.sp_executesql N'
    ALTER TABLE [dbo].[DetalleVenta]
      ADD CONSTRAINT [CK_DetalleVenta_EstadoEnvase]
        CHECK ([EstadoEnvase] IS NULL OR [EstadoEnvase] IN (N''VACIO'', N''LLENO''));
  ';

  ALTER TABLE [dbo].[DespachoRutaDetalle]
    ADD [EstadoEnvase] VARCHAR(30) NULL;

  EXEC sys.sp_executesql N'
    ALTER TABLE [dbo].[DespachoRutaDetalle]
      ADD CONSTRAINT [CK_DespachoRutaDetalle_EstadoEnvase]
        CHECK ([EstadoEnvase] IS NULL OR [EstadoEnvase] IN (N''VACIO'', N''LLENO''));
  ';

  ALTER TABLE [dbo].[DevolucionRutaDetalle]
    ADD [CantidadEnvaseVacio] FLOAT NOT NULL
      CONSTRAINT [DF_DevolucionRutaDetalle_CantidadEnvaseVacio] DEFAULT (0),
        [CantidadEnvaseLleno] FLOAT NOT NULL
      CONSTRAINT [DF_DevolucionRutaDetalle_CantidadEnvaseLleno] DEFAULT (0),
        [EstadoEnvaseDanado] VARCHAR(30) NULL;

  EXEC sys.sp_executesql N'
    ALTER TABLE [dbo].[DevolucionRutaDetalle]
      ADD CONSTRAINT [CK_DevolucionRutaDetalle_CantidadEnvase]
        CHECK ([CantidadEnvaseVacio] >= 0 AND [CantidadEnvaseLleno] >= 0),
          CONSTRAINT [CK_DevolucionRutaDetalle_EstadoEnvaseDanado]
        CHECK ([EstadoEnvaseDanado] IS NULL OR [EstadoEnvaseDanado] IN (N''VACIO'', N''LLENO''));
  ';

  CREATE TABLE [dbo].[DetalleVentaEnvase] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdDetalleVenta] INT NOT NULL,
    [IdInventarioItemEnvase] INT NOT NULL,
    [Modo] VARCHAR(30) NOT NULL,
    [Cantidad] INT NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF_DetalleVentaEnvase_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_DetalleVentaEnvase] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [CK_DetalleVentaEnvase_Modo]
      CHECK ([Modo] IN ('CLIENTE_PROPIO', 'PRESTAMO_EMPRESA')),
    CONSTRAINT [CK_DetalleVentaEnvase_Cantidad]
      CHECK ([Cantidad] > 0),
    CONSTRAINT [FK_DetalleVentaEnvase_DetalleVenta]
      FOREIGN KEY ([IdDetalleVenta]) REFERENCES [dbo].[DetalleVenta]([Id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_DetalleVentaEnvase_InventarioItem]
      FOREIGN KEY ([IdInventarioItemEnvase]) REFERENCES [dbo].[InventarioItem]([Id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );

  EXEC sys.sp_executesql N'
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_DetalleVentaEnvase_Detalle_Item_Modo]
      ON [dbo].[DetalleVentaEnvase]([IdDetalleVenta], [IdInventarioItemEnvase], [Modo]);
  ';

  EXEC sys.sp_executesql N'
    CREATE NONCLUSTERED INDEX [IX_DetalleVentaEnvase_InventarioItem]
      ON [dbo].[DetalleVentaEnvase]([IdInventarioItemEnvase]);
  ';

  ALTER TABLE [dbo].[MovimientoEnvase]
    ADD [IdDetalleVentaEnvase] INT NULL,
        [IdRutaSesion] INT NULL,
        [EstadoEnvase] VARCHAR(30) NULL,
        [UbicacionEnvase] VARCHAR(30) NULL;

  ALTER TABLE [dbo].[MovimientoEnvase]
    ALTER COLUMN [IdCliente] INT NULL;

  EXEC sys.sp_executesql N'
    ALTER TABLE [dbo].[MovimientoEnvase]
      ADD CONSTRAINT [FK_MovimientoEnvase_DetalleVentaEnvase]
        FOREIGN KEY ([IdDetalleVentaEnvase]) REFERENCES [dbo].[DetalleVentaEnvase]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT [FK_MovimientoEnvase_RutaSesion]
        FOREIGN KEY ([IdRutaSesion]) REFERENCES [dbo].[RutaSesion]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT [CK_MovimientoEnvase_Tipo]
        CHECK ([TipoMovimiento] IN (N''PRESTAMO'', N''DEVOLUCION'', N''DEVOLUCION_DANADA'', N''PERDIDA'', N''BAJA'')),
          CONSTRAINT [CK_MovimientoEnvase_EnvaseDimensions]
        CHECK (
          ([EstadoEnvase] IS NULL AND [UbicacionEnvase] IS NULL AND [IdRutaSesion] IS NULL)
          OR (
            [EstadoEnvase] IN (N''VACIO'', N''LLENO'', N''DANADO'', N''PENDIENTE_CONTEO'')
            AND [UbicacionEnvase] IN (N''PLANTA'', N''RUTA'', N''CUARENTENA'')
            AND (
              ([UbicacionEnvase] = N''RUTA'' AND [IdRutaSesion] IS NOT NULL)
              OR ([UbicacionEnvase] IN (N''PLANTA'', N''CUARENTENA'') AND [IdRutaSesion] IS NULL)
            )
          )
        );
  ';

  EXEC sys.sp_executesql N'
    CREATE NONCLUSTERED INDEX [IX_MovimientoEnvase_DetalleVentaEnvase]
      ON [dbo].[MovimientoEnvase]([IdDetalleVentaEnvase]);
  ';

  EXEC sys.sp_executesql N'
    CREATE NONCLUSTERED INDEX [IX_MovimientoEnvase_Ruta_Activo]
      ON [dbo].[MovimientoEnvase]([IdRutaSesion], [Anulado]);
  ';

  EXEC sys.sp_executesql N'
    INSERT INTO [dbo].[BitacoraInventario] (
      [IdInventarioItem],
      [IdUsuario],
      [ClaveMovimiento],
      [UbicacionEnvase],
      [EstadoEnvase],
      [TipoDocumento],
      [Documento],
      [Nombre],
      [TipoMovimiento],
      [ExistenciaAnterior],
      [Cantidad],
      [NuevaExistencia],
      [Anulado]
    )
    SELECT
      item.[Id],
      item.[IdUsuario],
      NEWID(),
      N''PLANTA'',
      N''PENDIENTE_CONTEO'',
      N''ENVOPN'',
      CONVERT(VARCHAR(10), item.[Id]),
      CONCAT(N''Saldo inicial pendiente de conteo - '', item.[Nombre]),
      1,
      0,
      item.[Existencia],
      item.[Existencia],
      0
    FROM [dbo].[InventarioItem] AS item
    WHERE item.[Categoria] = N''ENVASE''
      AND item.[Anulado] = 0
      AND item.[Existencia] > 0;
  ';

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
  BEGIN
    ROLLBACK TRAN;
  END;
  THROW;
END CATCH;
