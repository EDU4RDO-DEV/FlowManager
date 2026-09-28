BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[ControlCalidadAgua] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [Fecha] DATE NOT NULL,
    [DiaNoLaborado] BIT NOT NULL CONSTRAINT [DF_ControlCalidadAgua_DiaNoLaborado] DEFAULT 0,
    [CloroAntesFiltrado] DECIMAL(5,2),
    [CloroDespuesFiltrado] DECIMAL(5,2),
    [PhAntesFiltrado] DECIMAL(4,2),
    [PhDespuesFiltrado] DECIMAL(4,2),
    [Observaciones] VARCHAR(255),
    [Validado] BIT NOT NULL CONSTRAINT [DF_ControlCalidadAgua_Validado] DEFAULT 0,
    [IdUsuarioValidador] INT,
    [FechaValidacion] DATETIME,
    [FechaRegistro] DATETIME CONSTRAINT [DF_ControlCalidadAgua_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_ControlCalidadAgua_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_ControlCalidadAgua] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ControlCalidadAgua_Fecha_Activo] ON [dbo].[ControlCalidadAgua]([Fecha], [Anulado]);

-- AddForeignKey
ALTER TABLE [dbo].[ControlCalidadAgua] ADD CONSTRAINT [FK_ControlCalidadAgua_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ControlCalidadAgua] ADD CONSTRAINT [FK_ControlCalidadAgua_UsuarioValidador] FOREIGN KEY ([IdUsuarioValidador]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
