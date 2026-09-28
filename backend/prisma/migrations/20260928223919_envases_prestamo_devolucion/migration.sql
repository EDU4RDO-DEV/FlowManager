BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[MovimientoEnvase] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdInventarioItem] INT NOT NULL,
    [IdCliente] INT NOT NULL,
    [IdVenta] INT,
    [IdUsuario] INT NOT NULL,
    [TipoMovimiento] VARCHAR(20) NOT NULL,
    [Cantidad] FLOAT(53) NOT NULL,
    [SaldoAnterior] FLOAT(53) NOT NULL,
    [SaldoNuevo] FLOAT(53) NOT NULL,
    [RutaFirma] VARCHAR(255),
    [Observaciones] VARCHAR(255),
    [FechaMovimiento] DATETIME CONSTRAINT [DF_MovimientoEnvase_FechaMovimiento] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_MovimientoEnvase_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_MovimientoEnvase] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[EnvaseClienteSaldo] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdCliente] INT NOT NULL,
    [IdInventarioItem] INT NOT NULL,
    [CantidadPrestada] FLOAT(53) NOT NULL CONSTRAINT [DF_EnvaseClienteSaldo_Cantidad] DEFAULT 0,
    [FechaActualizacion] DATETIME CONSTRAINT [DF_EnvaseClienteSaldo_Fecha] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_EnvaseClienteSaldo] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_EnvaseClienteSaldo_ClienteEnvase] UNIQUE NONCLUSTERED ([IdCliente],[IdInventarioItem])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_MovimientoEnvase_ClienteEnvase_Activo] ON [dbo].[MovimientoEnvase]([IdCliente], [IdInventarioItem], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_MovimientoEnvase_Venta] ON [dbo].[MovimientoEnvase]([IdVenta]);

-- AddForeignKey
ALTER TABLE [dbo].[MovimientoEnvase] ADD CONSTRAINT [FK_MovimientoEnvase_InventarioItem] FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MovimientoEnvase] ADD CONSTRAINT [FK_MovimientoEnvase_Cliente] FOREIGN KEY ([IdCliente]) REFERENCES [dbo].[Cliente]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MovimientoEnvase] ADD CONSTRAINT [FK_MovimientoEnvase_Venta] FOREIGN KEY ([IdVenta]) REFERENCES [dbo].[Venta]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MovimientoEnvase] ADD CONSTRAINT [FK_MovimientoEnvase_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EnvaseClienteSaldo] ADD CONSTRAINT [FK_EnvaseClienteSaldo_Cliente] FOREIGN KEY ([IdCliente]) REFERENCES [dbo].[Cliente]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EnvaseClienteSaldo] ADD CONSTRAINT [FK_EnvaseClienteSaldo_InventarioItem] FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
