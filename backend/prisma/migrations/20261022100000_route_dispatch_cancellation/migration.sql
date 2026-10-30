ALTER TABLE [dbo].[DespachoRuta]
  ADD [Anulado] BIT NOT NULL CONSTRAINT [DF_DespachoRuta_Anulado] DEFAULT (0),
      [IdUsuarioAnulador] INT NULL,
      [FechaAnulacion] DATETIME NULL,
      [MotivoAnulacion] VARCHAR(255) NULL;

DROP INDEX [UQ_DespachoRuta_RutaSesion] ON [dbo].[DespachoRuta];

ALTER TABLE [dbo].[DespachoRuta]
  ADD CONSTRAINT [FK_DespachoRuta_UsuarioAnulador]
  FOREIGN KEY ([IdUsuarioAnulador]) REFERENCES [dbo].[Usuario]([Id])
  ON DELETE NO ACTION ON UPDATE NO ACTION;

EXEC(N'CREATE NONCLUSTERED INDEX [IX_DespachoRuta_IdRutaSesion_Anulado]
  ON [dbo].[DespachoRuta]([IdRutaSesion], [Anulado]);');

EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [UX_DespachoRuta_RutaSesion_Activo]
  ON [dbo].[DespachoRuta]([IdRutaSesion])
  WHERE [Anulado] = 0;');
