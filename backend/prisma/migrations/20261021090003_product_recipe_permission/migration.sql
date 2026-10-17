BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[InventarioItem] ADD [PermitirReceta] BIT NOT NULL CONSTRAINT [DF_InventarioItem_PermitirReceta] DEFAULT 0;

-- Keep every product with recorded recipe components enabled for recipe management.
EXEC sys.sp_executesql N'
  UPDATE item
  SET PermitirReceta = 1
  FROM [dbo].[InventarioItem] AS item
  WHERE EXISTS (
    SELECT 1
    FROM [dbo].[EstructuraProducto] AS structure
    WHERE structure.IdProductoTerminado = item.Id
  );
';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
