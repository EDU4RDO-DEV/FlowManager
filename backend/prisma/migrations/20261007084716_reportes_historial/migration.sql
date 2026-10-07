BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[ReporteHistorial] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [ClaveReporte] VARCHAR(100) NOT NULL,
    [Categoria] VARCHAR(50) NOT NULL,
    [NombreReporte] VARCHAR(150) NOT NULL,
    [Parametros] VARCHAR(max),
    [TotalRegistros] INT,
    [FormatoExportado] VARCHAR(20),
    [FechaGeneracion] DATETIME CONSTRAINT [DF_ReporteHistorial_FechaGeneracion] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_ReporteHistorial] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ReporteHistorial_Clave_Fecha] ON [dbo].[ReporteHistorial]([ClaveReporte], [FechaGeneracion]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ReporteHistorial_Usuario_Fecha] ON [dbo].[ReporteHistorial]([IdUsuario], [FechaGeneracion]);

-- AddForeignKey
ALTER TABLE [dbo].[ReporteHistorial] ADD CONSTRAINT [FK_ReporteHistorial_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
