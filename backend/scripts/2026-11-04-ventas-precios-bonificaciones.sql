SET XACT_ABORT ON;
BEGIN TRAN;

IF OBJECT_ID('TipoCliente', 'U') IS NULL
BEGIN
  CREATE TABLE TipoCliente (
    Id INT IDENTITY(1,1) NOT NULL,
    IdUsuario INT NOT NULL,
    Nombre VARCHAR(100) NOT NULL,
    Descripcion VARCHAR(255) NULL,
    FechaRegistro DATETIME NULL CONSTRAINT DF_TipoCliente_FechaRegistro DEFAULT(GETDATE()),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL CONSTRAINT DF_TipoCliente_Anulado DEFAULT(0),
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL,
    CONSTRAINT PK_TipoCliente PRIMARY KEY (Id)
  );
END;

IF COL_LENGTH('Cliente', 'IdTipoCliente') IS NULL
BEGIN
  ALTER TABLE Cliente ADD IdTipoCliente INT NULL;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_Cliente_TipoCliente'
)
BEGIN
  ALTER TABLE Cliente
    ADD CONSTRAINT FK_Cliente_TipoCliente
      FOREIGN KEY (IdTipoCliente) REFERENCES TipoCliente(Id);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Cliente_TipoCliente_Activo'
    AND object_id = OBJECT_ID('Cliente')
)
BEGIN
  CREATE INDEX IX_Cliente_TipoCliente_Activo
    ON Cliente(IdTipoCliente, Anulado);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_TipoCliente_Usuario'
)
BEGIN
  ALTER TABLE TipoCliente
    ADD CONSTRAINT FK_TipoCliente_Usuario
      FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);
END;

IF OBJECT_ID('ReglaPrecioCliente', 'U') IS NULL
BEGIN
  CREATE TABLE ReglaPrecioCliente (
    Id INT IDENTITY(1,1) NOT NULL,
    IdTipoCliente INT NOT NULL,
    IdInventarioItem INT NOT NULL,
    IdUsuario INT NOT NULL,
    Precio DECIMAL(10,2) NOT NULL,
    FechaInicio DATE NULL,
    FechaFin DATE NULL,
    FechaRegistro DATETIME NULL CONSTRAINT DF_ReglaPrecioCliente_FechaRegistro DEFAULT(GETDATE()),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL CONSTRAINT DF_ReglaPrecioCliente_Anulado DEFAULT(0),
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL,
    CONSTRAINT PK_ReglaPrecioCliente PRIMARY KEY (Id),
    CONSTRAINT FK_ReglaPrecioCliente_TipoCliente FOREIGN KEY (IdTipoCliente) REFERENCES TipoCliente(Id),
    CONSTRAINT FK_ReglaPrecioCliente_InventarioItem FOREIGN KEY (IdInventarioItem) REFERENCES InventarioItem(Id),
    CONSTRAINT FK_ReglaPrecioCliente_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id)
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_ReglaPrecioCliente_Resolucion'
    AND object_id = OBJECT_ID('ReglaPrecioCliente')
)
BEGIN
  CREATE INDEX IX_ReglaPrecioCliente_Resolucion
    ON ReglaPrecioCliente(IdTipoCliente, IdInventarioItem, Anulado, FechaInicio, FechaFin);
END;

IF OBJECT_ID('ReglaBonificacion', 'U') IS NULL
BEGIN
  CREATE TABLE ReglaBonificacion (
    Id INT IDENTITY(1,1) NOT NULL,
    IdUsuario INT NOT NULL,
    Nombre VARCHAR(100) NULL,
    IdInventarioItemCompra INT NOT NULL,
    CantidadMinima FLOAT NOT NULL,
    CantidadMaxima FLOAT NULL,
    IdInventarioItemBonificado INT NOT NULL,
    CantidadBonificada FLOAT NOT NULL,
    Prioridad INT NOT NULL CONSTRAINT DF_ReglaBonificacion_Prioridad DEFAULT(1),
    FechaInicio DATE NULL,
    FechaFin DATE NULL,
    FechaRegistro DATETIME NULL CONSTRAINT DF_ReglaBonificacion_FechaRegistro DEFAULT(GETDATE()),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL CONSTRAINT DF_ReglaBonificacion_Anulado DEFAULT(0),
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL,
    CONSTRAINT PK_ReglaBonificacion PRIMARY KEY (Id),
    CONSTRAINT FK_ReglaBonificacion_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id),
    CONSTRAINT FK_ReglaBonificacion_InventarioItemCompra FOREIGN KEY (IdInventarioItemCompra) REFERENCES InventarioItem(Id),
    CONSTRAINT FK_ReglaBonificacion_InventarioItemBonificado FOREIGN KEY (IdInventarioItemBonificado) REFERENCES InventarioItem(Id)
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_ReglaBonificacion_Aplicacion'
    AND object_id = OBJECT_ID('ReglaBonificacion')
)
BEGIN
  CREATE INDEX IX_ReglaBonificacion_Aplicacion
    ON ReglaBonificacion(IdInventarioItemCompra, Anulado, Prioridad);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_TipoCliente_Nombre_Activo'
    AND object_id = OBJECT_ID('TipoCliente')
)
BEGIN
  CREATE INDEX IX_TipoCliente_Nombre_Activo
    ON TipoCliente(Nombre, Anulado);
END;

COMMIT TRAN;
