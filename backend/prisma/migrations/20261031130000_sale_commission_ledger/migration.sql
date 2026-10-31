CREATE TABLE [ComisionDevengada] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdEmpleado] INT NOT NULL,
    [IdVenta] INT NOT NULL,
    [IdDetalleVenta] INT NOT NULL,
    [Mes] INT NOT NULL,
    [Anio] INT NOT NULL,
    [TipoMovimiento] VARCHAR(20) NOT NULL,
    [MontoMovimiento] DECIMAL(10,2) NOT NULL,
    [BaseCalculoSnapshot] DECIMAL(12,2) NOT NULL,
    [BaseCategoriaSnapshot] DECIMAL(12,2) NULL,
    [CantidadSnapshot] FLOAT NOT NULL,
    [NombreProductoSnapshot] VARCHAR(255) NOT NULL,
    [IdConfiguracionSnapshot] INT NULL,
    [IdReglaSnapshot] INT NULL,
    [IdCategoriaSnapshot] INT NULL,
    [IdReglaCategoriaSnapshot] INT NULL,
    [CategoriaSnapshot] VARCHAR(100) NULL,
    [TipoCalculoSnapshot] VARCHAR(30) NOT NULL,
    [ValorAplicadoSnapshot] DECIMAL(10,4) NOT NULL,
    [FechaVentaEfectiva] DATETIME2 NOT NULL,
    [ClaveOperacion] CHAR(64) NOT NULL,
    [FechaRegistro] DATETIME NOT NULL CONSTRAINT [DF_ComisionDevengada_FechaRegistro] DEFAULT GETDATE(),
    CONSTRAINT [PK_ComisionDevengada] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_ComisionDevengada_Empleado] FOREIGN KEY ([IdEmpleado]) REFERENCES [Empleado]([Id]),
    CONSTRAINT [FK_ComisionDevengada_Venta] FOREIGN KEY ([IdVenta]) REFERENCES [Venta]([Id]),
    CONSTRAINT [FK_ComisionDevengada_Detalle] FOREIGN KEY ([IdDetalleVenta]) REFERENCES [DetalleVenta]([Id]),
    CONSTRAINT [CK_ComisionDevengada_TipoMovimiento] CHECK ([TipoMovimiento] IN ('DEVENGO', 'AJUSTE'))
);

CREATE UNIQUE INDEX [UQ_ComisionDevengada_ClaveOperacion]
ON [ComisionDevengada]([ClaveOperacion]);

CREATE INDEX [IX_ComisionDevengada_Empleado_Periodo]
ON [ComisionDevengada]([IdEmpleado], [Anio], [Mes], [FechaVentaEfectiva]);

CREATE INDEX [IX_ComisionDevengada_Venta_Detalle]
ON [ComisionDevengada]([IdVenta], [IdDetalleVenta]);
