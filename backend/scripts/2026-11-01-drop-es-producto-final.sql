BEGIN TRY
  BEGIN TRANSACTION;

  IF COL_LENGTH('dbo.InventarioItem', 'EsProductoFinal') IS NOT NULL
  BEGIN
    DECLARE @constraintName sysname;

    SELECT @constraintName = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
      ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t
      ON t.object_id = c.object_id
    INNER JOIN sys.schemas s
      ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo'
      AND t.name = 'InventarioItem'
      AND c.name = 'EsProductoFinal';

    IF @constraintName IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE dbo.InventarioItem DROP CONSTRAINT [' + @constraintName + ']');
    END;

    ALTER TABLE dbo.InventarioItem DROP COLUMN EsProductoFinal;
  END;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRANSACTION;

  THROW;
END CATCH;
