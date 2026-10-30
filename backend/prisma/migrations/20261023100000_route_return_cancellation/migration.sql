ALTER TABLE [dbo].[DevolucionRuta]
  ADD [Anulado] BIT NOT NULL CONSTRAINT [DF_DevolucionRuta_Anulado] DEFAULT (0),
      [IdUsuarioAnulador] INT NULL,
      [FechaAnulacion] DATETIME NULL,
      [MotivoAnulacion] VARCHAR(255) NULL;

DROP INDEX [UQ_DevolucionRuta_RutaSesion] ON [dbo].[DevolucionRuta];

ALTER TABLE [dbo].[DevolucionRuta]
  ADD CONSTRAINT [FK_DevolucionRuta_UsuarioAnulador]
  FOREIGN KEY ([IdUsuarioAnulador]) REFERENCES [dbo].[Usuario]([Id])
  ON DELETE NO ACTION ON UPDATE NO ACTION;

EXEC(N'CREATE NONCLUSTERED INDEX [IX_DevolucionRuta_RutaSesion_Anulado]
  ON [dbo].[DevolucionRuta]([IdRutaSesion], [Anulado]);');

EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [UX_DevolucionRuta_RutaSesion_Activa]
  ON [dbo].[DevolucionRuta]([IdRutaSesion])
  WHERE [Anulado] = 0;');
