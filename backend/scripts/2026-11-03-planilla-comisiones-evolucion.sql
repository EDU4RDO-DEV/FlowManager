SET XACT_ABORT ON;
BEGIN TRAN;

-- 1) Auditoria ampliada en ConfiguracionComision
IF COL_LENGTH('ConfiguracionComision', 'IdUsuarioModificador') IS NULL
  ALTER TABLE ConfiguracionComision ADD IdUsuarioModificador INT NULL;

IF COL_LENGTH('ConfiguracionComision', 'FechaModificacion') IS NULL
  ALTER TABLE ConfiguracionComision ADD FechaModificacion DATETIME NULL;

IF COL_LENGTH('ConfiguracionComision', 'IdUsuarioAnulador') IS NULL
  ALTER TABLE ConfiguracionComision ADD IdUsuarioAnulador INT NULL;

IF COL_LENGTH('ConfiguracionComision', 'FechaAnulacion') IS NULL
  ALTER TABLE ConfiguracionComision ADD FechaAnulacion DATETIME NULL;

-- 2) Relacion explicita Empleado -> Usuario vinculado para calculo de comision por ruta
IF COL_LENGTH('Empleado', 'IdUsuarioVinculado') IS NULL
  ALTER TABLE Empleado ADD IdUsuarioVinculado INT NULL;

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_Empleado_UsuarioVinculado'
)
BEGIN
  ALTER TABLE Empleado
    ADD CONSTRAINT FK_Empleado_UsuarioVinculado
      FOREIGN KEY (IdUsuarioVinculado) REFERENCES Usuario(Id);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_Empleado_UsuarioVinculado_Activo'
    AND object_id = OBJECT_ID('Empleado')
)
BEGIN
  CREATE INDEX IX_Empleado_UsuarioVinculado_Activo
    ON Empleado(IdUsuarioVinculado, Anulado);
END;

-- Backfill con usuario que comparte entidad activa
UPDATE e
SET e.IdUsuarioVinculado = u.Id
FROM Empleado e
INNER JOIN Usuario u ON u.IdEntidad = e.IdEntidad AND u.Anulado = 0
WHERE e.IdUsuarioVinculado IS NULL
  AND e.Anulado = 0;

-- 3) Evolucion ReglaComision para soportar porcentaje o monto por unidad
IF COL_LENGTH('ReglaComision', 'TipoCalculo') IS NULL
BEGIN
  ALTER TABLE ReglaComision ADD TipoCalculo VARCHAR(30) NOT NULL
    CONSTRAINT DF__ReglaComi__TipoC__6D0D32F4 DEFAULT('PORCENTAJE_VENTA');
END;

IF COL_LENGTH('ReglaComision', 'MontoPorUnidad') IS NULL
  ALTER TABLE ReglaComision ADD MontoPorUnidad DECIMAL(10,2) NULL;

IF COL_LENGTH('ReglaComision', 'FechaRegistro') IS NULL
BEGIN
  ALTER TABLE ReglaComision ADD FechaRegistro DATETIME NULL;
  UPDATE ReglaComision SET FechaRegistro = GETDATE() WHERE FechaRegistro IS NULL;
END;

IF COL_LENGTH('ReglaComision', 'IdUsuarioModificador') IS NULL
  ALTER TABLE ReglaComision ADD IdUsuarioModificador INT NULL;

IF COL_LENGTH('ReglaComision', 'FechaModificacion') IS NULL
  ALTER TABLE ReglaComision ADD FechaModificacion DATETIME NULL;

IF COL_LENGTH('ReglaComision', 'IdUsuarioAnulador') IS NULL
  ALTER TABLE ReglaComision ADD IdUsuarioAnulador INT NULL;

IF COL_LENGTH('ReglaComision', 'FechaAnulacion') IS NULL
  ALTER TABLE ReglaComision ADD FechaAnulacion DATETIME NULL;

IF OBJECT_ID('DF__ReglaComi__Porce__6E01572D', 'D') IS NULL
BEGIN
  ALTER TABLE ReglaComision ADD CONSTRAINT DF__ReglaComi__Porce__6E01572D DEFAULT(0) FOR Porcentaje;
END;

UPDATE ReglaComision
SET TipoCalculo = 'PORCENTAJE_VENTA'
WHERE TipoCalculo IS NULL;

