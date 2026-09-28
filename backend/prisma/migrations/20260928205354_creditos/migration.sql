BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[TipoCredito] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [Nombre] VARCHAR(100) NOT NULL,
    [PlazoDias] INT,
    [IncrementoPorcentual] DECIMAL(5,2),
    [RequiereCamion] BIT NOT NULL CONSTRAINT [DF_TipoCredito_RequiereCamion] DEFAULT 0,
    [Condiciones] VARCHAR(500),
    [Activo] BIT NOT NULL CONSTRAINT [DF_TipoCredito_Activo] DEFAULT 1,
    [FechaRegistro] DATETIME CONSTRAINT [DF_TipoCredito_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_TipoCredito_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_TipoCredito] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[ClienteCondicionCredito] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdCliente] INT NOT NULL,
    [IdTipoCredito] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [HabilitadoCredito] BIT NOT NULL CONSTRAINT [DF_ClienteCondicionCredito_Habilitado] DEFAULT 1,
    [FechaInicioVigencia] DATE NOT NULL,
    [FechaFinVigencia] DATE,
    [Observaciones] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF_ClienteCondicionCredito_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_ClienteCondicionCredito_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_ClienteCondicionCredito] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[CuentaPorCobrar] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdVenta] INT NOT NULL,
    [IdTipoCreditoAplicado] INT,
    [IdClienteCondicionCreditoAplicada] INT,
    [IdUsuarioCreacion] INT NOT NULL,
    [TotalOriginal] DECIMAL(10,2) NOT NULL,
    [Estado] VARCHAR(20) NOT NULL,
    [FechaCreacion] DATETIME CONSTRAINT [DF_CuentaPorCobrar_FechaCreacion] DEFAULT CURRENT_TIMESTAMP,
    [FechaVencimiento] DATE,
    [FechaLiquidacion] DATETIME,
    [MotivoCierre] VARCHAR(255),
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_CuentaPorCobrar_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_CuentaPorCobrar] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_CuentaPorCobrar_IdVenta] UNIQUE NONCLUSTERED ([IdVenta])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_TipoCredito_Nombre_Activo] ON [dbo].[TipoCredito]([Nombre], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_TipoCredito_Activo] ON [dbo].[TipoCredito]([Activo], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ClienteCondicionCredito_ClienteVigencia] ON [dbo].[ClienteCondicionCredito]([IdCliente], [Anulado], [FechaInicioVigencia]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ClienteCondicionCredito_Habilitado] ON [dbo].[ClienteCondicionCredito]([IdCliente], [HabilitadoCredito], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_CuentaPorCobrar_Estado_Activo] ON [dbo].[CuentaPorCobrar]([Estado], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_CuentaPorCobrar_FechaCreacion] ON [dbo].[CuentaPorCobrar]([FechaCreacion]);

-- AddForeignKey
ALTER TABLE [dbo].[TipoCredito] ADD CONSTRAINT [FK_TipoCredito_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ClienteCondicionCredito] ADD CONSTRAINT [FK_ClienteCondicionCredito_Cliente] FOREIGN KEY ([IdCliente]) REFERENCES [dbo].[Cliente]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ClienteCondicionCredito] ADD CONSTRAINT [FK_ClienteCondicionCredito_TipoCredito] FOREIGN KEY ([IdTipoCredito]) REFERENCES [dbo].[TipoCredito]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ClienteCondicionCredito] ADD CONSTRAINT [FK_ClienteCondicionCredito_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CuentaPorCobrar] ADD CONSTRAINT [FK_CuentaPorCobrar_ClienteCondicionCredito] FOREIGN KEY ([IdClienteCondicionCreditoAplicada]) REFERENCES [dbo].[ClienteCondicionCredito]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CuentaPorCobrar] ADD CONSTRAINT [FK_CuentaPorCobrar_TipoCredito] FOREIGN KEY ([IdTipoCreditoAplicado]) REFERENCES [dbo].[TipoCredito]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CuentaPorCobrar] ADD CONSTRAINT [FK_CuentaPorCobrar_Usuario] FOREIGN KEY ([IdUsuarioCreacion]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CuentaPorCobrar] ADD CONSTRAINT [FK_CuentaPorCobrar_Venta] FOREIGN KEY ([IdVenta]) REFERENCES [dbo].[Venta]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
