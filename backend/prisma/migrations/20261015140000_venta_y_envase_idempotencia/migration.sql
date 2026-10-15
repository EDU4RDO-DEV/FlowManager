BEGIN TRY
  BEGIN TRAN;

  ALTER TABLE [dbo].[Venta]
    ADD [ClaveSolicitud] UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT [DF_Venta_ClaveSolicitud] DEFAULT (NEWID()),
        [HuellaSolicitud] CHAR(64) NULL;

  ALTER TABLE [dbo].[MovimientoEnvase]
    ADD [ClaveSolicitud] UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT [DF_MovimientoEnvase_ClaveSolicitud] DEFAULT (NEWID()),
        [HuellaSolicitud] CHAR(64) NULL;

  EXEC sys.sp_executesql N'
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_Venta_ClaveSolicitud]
      ON [dbo].[Venta]([ClaveSolicitud]);
  ';

  EXEC sys.sp_executesql N'
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_MovimientoEnvase_ClaveSolicitud]
      ON [dbo].[MovimientoEnvase]([ClaveSolicitud]);
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
