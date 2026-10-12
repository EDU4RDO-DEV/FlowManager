IF EXISTS (
    SELECT [NumeroVenta]
    FROM [dbo].[Venta]
    GROUP BY [NumeroVenta]
    HAVING COUNT_BIG(*) > 1
)
BEGIN
    ;THROW 51000, 'Cannot add UQ_Venta_NumeroVenta: duplicate sale numbers already exist.', 1;
END;

CREATE UNIQUE NONCLUSTERED INDEX [UQ_Venta_NumeroVenta]
ON [dbo].[Venta]([NumeroVenta]);
