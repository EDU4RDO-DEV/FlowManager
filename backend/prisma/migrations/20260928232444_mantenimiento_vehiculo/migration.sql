BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[MantenimientoVehiculo] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdVehiculo] INT NOT NULL,
    [IdProveedor] INT,
    [IdUsuario] INT NOT NULL,
    [TipoMantenimiento] VARCHAR(20) NOT NULL,
    [Descripcion] VARCHAR(255) NOT NULL,
    [FechaMantenimiento] DATE NOT NULL,
    [Costo] DECIMAL(10,2),
    [Estado] VARCHAR(20) NOT NULL CONSTRAINT [DF_MantenimientoVehiculo_Estado] DEFAULT 'PROGRAMADO',
    [ProximoMantenimiento] DATE,
    [Observaciones] VARCHAR(255),
    [RutaImagen] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF_MantenimientoVehiculo_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_MantenimientoVehiculo_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_MantenimientoVehiculo] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_MantenimientoVehiculo_Vehiculo_Activo] ON [dbo].[MantenimientoVehiculo]([IdVehiculo], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_MantenimientoVehiculo_Estado_Activo] ON [dbo].[MantenimientoVehiculo]([Estado], [Anulado]);

-- AddForeignKey
ALTER TABLE [dbo].[MantenimientoVehiculo] ADD CONSTRAINT [FK_MantenimientoVehiculo_Vehiculo] FOREIGN KEY ([IdVehiculo]) REFERENCES [dbo].[Vehiculo]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MantenimientoVehiculo] ADD CONSTRAINT [FK_MantenimientoVehiculo_Proveedor] FOREIGN KEY ([IdProveedor]) REFERENCES [dbo].[Proveedor]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MantenimientoVehiculo] ADD CONSTRAINT [FK_MantenimientoVehiculo_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
