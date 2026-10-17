BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[InventarioItem] ADD [ActualizarCostoSegunReceta] BIT NOT NULL CONSTRAINT [DF_InventarioItem_ActualizarCostoSegunReceta] DEFAULT 0;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
