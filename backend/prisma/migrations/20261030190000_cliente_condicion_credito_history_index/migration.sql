BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[ClienteCondicionCredito]
  DROP CONSTRAINT [UQ_ClienteCondicionCredito_Vigencia];

CREATE NONCLUSTERED INDEX [IX_ClienteCondicionCredito_Vigencia]
  ON [dbo].[ClienteCondicionCredito] ([IdCliente], [FechaFinVigencia], [Anulado]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
