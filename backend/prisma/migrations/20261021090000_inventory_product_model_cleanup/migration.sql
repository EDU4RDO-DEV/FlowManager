BEGIN TRY
  BEGIN TRAN;

  IF EXISTS (
    SELECT 1
    FROM [dbo].[InventarioItem]
    WHERE [Categoria] = N'ENVASE'
       OR [Categoria] NOT IN (N'PRODUCTO_TERMINADO', N'MATERIA_PRIMA', N'INSUMO')
  )
  BEGIN
    THROW 51001, 'Clasifique manualmente los productos con categorías fuera de PRODUCTO_TERMINADO, MATERIA_PRIMA e INSUMO antes de aplicar esta migración; no se reasignarán categorías ni capacidades por nombre o flags.', 1;
  END;

  IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_InventarioItem_EnvasePresentacion'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[InventarioItem]')
  )
  BEGIN
    ALTER TABLE [dbo].[InventarioItem]
      DROP CONSTRAINT [FK_InventarioItem_EnvasePresentacion];
  END;

  IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_InventarioItem_UnidadesEnvase'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[InventarioItem]')
  )
  BEGIN
    ALTER TABLE [dbo].[InventarioItem]
      DROP CONSTRAINT [CK_InventarioItem_UnidadesEnvase];
  END;

  IF COL_LENGTH(N'dbo.InventarioItem', N'IdEnvasePresentacion') IS NOT NULL
  BEGIN
    ALTER TABLE [dbo].[InventarioItem]
      DROP COLUMN [IdEnvasePresentacion];
  END;

  IF COL_LENGTH(N'dbo.InventarioItem', N'UnidadesEnvasePorUnidad') IS NOT NULL
  BEGIN
    ALTER TABLE [dbo].[InventarioItem]
      DROP COLUMN [UnidadesEnvasePorUnidad];
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_InventarioItem_Categoria'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[InventarioItem]')
  )
  BEGIN
    ALTER TABLE [dbo].[InventarioItem]
      ADD CONSTRAINT [CK_InventarioItem_Categoria]
      CHECK ([Categoria] IN (N'PRODUCTO_TERMINADO', N'MATERIA_PRIMA', N'INSUMO'));
  END;

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
  BEGIN
    ROLLBACK TRAN;
  END;
  THROW;
END CATCH;
