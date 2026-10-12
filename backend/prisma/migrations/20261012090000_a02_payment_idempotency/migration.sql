CREATE TABLE [dbo].[SolicitudPagoIdempotente] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdUsuario] INT NOT NULL,
    [IdVenta] INT NOT NULL,
    [IdPago] INT NOT NULL,
    [ClaveHash] CHAR(64) NOT NULL,
    [HuellaSolicitud] CHAR(64) NOT NULL,
    [EstadoPago] VARCHAR(20) NOT NULL,
    [Saldo] DECIMAL(10,2) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF_SolicitudPagoIdempotente_FechaRegistro] DEFAULT GETDATE(),
    CONSTRAINT [PK_SolicitudPagoIdempotente] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_SolicitudPagoIdempotente_Usuario]
        FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_SolicitudPagoIdempotente_Venta]
        FOREIGN KEY ([IdVenta]) REFERENCES [dbo].[Venta]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_SolicitudPagoIdempotente_PagoVenta]
        FOREIGN KEY ([IdPago]) REFERENCES [dbo].[PagoVenta]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_SolicitudPagoIdempotente_Usuario_Clave]
ON [dbo].[SolicitudPagoIdempotente]([IdUsuario], [ClaveHash]);

CREATE UNIQUE NONCLUSTERED INDEX [UQ_SolicitudPagoIdempotente_Pago]
ON [dbo].[SolicitudPagoIdempotente]([IdPago]);

CREATE NONCLUSTERED INDEX [IX_SolicitudPagoIdempotente_Venta]
ON [dbo].[SolicitudPagoIdempotente]([IdVenta]);
