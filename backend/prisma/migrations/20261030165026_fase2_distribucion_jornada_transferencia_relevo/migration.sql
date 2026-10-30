BEGIN TRY

BEGIN TRAN;

-- NOTA: Prisma detectó un drift preexistente y no relacionado con esta fase en
-- FK_DespachoRuta_UsuarioAnulador (ON DELETE NO ACTION en la base real vs. SetNull
-- implícito en schema.prisma, documentado desde antes de este cambio). Se excluye
-- deliberadamente del script para no alterar funcionalidad ajena a Fase 2; ver
-- DECISIONES_TECNICAS_PENDIENTES.md.

-- AlterTable
ALTER TABLE [dbo].[RutaSesion] ADD [IdJornada] INT;

-- CreateTable
CREATE TABLE [dbo].[Jornada] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [Fecha] DATE NOT NULL,
    [Estado] VARCHAR(20) NOT NULL CONSTRAINT [DF_Jornada_Estado] DEFAULT 'ABIERTA',
    [IdUsuarioResponsable] INT,
    [Observaciones] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF_Jornada_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_Jornada_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_Jornada] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[TransferenciaVehiculo] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdRutaSesionOrigen] INT NOT NULL,
    [IdRutaSesionDestino] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [Motivo] VARCHAR(255) NOT NULL,
    [EstadoConfirmacion] VARCHAR(20) NOT NULL CONSTRAINT [DF_TransferenciaVehiculo_EstadoConfirmacion] DEFAULT 'PENDIENTE',
    [IdUsuarioConfirma] INT,
    [FechaConfirmacion] DATETIME,
    [FechaRegistro] DATETIME CONSTRAINT [DF_TransferenciaVehiculo_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_TransferenciaVehiculo_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    [MotivoAnulacion] VARCHAR(255),
    CONSTRAINT [PK_TransferenciaVehiculo] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[TransferenciaVehiculoDetalle] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdTransferenciaVehiculo] INT NOT NULL,
    [IdInventarioItem] INT NOT NULL,
    [NombreSnapshot] VARCHAR(255) NOT NULL,
    [UnidadMedidaSnapshot] VARCHAR(30),
    [Cantidad] FLOAT(53) NOT NULL,
    [EstadoEnvase] VARCHAR(30),
    CONSTRAINT [PK_TransferenciaVehiculoDetalle] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_TransferenciaVehiculoDetalle_Transferencia_Item] UNIQUE NONCLUSTERED ([IdTransferenciaVehiculo],[IdInventarioItem],[EstadoEnvase])
);

-- CreateTable
CREATE TABLE [dbo].[RelevoVehiculo] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdRutaSesionSaliente] INT NOT NULL,
    [IdRutaSesionEntrante] INT NOT NULL,
    [IdUsuarioAutoriza] INT NOT NULL,
    [Motivo] VARCHAR(255) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF_RelevoVehiculo_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_RelevoVehiculo_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_RelevoVehiculo] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_RelevoVehiculo_Entrante] UNIQUE NONCLUSTERED ([IdRutaSesionEntrante])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Jornada_Fecha_Activo] ON [dbo].[Jornada]([Fecha], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_TransferenciaVehiculo_Origen_Activo] ON [dbo].[TransferenciaVehiculo]([IdRutaSesionOrigen], [Anulado], [EstadoConfirmacion]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_TransferenciaVehiculo_Destino_Activo] ON [dbo].[TransferenciaVehiculo]([IdRutaSesionDestino], [Anulado], [EstadoConfirmacion]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_TransferenciaVehiculoDetalle_InventarioItem] ON [dbo].[TransferenciaVehiculoDetalle]([IdInventarioItem]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RelevoVehiculo_Saliente_Activo] ON [dbo].[RelevoVehiculo]([IdRutaSesionSaliente], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RutaSesion_Jornada] ON [dbo].[RutaSesion]([IdJornada]);

-- AddForeignKey
ALTER TABLE [dbo].[RutaSesion] ADD CONSTRAINT [FK_RutaSesion_Jornada] FOREIGN KEY ([IdJornada]) REFERENCES [dbo].[Jornada]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Jornada] ADD CONSTRAINT [FK_Jornada_UsuarioResponsable] FOREIGN KEY ([IdUsuarioResponsable]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TransferenciaVehiculo] ADD CONSTRAINT [FK_TransferenciaVehiculo_Origen] FOREIGN KEY ([IdRutaSesionOrigen]) REFERENCES [dbo].[RutaSesion]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TransferenciaVehiculo] ADD CONSTRAINT [FK_TransferenciaVehiculo_Destino] FOREIGN KEY ([IdRutaSesionDestino]) REFERENCES [dbo].[RutaSesion]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TransferenciaVehiculo] ADD CONSTRAINT [FK_TransferenciaVehiculo_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TransferenciaVehiculo] ADD CONSTRAINT [FK_TransferenciaVehiculo_UsuarioConfirma] FOREIGN KEY ([IdUsuarioConfirma]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TransferenciaVehiculo] ADD CONSTRAINT [FK_TransferenciaVehiculo_UsuarioAnulador] FOREIGN KEY ([IdUsuarioAnulador]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TransferenciaVehiculoDetalle] ADD CONSTRAINT [FK_TransferenciaVehiculoDetalle_Transferencia] FOREIGN KEY ([IdTransferenciaVehiculo]) REFERENCES [dbo].[TransferenciaVehiculo]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TransferenciaVehiculoDetalle] ADD CONSTRAINT [FK_TransferenciaVehiculoDetalle_InventarioItem] FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RelevoVehiculo] ADD CONSTRAINT [FK_RelevoVehiculo_Saliente] FOREIGN KEY ([IdRutaSesionSaliente]) REFERENCES [dbo].[RutaSesion]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RelevoVehiculo] ADD CONSTRAINT [FK_RelevoVehiculo_Entrante] FOREIGN KEY ([IdRutaSesionEntrante]) REFERENCES [dbo].[RutaSesion]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RelevoVehiculo] ADD CONSTRAINT [FK_RelevoVehiculo_Usuario] FOREIGN KEY ([IdUsuarioAutoriza]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RelevoVehiculo] ADD CONSTRAINT [FK_RelevoVehiculo_UsuarioAnulador] FOREIGN KEY ([IdUsuarioAnulador]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
