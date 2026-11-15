BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[IntentoEmisionFel] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [ClaveSolicitud] UNIQUEIDENTIFIER NOT NULL,
    [HuellaSolicitud] CHAR(64) NOT NULL,
    [IdVentaIntento] INT NOT NULL,
    [NumeroVentaIntento] INT NOT NULL,
    [AutorizacionFel] VARCHAR(255) NOT NULL,
    [SerieFel] VARCHAR(255) NOT NULL,
    [NumeroFel] VARCHAR(255) NOT NULL,
    [FechaCertificacionProveedor] DATETIME NOT NULL,
    [RutaPdfFel] VARCHAR(255),
    [Estado] VARCHAR(30) NOT NULL,
    [MotivoRechazo] VARCHAR(500),
    [FechaRegistro] DATETIME CONSTRAINT [DF_IntentoEmisionFel_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [FechaActualizacion] DATETIME,
    CONSTRAINT [PK_IntentoEmisionFel] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_IntentoEmisionFel_ClaveSolicitud] UNIQUE NONCLUSTERED ([ClaveSolicitud])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_IntentoEmisionFel_Venta] ON [dbo].[IntentoEmisionFel]([IdVentaIntento]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