-- 4) Evolucion PlanillaMensual para control de estado y bonos
IF COL_LENGTH('PlanillaMensual', 'Estado') IS NULL
BEGIN
  ALTER TABLE PlanillaMensual ADD Estado VARCHAR(20) NOT NULL
    CONSTRAINT DF__PlanillaM__Estado__72C60C4A DEFAULT('BORRADOR');
END;

IF COL_LENGTH('PlanillaMensual', 'IdUsuarioGenerador') IS NULL
  ALTER TABLE PlanillaMensual ADD IdUsuarioGenerador INT NULL;

IF COL_LENGTH('PlanillaMensual', 'TotalBonosMetas') IS NULL
BEGIN
  ALTER TABLE PlanillaMensual ADD TotalBonosMetas DECIMAL(10,2) NOT NULL
    CONSTRAINT DF__PlanillaM__Bonos__73BA3083 DEFAULT(0);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_PlanillaMensual_Periodo_Activo'
    AND object_id = OBJECT_ID('PlanillaMensual')
)
BEGIN
  CREATE INDEX IX_PlanillaMensual_Periodo_Activo
    ON PlanillaMensual(Mes, Anio, Anulado);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UQ_PlanillaMensual_EmpleadoPeriodoActivo'
    AND object_id = OBJECT_ID('PlanillaMensual')
)
BEGIN
  CREATE UNIQUE INDEX UQ_PlanillaMensual_EmpleadoPeriodoActivo
    ON PlanillaMensual(IdEmpleado, Mes, Anio)
    WHERE Anulado = 0;
END;

-- 5) Historico de comision por producto en cada planilla
IF OBJECT_ID('PlanillaDetalleComision', 'U') IS NULL
BEGIN
  CREATE TABLE PlanillaDetalleComision (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    IdPlanillaMensual INT NOT NULL,
    IdInventarioItem INT NOT NULL,
    Cantidad FLOAT NOT NULL,
    BaseCalculo DECIMAL(10,2) NOT NULL,
    TipoCalculo VARCHAR(30) NOT NULL,
    ValorAplicado DECIMAL(10,4) NOT NULL,
    MontoComision DECIMAL(10,2) NOT NULL,
    FechaRegistro DATETIME NULL CONSTRAINT DF__PlanillaD__Fecha__74AE54BC DEFAULT(GETDATE()),
    Anulado BIT NOT NULL CONSTRAINT DF__PlanillaD__Anula__75A278F5 DEFAULT(0),
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL,
    CONSTRAINT FK_PlanillaDetalleComision_PlanillaMensual
      FOREIGN KEY (IdPlanillaMensual) REFERENCES PlanillaMensual(Id),
    CONSTRAINT FK_PlanillaDetalleComision_InventarioItem
      FOREIGN KEY (IdInventarioItem) REFERENCES InventarioItem(Id)
  );

  CREATE INDEX IX_PlanillaDetalleComision_Planilla_Activo
    ON PlanillaDetalleComision(IdPlanillaMensual, Anulado);
END;

-- 6) Ajustes manuales (bono, viatico, descuento)
IF OBJECT_ID('PlanillaDetalleAjuste', 'U') IS NULL
BEGIN
  CREATE TABLE PlanillaDetalleAjuste (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    IdPlanillaMensual INT NOT NULL,
    TipoAjuste VARCHAR(30) NOT NULL,
    Descripcion VARCHAR(255) NOT NULL,
    Monto DECIMAL(10,2) NOT NULL,
    FechaRegistro DATETIME NULL CONSTRAINT DF__PlanillaA__Fecha__76969D2E DEFAULT(GETDATE()),
    Anulado BIT NOT NULL CONSTRAINT DF__PlanillaA__Anula__778AC167 DEFAULT(0),
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL,
    CONSTRAINT FK_PlanillaDetalleAjuste_PlanillaMensual
      FOREIGN KEY (IdPlanillaMensual) REFERENCES PlanillaMensual(Id)
  );

  CREATE INDEX IX_PlanillaDetalleAjuste_Planilla_Activo
    ON PlanillaDetalleAjuste(IdPlanillaMensual, Anulado);
END;

COMMIT TRAN;
