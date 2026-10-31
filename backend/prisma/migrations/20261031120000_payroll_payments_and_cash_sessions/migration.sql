ALTER TABLE [PlanillaMensual]
ADD [EstadoPago] VARCHAR(20) NULL;

ALTER TABLE [AdelantoEmpleado]
ADD [MetodoPago] VARCHAR(20) NULL,
    [NumeroReferencia] VARCHAR(100) NULL,
    [Banco] VARCHAR(100) NULL,
    [IdempotencyKeyHash] CHAR(64) NULL,
    [HuellaSolicitud] CHAR(64) NULL;

EXEC(N'
CREATE UNIQUE INDEX [UQ_AdelantoEmpleado_IdempotencyKey]
ON [AdelantoEmpleado]([IdempotencyKeyHash])
WHERE [IdempotencyKeyHash] IS NOT NULL;
');

CREATE INDEX [IX_AdelantoEmpleado_Saldo]
ON [AdelantoEmpleado]([IdEmpleado], [Anulado], [IdPlanillaMensual]);

CREATE TABLE [PlanillaDetalleAdelanto] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdAdelantoEmpleado] INT NOT NULL,
    [IdPlanillaMensual] INT NOT NULL,
    [MontoAplicado] DECIMAL(10,2) NOT NULL,
    [FechaAplicacion] DATETIME NOT NULL CONSTRAINT [DF_PlanillaDetalleAdelanto_Fecha] DEFAULT GETDATE(),
    [Anulado] BIT NOT NULL CONSTRAINT [DF_PlanillaDetalleAdelanto_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT NULL,
    [FechaAnulacion] DATETIME NULL,
    CONSTRAINT [PK_PlanillaDetalleAdelanto] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PlanillaDetalleAdelanto_Adelanto] FOREIGN KEY ([IdAdelantoEmpleado]) REFERENCES [AdelantoEmpleado]([Id]),
    CONSTRAINT [FK_PlanillaDetalleAdelanto_Planilla] FOREIGN KEY ([IdPlanillaMensual]) REFERENCES [PlanillaMensual]([Id]),
    CONSTRAINT [CK_PlanillaDetalleAdelanto_Monto] CHECK ([MontoAplicado] > 0)
);

CREATE UNIQUE INDEX [UQ_PlanillaDetalleAdelanto_Adelanto_Planilla]
ON [PlanillaDetalleAdelanto]([IdAdelantoEmpleado], [IdPlanillaMensual])
WHERE [Anulado] = 0;

CREATE INDEX [IX_PlanillaDetalleAdelanto_Saldo]
ON [PlanillaDetalleAdelanto]([IdAdelantoEmpleado], [IdPlanillaMensual], [Anulado]);

CREATE TABLE [PagoPlanillaEmpleado] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdPlanillaMensual] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [Monto] DECIMAL(10,2) NOT NULL,
    [MetodoPago] VARCHAR(20) NOT NULL,
    [NumeroReferencia] VARCHAR(100) NULL,
    [Banco] VARCHAR(100) NULL,
    [RutaComprobante] VARCHAR(255) NULL,
    [FechaPago] DATETIME NOT NULL CONSTRAINT [DF_PagoPlanillaEmpleado_FechaPago] DEFAULT GETDATE(),
    [IdempotencyKeyHash] CHAR(64) NOT NULL,
    [HuellaSolicitud] CHAR(64) NOT NULL,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_PagoPlanillaEmpleado_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT NULL,
    [FechaAnulacion] DATETIME NULL,
    [Observaciones] VARCHAR(255) NULL,
    CONSTRAINT [PK_PagoPlanillaEmpleado] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PagoPlanillaEmpleado_Planilla] FOREIGN KEY ([IdPlanillaMensual]) REFERENCES [PlanillaMensual]([Id]),
    CONSTRAINT [FK_PagoPlanillaEmpleado_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [Usuario]([Id]),
    CONSTRAINT [CK_PagoPlanillaEmpleado_Monto] CHECK ([Monto] > 0),
    CONSTRAINT [CK_PagoPlanillaEmpleado_MetodoPago] CHECK ([MetodoPago] IN ('EFECTIVO', 'TRANSFERENCIA'))
);

CREATE UNIQUE INDEX [UQ_PagoPlanillaEmpleado_IdempotencyKey]
ON [PagoPlanillaEmpleado]([IdempotencyKeyHash]);

CREATE INDEX [IX_PagoPlanillaEmpleado_Planilla_Fecha]
ON [PagoPlanillaEmpleado]([IdPlanillaMensual], [Anulado], [FechaPago]);

