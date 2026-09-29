BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[EstructuraProducto] ADD [FechaModificacion] DATETIME,
[IdUsuarioModificador] INT;

-- AlterTable
ALTER TABLE [dbo].[Ruta] ADD [FechaAnulacion] DATETIME,
[FechaModificacion] DATETIME,
[IdUsuario] INT,
[IdUsuarioAnulador] INT,
[IdUsuarioModificador] INT;

-- AlterTable
ALTER TABLE [dbo].[Talonario] ADD [FechaModificacion] DATETIME,
[IdUsuarioModificador] INT;

-- AddForeignKey
ALTER TABLE [dbo].[Ruta] ADD CONSTRAINT [FK_Ruta_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
