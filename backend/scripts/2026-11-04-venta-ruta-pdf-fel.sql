-- Agrega la ruta local del PDF certificado devuelto por Ecofactura al emitir/anular FEL
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Venta') AND name = 'RutaPdfFel'
)
BEGIN
    ALTER TABLE dbo.Venta ADD RutaPdfFel VARCHAR(255) NULL;
END
