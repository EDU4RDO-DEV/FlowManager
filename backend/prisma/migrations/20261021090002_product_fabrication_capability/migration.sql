BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[InventarioItem] ADD [EsFabricable] BIT NOT NULL CONSTRAINT [DF_InventarioItem_EsFabricable] DEFAULT 0;

-- Preserve the ability to fabricate products with existing active recipes or production history.
EXEC sys.sp_executesql N'
  UPDATE item
  SET EsFabricable = 1
  FROM [dbo].[InventarioItem] AS item
  WHERE item.EsFabricable = 0
    AND (
      EXISTS (
        SELECT 1
        FROM [dbo].[EstructuraProducto] AS structure
        WHERE structure.IdProductoTerminado = item.Id
          AND structure.Anulado = 0
      )
      OR EXISTS (
        SELECT 1
        FROM [dbo].[OrdenProduccion] AS productionOrder
        WHERE productionOrder.IdProductoTerminado = item.Id
      )
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
