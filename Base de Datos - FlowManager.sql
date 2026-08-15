-- ==============================================================================
-- SCRIPT COMPLETO DE BASE DE DATOS - SISTEMA ERP/VENTAS
-- ==============================================================================
-- Este script crea todas las tablas primero y luego establece las relaciones
-- (Llaves Foráneas) al final para evitar errores de dependencias circulares.
-- ==============================================================================

-- ==========================================
-- 1. CREACIÓN DE TABLAS
-- ==========================================

CREATE TABLE Rol (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    Nombre VARCHAR(50) NOT NULL,
    Descripcion VARCHAR(255) NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Usuario (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NULL,
    IdEntidad INT NOT NULL,
    IdRol INT NOT NULL,
    Nombre VARCHAR(255) NOT NULL,
    Correo VARCHAR(255) NOT NULL,
    Clave VARCHAR(MAX) NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Sesion (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    IP VARCHAR(100) NOT NULL,
    NombreDispositivo VARCHAR(255) NOT NULL,
    TokenSesion VARCHAR(MAX) NOT NULL,
    Latitud DECIMAL(18,6) NULL,
    Longitud DECIMAL(18,6) NULL,
    [Precision] DECIMAL(8,6) NULL,
    FechaExpiracionToken DATETIME NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Empresa (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    Nit VARCHAR(20) NOT NULL,
    Nombre VARCHAR(255) NOT NULL,
    NombreComercial VARCHAR(255) NOT NULL,
    Direccion VARCHAR(255) NOT NULL,
    Telefono1 VARCHAR(20) NULL,
    Telefono2 VARCHAR(20) NULL,
    CorreoElectronico VARCHAR(100) NULL,
    Frase VARCHAR(255) NOT NULL,
    RutaLogo VARCHAR(255) NULL,
    UsuarioFel VARCHAR(255) NULL,
    ContrasenaFel VARCHAR(255) NULL,
    ServidorFel VARCHAR(255) NULL,
    FechaInicioFel DATE NULL,
    FechaFinFel DATE NULL,
    RegimenIsr VARCHAR(255) NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Entidad (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    NombreCompleto VARCHAR(255) NOT NULL,
    Sexo CHAR(1) NULL,
    FechaNacimiento DATE NULL,
    Telefono1 VARCHAR(20) NULL,
    Telefono2 VARCHAR(20) NULL,
    CorreoElectronico VARCHAR(100) NULL,
    RutaImagen VARCHAR(255) NULL,
    Nit VARCHAR(25) NULL,
    Dpi VARCHAR(25) NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Cliente (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdEntidad INT NOT NULL,
    IdUsuario INT NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Empleado (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdEntidad INT NOT NULL,
    IdUsuario INT NOT NULL,
    IdConfiguracionComision INT NULL,
    PuestoTrabajo VARCHAR(255) NOT NULL,
    DescripcionPuesto VARCHAR(255) NULL,
    FechaContratacion DATE NOT NULL,
    FechaSalida DATE NULL,
    SueldoBase DECIMAL(10, 2) NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Proveedor (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdEntidad INT NOT NULL,
    IdUsuario INT NOT NULL,
    Nombre VARCHAR(255) NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE ConfiguracionComision (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    Nombre VARCHAR(100) NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Anulado BIT NOT NULL DEFAULT 0
);

CREATE TABLE ReglaComision (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdConfiguracionComision INT NOT NULL,
    IdInventarioItem INT NOT NULL,
    CantidadMinima FLOAT NOT NULL,
    CantidadMaxima FLOAT NULL,
    Porcentaje DECIMAL(5, 2) NOT NULL,
    Anulado BIT NOT NULL DEFAULT 0
);

CREATE TABLE PlanillaMensual (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdEmpleado INT NOT NULL,
    Mes INT NOT NULL,
    Anio INT NOT NULL,
    SueldoBase DECIMAL(10, 2) NOT NULL,
    TotalComisiones DECIMAL(10, 2) NOT NULL,
    TotalViaticos DECIMAL(10, 2) NOT NULL DEFAULT 0,
    TotalDescuentos DECIMAL(10, 2) NOT NULL DEFAULT 0,
    SueldoLiquido DECIMAL(10, 2) NOT NULL,
    Observaciones VARCHAR(255) NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Compra (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdProveedor INT NOT NULL,
    IdUsuario INT NOT NULL,
    NumeroCompra INT NOT NULL,
    NumeroFactura VARCHAR(50) NOT NULL,
    EsGasto BIT NOT NULL DEFAULT 0,
    Observaciones VARCHAR(255) NULL,
    FechaFactura DATE NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE DetalleGasto (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdCompra INT NOT NULL,
    Descripcion VARCHAR(255) NOT NULL,
    Cantidad DECIMAL(10, 2) NOT NULL,
    PrecioUnitario DECIMAL(10, 2) NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE DetalleCompra (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdCompra INT NOT NULL,
    IdInventarioItem INT NOT NULL,
    Cantidad FLOAT NOT NULL,
    CostoUnitario DECIMAL(8, 2) NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE InventarioItem (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    IdProveedor INT NOT NULL,
    Nombre VARCHAR(255) NOT NULL,
    Categoria VARCHAR(50) NOT NULL,
    Existencia FLOAT NOT NULL,
    CostoPromedio DECIMAL(10, 2) NOT NULL,
    PrecioVenta DECIMAL(10, 2) NOT NULL,
    RutaImagen VARCHAR(255) NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE EstructuraProducto (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdProductoTerminado INT NOT NULL,
    IdMateriaPrima INT NOT NULL,
    CantidadRequerida FLOAT NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Anulado BIT NOT NULL DEFAULT 0
);

CREATE TABLE BitacoraInventario (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdInventarioItem INT NOT NULL,
    IdUsuario INT NOT NULL,
    TipoDocumento VARCHAR(10) NULL,
    Documento VARCHAR(10) NULL,
    Nombre VARCHAR(255) NOT NULL,
    TipoMovimiento BIT NOT NULL,
    ExistenciaAnterior FLOAT NOT NULL,
    Cantidad FLOAT NOT NULL,
    NuevaExistencia FLOAT NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE AjusteInventario (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdInventarioItem INT NOT NULL,
    IdUsuario INT NOT NULL,
    TipoAjuste VARCHAR(50) NOT NULL,
    NumeroAjuste INT NOT NULL,
    CantidadAjustada FLOAT NOT NULL,
    Observacion VARCHAR(255) NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Talonario (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    Nombre VARCHAR(100) NOT NULL,
    CorrelativoInicial INT NOT NULL,
    CorrelativoFinal INT NOT NULL,
    UltimoUtilizado INT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Venta (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdCliente INT NOT NULL,
    IdUsuario INT NOT NULL,
    IdRutaSesion INT NULL,
    IdTalonario INT NULL,
    NumeroVenta INT NOT NULL,
    NumeroProForma INT NULL,
    TipoRegistro VARCHAR(20) NOT NULL,
    EstadoEntrega VARCHAR(20) NOT NULL,
    CondicionPago VARCHAR(20) NOT NULL,
    EstadoPago VARCHAR(20) NOT NULL,
    RequiereFactura BIT NOT NULL DEFAULT 0,
    AutorizacionFel VARCHAR(255) NULL,
    NumeroFel VARCHAR(255) NULL,
    SerieFel VARCHAR(255) NULL,
    QrFel VARCHAR(MAX) NULL,
    FechaEmisionFel DATETIME NULL,
    NitFacturado VARCHAR(255) NULL,
    NombreClienteFacturado VARCHAR(255) NULL,
    DireccionClienteFacturado VARCHAR(255) NULL,
    LugarEntrega VARCHAR(255) NULL,
    FechaEntregaEsperada DATE NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE DetalleVenta (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdVenta INT NOT NULL,
    IdInventarioItem INT NOT NULL,
    Nombre VARCHAR(255) NOT NULL,
    Cantidad FLOAT NOT NULL,
    PrecioUnitario DECIMAL(10, 2) NOT NULL,
    EsBonificacion BIT NOT NULL DEFAULT 0,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE PagoVenta (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdVenta INT NOT NULL,
    IdUsuario INT NOT NULL,
    Monto DECIMAL(10, 2) NOT NULL,
    MetodoPago VARCHAR(50) NOT NULL,
    NumeroReferencia VARCHAR(100) NULL,
    Banco VARCHAR(100) NULL,
    FechaPago DATETIME DEFAULT GETDATE(),
    RutaFirma VARCHAR(255) NULL,
    Observaciones VARCHAR(255) NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Vehiculo (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdUsuario INT NOT NULL,
    Placa VARCHAR(50) NOT NULL,
    Marca VARCHAR(50) NOT NULL,
    Modelo VARCHAR(50) NOT NULL,
    Color VARCHAR(50) NULL,
    Estado VARCHAR(50) NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE Ruta (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Descripcion VARCHAR(255) NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    Anulado BIT NOT NULL DEFAULT 0
);

CREATE TABLE RutaSesion (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdRuta INT NOT NULL,
    IdVehiculo INT NOT NULL,
    IdUsuarioChofer INT NOT NULL,
    IdUsuarioVendedor INT NOT NULL,
    FechaSesion DATE NOT NULL,
    KmInicial FLOAT NULL,
    KmFinal FLOAT NULL,
    Estado VARCHAR(20) NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

CREATE TABLE GastoVehiculo (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    IdRutaSesion INT NOT NULL,
    IdUsuario INT NOT NULL,
    IdProveedor INT NULL,
    Descripcion VARCHAR(255) NOT NULL,
    Monto DECIMAL(10, 2) NOT NULL,
    MetodoPago VARCHAR(50) NOT NULL,
    NumeroVale INT NULL,
    RutaImagen VARCHAR(255) NULL,
    EstadoPago VARCHAR(20) NOT NULL DEFAULT 'PAGADO',
    FechaPago DATETIME NULL,
    ReferenciaPago VARCHAR(100) NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IdUsuarioModificador INT NULL,
    FechaModificacion DATETIME NULL,
    Anulado BIT NOT NULL DEFAULT 0,
    IdUsuarioAnulador INT NULL,
    FechaAnulacion DATETIME NULL
);

-- ==========================================
-- 2. AGREGAR LLAVES FORÁNEAS (RELACIONES)
-- ==========================================

-- Rol
ALTER TABLE Rol ADD CONSTRAINT FK_Rol_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- Usuario
ALTER TABLE Usuario ADD CONSTRAINT FK_Usuario_Entidad FOREIGN KEY (IdEntidad) REFERENCES Entidad(Id);
ALTER TABLE Usuario ADD CONSTRAINT FK_Usuario_Rol FOREIGN KEY (IdRol) REFERENCES Rol(Id);
ALTER TABLE Usuario ADD CONSTRAINT FK_Usuario_UsuarioPadre FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- Sesion
ALTER TABLE Sesion ADD CONSTRAINT FK_Sesion_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- Empresa
ALTER TABLE Empresa ADD CONSTRAINT FK_Empresa_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- Entidad
ALTER TABLE Entidad ADD CONSTRAINT FK_Entidad_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- Cliente
ALTER TABLE Cliente ADD CONSTRAINT FK_Cliente_Entidad FOREIGN KEY (IdEntidad) REFERENCES Entidad(Id);
ALTER TABLE Cliente ADD CONSTRAINT FK_Cliente_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- Empleado
ALTER TABLE Empleado ADD CONSTRAINT FK_Empleado_Entidad FOREIGN KEY (IdEntidad) REFERENCES Entidad(Id);
ALTER TABLE Empleado ADD CONSTRAINT FK_Empleado_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);
ALTER TABLE Empleado ADD CONSTRAINT FK_Empleado_ConfiguracionComision FOREIGN KEY (IdConfiguracionComision) REFERENCES ConfiguracionComision(Id);

-- Proveedor
ALTER TABLE Proveedor ADD CONSTRAINT FK_Proveedor_Entidad FOREIGN KEY (IdEntidad) REFERENCES Entidad(Id);
ALTER TABLE Proveedor ADD CONSTRAINT FK_Proveedor_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- ConfiguracionComision
ALTER TABLE ConfiguracionComision ADD CONSTRAINT FK_ConfiguracionComision_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- ReglaComision
ALTER TABLE ReglaComision ADD CONSTRAINT FK_ReglaComision_ConfiguracionComision FOREIGN KEY (IdConfiguracionComision) REFERENCES ConfiguracionComision(Id);
ALTER TABLE ReglaComision ADD CONSTRAINT FK_ReglaComision_InventarioItem FOREIGN KEY (IdInventarioItem) REFERENCES InventarioItem(Id);

-- PlanillaMensual
ALTER TABLE PlanillaMensual ADD CONSTRAINT FK_PlanillaMensual_Empleado FOREIGN KEY (IdEmpleado) REFERENCES Empleado(Id);

-- Compra
ALTER TABLE Compra ADD CONSTRAINT FK_Compra_Proveedor FOREIGN KEY (IdProveedor) REFERENCES Proveedor(Id);
ALTER TABLE Compra ADD CONSTRAINT FK_Compra_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- DetalleGasto
ALTER TABLE DetalleGasto ADD CONSTRAINT FK_DetalleGasto_Compra FOREIGN KEY (IdCompra) REFERENCES Compra(Id);

-- DetalleCompra
ALTER TABLE DetalleCompra ADD CONSTRAINT FK_DetalleCompra_Compra FOREIGN KEY (IdCompra) REFERENCES Compra(Id);
ALTER TABLE DetalleCompra ADD CONSTRAINT FK_DetalleCompra_InventarioItem FOREIGN KEY (IdInventarioItem) REFERENCES InventarioItem(Id);

-- InventarioItem
ALTER TABLE InventarioItem ADD CONSTRAINT FK_InventarioItem_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);
ALTER TABLE InventarioItem ADD CONSTRAINT FK_InventarioItem_Proveedor FOREIGN KEY (IdProveedor) REFERENCES Proveedor(Id);

-- EstructuraProducto
ALTER TABLE EstructuraProducto ADD CONSTRAINT FK_EstructuraProducto_ProductoTerminado FOREIGN KEY (IdProductoTerminado) REFERENCES InventarioItem(Id);
ALTER TABLE EstructuraProducto ADD CONSTRAINT FK_EstructuraProducto_MateriaPrima FOREIGN KEY (IdMateriaPrima) REFERENCES InventarioItem(Id);

-- BitacoraInventario
ALTER TABLE BitacoraInventario ADD CONSTRAINT FK_BitacoraInventario_InventarioItem FOREIGN KEY (IdInventarioItem) REFERENCES InventarioItem(Id);
ALTER TABLE BitacoraInventario ADD CONSTRAINT FK_BitacoraInventario_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- AjusteInventario
ALTER TABLE AjusteInventario ADD CONSTRAINT FK_AjusteInventario_InventarioItem FOREIGN KEY (IdInventarioItem) REFERENCES InventarioItem(Id);
ALTER TABLE AjusteInventario ADD CONSTRAINT FK_AjusteInventario_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- Talonario
ALTER TABLE Talonario ADD CONSTRAINT FK_Talonario_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- Venta
ALTER TABLE Venta ADD CONSTRAINT FK_Venta_Cliente FOREIGN KEY (IdCliente) REFERENCES Cliente(Id);
ALTER TABLE Venta ADD CONSTRAINT FK_Venta_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);
ALTER TABLE Venta ADD CONSTRAINT FK_Venta_RutaSesion FOREIGN KEY (IdRutaSesion) REFERENCES RutaSesion(Id);
ALTER TABLE Venta ADD CONSTRAINT FK_Venta_Talonario FOREIGN KEY (IdTalonario) REFERENCES Talonario(Id);

-- DetalleVenta
ALTER TABLE DetalleVenta ADD CONSTRAINT FK_DetalleVenta_Venta FOREIGN KEY (IdVenta) REFERENCES Venta(Id);
ALTER TABLE DetalleVenta ADD CONSTRAINT FK_DetalleVenta_InventarioItem FOREIGN KEY (IdInventarioItem) REFERENCES InventarioItem(Id);

-- PagoVenta
ALTER TABLE PagoVenta ADD CONSTRAINT FK_PagoVenta_Venta FOREIGN KEY (IdVenta) REFERENCES Venta(Id);
ALTER TABLE PagoVenta ADD CONSTRAINT FK_PagoVenta_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- Vehiculo
ALTER TABLE Vehiculo ADD CONSTRAINT FK_Vehiculo_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);

-- RutaSesion
ALTER TABLE RutaSesion ADD CONSTRAINT FK_RutaSesion_Ruta FOREIGN KEY (IdRuta) REFERENCES Ruta(Id);
ALTER TABLE RutaSesion ADD CONSTRAINT FK_RutaSesion_Vehiculo FOREIGN KEY (IdVehiculo) REFERENCES Vehiculo(Id);
ALTER TABLE RutaSesion ADD CONSTRAINT FK_RutaSesion_Chofer FOREIGN KEY (IdUsuarioChofer) REFERENCES Usuario(Id);
ALTER TABLE RutaSesion ADD CONSTRAINT FK_RutaSesion_Vendedor FOREIGN KEY (IdUsuarioVendedor) REFERENCES Usuario(Id);

-- GastoVehiculo
ALTER TABLE GastoVehiculo ADD CONSTRAINT FK_GastoVehiculo_RutaSesion FOREIGN KEY (IdRutaSesion) REFERENCES RutaSesion(Id);
ALTER TABLE GastoVehiculo ADD CONSTRAINT FK_GastoVehiculo_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(Id);
ALTER TABLE GastoVehiculo ADD CONSTRAINT FK_GastoVehiculo_Proveedor FOREIGN KEY (IdProveedor) REFERENCES Proveedor(Id);

PRINT '¡Base de datos y relaciones creadas con éxito!';
