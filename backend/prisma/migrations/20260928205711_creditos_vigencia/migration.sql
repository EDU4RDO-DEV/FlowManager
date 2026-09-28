/*
  Warnings:

  - A unique constraint covering the columns `[IdCliente,FechaFinVigencia,Anulado]` on the table `ClienteCondicionCredito` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

-- CreateIndex
ALTER TABLE [dbo].[ClienteCondicionCredito] ADD CONSTRAINT [UQ_ClienteCondicionCredito_Vigencia] UNIQUE NONCLUSTERED ([IdCliente], [FechaFinVigencia], [Anulado]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