CREATE TABLE [CajaSesion] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [Estado] VARCHAR(20) NOT NULL CONSTRAINT [DF_CajaSesion_Estado] DEFAULT 'ABIERTA',
    [IdUsuarioApertura] INT NOT NULL,
    [FechaApertura] DATETIME NOT NULL CONSTRAINT [DF_CajaSesion_FechaApertura] DEFAULT GETDATE(),
    [SaldoInicial] DECIMAL(12,2) NOT NULL,
    [IdUsuarioCierre] INT NULL,
    [FechaCierre] DATETIME NULL,
    [EfectivoEsperado] DECIMAL(12,2) NULL,
    [EfectivoContado] DECIMAL(12,2) NULL,
    [DiferenciaEfectivo] DECIMAL(12,2) NULL,
    [ObservacionesCierre] VARCHAR(500) NULL,
    CONSTRAINT [PK_CajaSesion] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_CajaSesion_UsuarioApertura] FOREIGN KEY ([IdUsuarioApertura]) REFERENCES [Usuario]([Id]),
    CONSTRAINT [FK_CajaSesion_UsuarioCierre] FOREIGN KEY ([IdUsuarioCierre]) REFERENCES [Usuario]([Id]),
    CONSTRAINT [CK_CajaSesion_Estado] CHECK ([Estado] IN ('ABIERTA', 'CERRADA')),
    CONSTRAINT [CK_CajaSesion_SaldoInicial] CHECK ([SaldoInicial] >= 0),
    CONSTRAINT [CK_CajaSesion_Cierre] CHECK (
        ([Estado] = 'ABIERTA' AND [FechaCierre] IS NULL AND [IdUsuarioCierre] IS NULL)
        OR ([Estado] = 'CERRADA' AND [FechaCierre] IS NOT NULL AND [IdUsuarioCierre] IS NOT NULL)
    )
);

CREATE UNIQUE INDEX [UQ_CajaSesion_UnicaAbierta]
ON [CajaSesion]([Estado])
WHERE [Estado] = 'ABIERTA';

CREATE INDEX [IX_CajaSesion_Estado_Apertura]
ON [CajaSesion]([Estado], [FechaApertura]);

CREATE TABLE [MovimientoCaja] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdCajaSesion] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [IdPagoVenta] INT NULL,
    [IdPagoPlanilla] INT NULL,
    [IdAdelantoEmpleado] INT NULL,
    [IdMovimientoReversado] INT NULL,
    [Tipo] VARCHAR(10) NOT NULL,
    [MetodoPago] VARCHAR(20) NOT NULL,
    [Monto] DECIMAL(12,2) NOT NULL,
    [FechaMovimiento] DATETIME NOT NULL CONSTRAINT [DF_MovimientoCaja_FechaMovimiento] DEFAULT GETDATE(),
    [Concepto] VARCHAR(255) NOT NULL,
    CONSTRAINT [PK_MovimientoCaja] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_MovimientoCaja_CajaSesion] FOREIGN KEY ([IdCajaSesion]) REFERENCES [CajaSesion]([Id]),
    CONSTRAINT [FK_MovimientoCaja_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [Usuario]([Id]),
    CONSTRAINT [FK_MovimientoCaja_PagoVenta] FOREIGN KEY ([IdPagoVenta]) REFERENCES [PagoVenta]([Id]),
    CONSTRAINT [FK_MovimientoCaja_PagoPlanilla] FOREIGN KEY ([IdPagoPlanilla]) REFERENCES [PagoPlanillaEmpleado]([Id]),
    CONSTRAINT [FK_MovimientoCaja_Adelanto] FOREIGN KEY ([IdAdelantoEmpleado]) REFERENCES [AdelantoEmpleado]([Id]),
    CONSTRAINT [FK_MovimientoCaja_Reversion] FOREIGN KEY ([IdMovimientoReversado]) REFERENCES [MovimientoCaja]([Id]),
    CONSTRAINT [CK_MovimientoCaja_Tipo] CHECK ([Tipo] IN ('INGRESO', 'EGRESO')),
    CONSTRAINT [CK_MovimientoCaja_MetodoPago] CHECK ([MetodoPago] IN ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'POS')),
    CONSTRAINT [CK_MovimientoCaja_Monto] CHECK ([Monto] > 0),
    CONSTRAINT [CK_MovimientoCaja_Origen] CHECK (
        ((CASE WHEN [IdPagoVenta] IS NULL THEN 0 ELSE 1 END)
        + (CASE WHEN [IdPagoPlanilla] IS NULL THEN 0 ELSE 1 END)
        + (CASE WHEN [IdAdelantoEmpleado] IS NULL THEN 0 ELSE 1 END)) <= 1
    )
);

CREATE UNIQUE INDEX [UQ_MovimientoCaja_PagoVenta]
ON [MovimientoCaja]([IdPagoVenta])
WHERE [IdPagoVenta] IS NOT NULL;

CREATE UNIQUE INDEX [UQ_MovimientoCaja_PagoPlanilla]
ON [MovimientoCaja]([IdPagoPlanilla])
WHERE [IdPagoPlanilla] IS NOT NULL;

CREATE UNIQUE INDEX [UQ_MovimientoCaja_Adelanto]
ON [MovimientoCaja]([IdAdelantoEmpleado])
WHERE [IdAdelantoEmpleado] IS NOT NULL;

CREATE UNIQUE INDEX [UQ_MovimientoCaja_Reversion]
ON [MovimientoCaja]([IdMovimientoReversado])
WHERE [IdMovimientoReversado] IS NOT NULL;

CREATE INDEX [IX_MovimientoCaja_Caja_Fecha]
ON [MovimientoCaja]([IdCajaSesion], [FechaMovimiento]);

CREATE INDEX [IX_MovimientoCaja_Caja_Medio_Tipo]
ON [MovimientoCaja]([IdCajaSesion], [MetodoPago], [Tipo]);
