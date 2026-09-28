BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[AjusteInventario] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdInventarioItem] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [TipoAjuste] VARCHAR(50) NOT NULL,
    [NumeroAjuste] INT NOT NULL,
    [CantidadAjustada] FLOAT(53) NOT NULL,
    [NombreAjuste] VARCHAR(100),
    [Observacion] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF__AjusteInv__Fecha__0D7A0286] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__AjusteInv__Anula__0E6E26BF] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__AjusteIn__3214EC073DEAE24F] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[BitacoraInventario] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdInventarioItem] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [TipoDocumento] VARCHAR(10),
    [Documento] VARCHAR(10),
    [Nombre] VARCHAR(255) NOT NULL,
    [TipoMovimiento] BIT NOT NULL,
    [ExistenciaAnterior] FLOAT(53) NOT NULL,
    [Cantidad] FLOAT(53) NOT NULL,
    [NuevaExistencia] FLOAT(53) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__BitacoraI__Fecha__09A971A2] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__BitacoraI__Anula__0A9D95DB] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Bitacora__3214EC07A97D3D9D] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Cliente] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdEntidad] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [IdTipoCliente] INT,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Cliente__FechaRe__5CD6CB2B] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Cliente__Anulado__5DCAEF64] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Cliente__3214EC0739E9B73D] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[TipoCliente] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [Nombre] VARCHAR(100) NOT NULL,
    [Descripcion] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF_TipoCliente_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_TipoCliente_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_TipoCliente] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Compra] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdProveedor] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [NumeroCompra] INT NOT NULL,
    [NumeroFactura] VARCHAR(50) NOT NULL,
    [EsGasto] BIT NOT NULL CONSTRAINT [DF__Compra__EsGasto__74AE54BC] DEFAULT 0,
    [Observaciones] VARCHAR(255),
    [FechaFactura] DATE NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Compra__FechaReg__75A278F5] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Compra__Anulado__76969D2E] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Compra__3214EC079C171486] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[ConfiguracionComision] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [Nombre] VARCHAR(100) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Configura__Fecha__68487DD7] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Configura__Anula__693CA210] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Configur__3214EC07C239FD38] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[DetalleCompra] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdCompra] INT NOT NULL,
    [IdInventarioItem] INT NOT NULL,
    [Cantidad] FLOAT(53) NOT NULL,
    [CostoUnitario] DECIMAL(8,2) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__DetalleCo__Fecha__7D439ABD] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__DetalleCo__Anula__7E37BEF6] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__DetalleC__3214EC07C9D68A20] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[DetalleGasto] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdCompra] INT NOT NULL,
    [Descripcion] VARCHAR(255) NOT NULL,
    [Cantidad] DECIMAL(10,2) NOT NULL,
    [PrecioUnitario] DECIMAL(10,2) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__DetalleGa__Fecha__797309D9] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__DetalleGa__Anula__7A672E12] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__DetalleG__3214EC07C6F65A29] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[DetalleVenta] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdVenta] INT NOT NULL,
    [IdInventarioItem] INT NOT NULL,
    [Nombre] VARCHAR(255) NOT NULL,
    [Cantidad] FLOAT(53) NOT NULL,
    [PrecioUnitario] DECIMAL(10,2) NOT NULL,
    [EsBonificacion] BIT NOT NULL CONSTRAINT [DF__DetalleVe__EsBon__19DFD96B] DEFAULT 0,
    [FechaRegistro] DATETIME CONSTRAINT [DF__DetalleVe__Fecha__1AD3FDA4] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__DetalleVe__Anula__1BC821DD] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__DetalleV__3214EC074961FD0D] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Empleado] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdEntidad] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [IdUsuarioVinculado] INT,
    [IdConfiguracionComision] INT,
    [PuestoTrabajo] VARCHAR(255) NOT NULL,
    [DescripcionPuesto] VARCHAR(255),
    [FechaContratacion] DATE NOT NULL,
    [FechaSalida] DATE,
    [SueldoBase] DECIMAL(10,2) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Empleado__FechaR__60A75C0F] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Empleado__Anulad__619B8048] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Empleado__3214EC0707FA1428] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Empresa] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [Nit] VARCHAR(20) NOT NULL,
    [Nombre] VARCHAR(255) NOT NULL,
    [NombreComercial] VARCHAR(255) NOT NULL,
    [Direccion] VARCHAR(255) NOT NULL,
    [Telefono1] VARCHAR(20),
    [Telefono2] VARCHAR(20),
    [CorreoElectronico] VARCHAR(100),
    [Frase] VARCHAR(255) NOT NULL,
    [RutaLogo] VARCHAR(255),
    [UsuarioFel] VARCHAR(255),
    [ContrasenaFel] VARCHAR(255),
    [ServidorFel] VARCHAR(255),
    [FechaInicioFel] DATE,
    [FechaFinFel] DATE,
    [RegimenIsr] VARCHAR(255) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Empresa__FechaRe__5535A963] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Empresa__Anulado__5629CD9C] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Empresa__3214EC0725618E3A] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Entidad] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [NombreCompleto] VARCHAR(255) NOT NULL,
    [Sexo] CHAR(1),
    [FechaNacimiento] DATE,
    [Telefono1] VARCHAR(20),
    [Telefono2] VARCHAR(20),
    [CorreoElectronico] VARCHAR(100),
    [RutaImagen] VARCHAR(255),
    [Nit] VARCHAR(25),
    [Dpi] VARCHAR(25),
    [FechaRegistro] DATETIME CONSTRAINT [DF__Entidad__FechaRe__59063A47] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Entidad__Anulado__59FA5E80] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Entidad__3214EC07F3769907] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[EstructuraProducto] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdProductoTerminado] INT NOT NULL,
    [IdMateriaPrima] INT NOT NULL,
    [CantidadRequerida] FLOAT(53) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Estructur__Fecha__05D8E0BE] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Estructur__Anula__06CD04F7] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Estructu__3214EC076C0D1A73] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[ModuloSistema] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [Clave] VARCHAR(50) NOT NULL,
    [Nombre] VARCHAR(100) NOT NULL,
    [Descripcion] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF__ModuloSis__Fecha__7A2BFE54] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__ModuloSis__Anula__7B20228D] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__ModuloSi__3214EC0731B7C0E1] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[AccionSistema] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [Clave] VARCHAR(50) NOT NULL,
    [Nombre] VARCHAR(100) NOT NULL,
    [Descripcion] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF__AccionSis__Fecha__7FDC2A5B] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__AccionSis__Anula__00D04E94] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__AccionSi__3214EC07596498AA] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[RolPermiso] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdRol] INT NOT NULL,
    [IdModuloSistema] INT NOT NULL,
    [IdAccionSistema] INT NOT NULL,
    [Permitido] BIT NOT NULL CONSTRAINT [DF__RolPermis__Permi__04E4BC85] DEFAULT 1,
    [IdUsuario] INT NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__RolPermis__Fecha__05D8E0BE] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__RolPermis__Anula__06CD04F7] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__RolPermi__3214EC0738183B77] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[GastoVehiculo] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdRutaSesion] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [IdProveedor] INT,
    [Descripcion] VARCHAR(255) NOT NULL,
    [Monto] DECIMAL(10,2) NOT NULL,
    [MetodoPago] VARCHAR(50) NOT NULL,
    [NumeroVale] INT,
    [RutaImagen] VARCHAR(255),
    [EstadoPago] VARCHAR(20) NOT NULL CONSTRAINT [DF__GastoVehi__Estad__2DE6D218] DEFAULT 'PAGADO',
    [FechaPago] DATETIME,
    [ReferenciaPago] VARCHAR(100),
    [FechaRegistro] DATETIME CONSTRAINT [DF__GastoVehi__Fecha__2EDAF651] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__GastoVehi__Anula__2FCF1A8A] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__GastoVeh__3214EC07A03843BC] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[InventarioItem] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [IdProveedor] INT NOT NULL,
    [Nombre] VARCHAR(255) NOT NULL,
    [Categoria] VARCHAR(50) NOT NULL,
    [Existencia] FLOAT(53) NOT NULL,
    [CostoPromedio] DECIMAL(10,2) NOT NULL,
    [PrecioVenta] DECIMAL(10,2) NOT NULL,
    [RutaImagen] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF__Inventari__Fecha__02084FDA] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Inventari__Anula__02FC7413] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Inventar__3214EC07ABC0F2D5] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[PagoVenta] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdVenta] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [Monto] DECIMAL(10,2) NOT NULL,
    [MetodoPago] VARCHAR(50) NOT NULL,
    [NumeroReferencia] VARCHAR(100),
    [Banco] VARCHAR(100),
    [FechaPago] DATETIME CONSTRAINT [DF__PagoVenta__Fecha__1EA48E88] DEFAULT CURRENT_TIMESTAMP,
    [RutaFirma] VARCHAR(255),
    [Observaciones] VARCHAR(255),
    [Anulado] BIT NOT NULL CONSTRAINT [DF__PagoVenta__Anula__1F98B2C1] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__PagoVent__3214EC074F59C79C] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[PlanillaMensual] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdEmpleado] INT NOT NULL,
    [Mes] INT NOT NULL,
    [Anio] INT NOT NULL,
    [Estado] VARCHAR(20) NOT NULL CONSTRAINT [DF__PlanillaM__Estado__72C60C4A] DEFAULT 'BORRADOR',
    [IdUsuarioGenerador] INT,
    [SueldoBase] DECIMAL(10,2) NOT NULL,
    [TotalComisiones] DECIMAL(10,2) NOT NULL,
    [TotalBonosMetas] DECIMAL(10,2) NOT NULL CONSTRAINT [DF__PlanillaM__Bonos__73BA3083] DEFAULT 0,
    [TotalViaticos] DECIMAL(10,2) NOT NULL CONSTRAINT [DF__PlanillaM__Total__6EF57B66] DEFAULT 0,
    [TotalDescuentos] DECIMAL(10,2) NOT NULL CONSTRAINT [DF__PlanillaM__Total__6FE99F9F] DEFAULT 0,
    [SueldoLiquido] DECIMAL(10,2) NOT NULL,
    [Observaciones] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF__PlanillaM__Fecha__70DDC3D8] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__PlanillaM__Anula__71D1E811] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Planilla__3214EC073F7CA9B8] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_PlanillaMensual_EmpleadoPeriodoEstado] UNIQUE NONCLUSTERED ([IdEmpleado],[Mes],[Anio],[Anulado])
);

-- CreateTable
CREATE TABLE [dbo].[PlanillaDetalleComision] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdPlanillaMensual] INT NOT NULL,
    [IdInventarioItem] INT NOT NULL,
    [Cantidad] FLOAT(53) NOT NULL,
    [BaseCalculo] DECIMAL(10,2) NOT NULL,
    [TipoCalculo] VARCHAR(30) NOT NULL,
    [ValorAplicado] DECIMAL(10,4) NOT NULL,
    [MontoComision] DECIMAL(10,2) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__PlanillaD__Fecha__74AE54BC] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__PlanillaD__Anula__75A278F5] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Planilla__3214EC07DCOM001] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[PlanillaDetalleAjuste] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdPlanillaMensual] INT NOT NULL,
    [TipoAjuste] VARCHAR(30) NOT NULL,
    [Descripcion] VARCHAR(255) NOT NULL,
    [Monto] DECIMAL(10,2) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__PlanillaA__Fecha__76969D2E] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__PlanillaA__Anula__778AC167] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Planilla__3214EC07DADJ001] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Proveedor] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdEntidad] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Proveedor__Fecha__6477ECF3] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Proveedor__Anula__656C112C] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Proveedo__3214EC079578DEBB] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[ReglaComision] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdConfiguracionComision] INT NOT NULL,
    [IdInventarioItem] INT NOT NULL,
    [CantidadMinima] FLOAT(53) NOT NULL,
    [CantidadMaxima] FLOAT(53),
    [TipoCalculo] VARCHAR(30) NOT NULL CONSTRAINT [DF__ReglaComi__TipoC__6D0D32F4] DEFAULT 'PORCENTAJE_VENTA',
    [Porcentaje] DECIMAL(5,2) NOT NULL CONSTRAINT [DF__ReglaComi__Porce__6E01572D] DEFAULT 0,
    [MontoPorUnidad] DECIMAL(10,2),
    [FechaRegistro] DATETIME CONSTRAINT [DF__ReglaComi__Fecha__6EF57B66] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__ReglaComi__Anula__6C190EBB] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__ReglaCom__3214EC079009C25E] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[ReglaPrecioCliente] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdTipoCliente] INT NOT NULL,
    [IdInventarioItem] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [Precio] DECIMAL(10,2) NOT NULL,
    [FechaInicio] DATE,
    [FechaFin] DATE,
    [FechaRegistro] DATETIME CONSTRAINT [DF_ReglaPrecioCliente_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_ReglaPrecioCliente_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_ReglaPrecioCliente] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[ReglaBonificacion] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [Nombre] VARCHAR(100),
    [IdInventarioItemCompra] INT NOT NULL,
    [CantidadMinima] FLOAT(53) NOT NULL,
    [CantidadMaxima] FLOAT(53),
    [IdInventarioItemBonificado] INT NOT NULL,
    [CantidadBonificada] FLOAT(53) NOT NULL,
    [Prioridad] INT NOT NULL CONSTRAINT [DF_ReglaBonificacion_Prioridad] DEFAULT 1,
    [FechaInicio] DATE,
    [FechaFin] DATE,
    [FechaRegistro] DATETIME CONSTRAINT [DF_ReglaBonificacion_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_ReglaBonificacion_Anulado] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK_ReglaBonificacion] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Rol] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [Nombre] VARCHAR(50) NOT NULL,
    [Descripcion] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF__Rol__FechaRegist__49C3F6B7] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Rol__Anulado__4AB81AF0] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Rol__3214EC07D631775C] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Ruta] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [Nombre] VARCHAR(100) NOT NULL,
    [Descripcion] VARCHAR(255),
    [FechaRegistro] DATETIME CONSTRAINT [DF__Ruta__FechaRegis__2645B050] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Ruta__Anulado__2739D489] DEFAULT 0,
    CONSTRAINT [PK__Ruta__3214EC072A309141] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[RutaSesion] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdRuta] INT NOT NULL,
    [IdVehiculo] INT NOT NULL,
    [IdUsuarioChofer] INT NOT NULL,
    [IdUsuarioVendedor] INT NOT NULL,
    [FechaSesion] DATE NOT NULL,
    [KmInicial] FLOAT(53),
    [KmFinal] FLOAT(53),
    [Estado] VARCHAR(20) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__RutaSesio__Fecha__2A164134] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__RutaSesio__Anula__2B0A656D] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__RutaSesi__3214EC0785FB5BC3] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Sesion] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [IP] VARCHAR(100) NOT NULL,
    [NombreDispositivo] VARCHAR(255) NOT NULL,
    [TokenSesion] VARCHAR(64) NOT NULL,
    [Latitud] DECIMAL(18,6),
    [Longitud] DECIMAL(18,6),
    [Precision] DECIMAL(8,6),
    [FechaExpiracionToken] DATETIME NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Sesion__FechaReg__5165187F] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Sesion__Anulado__52593CB8] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Sesion__3214EC076E363928] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Talonario] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [Nombre] VARCHAR(100) NOT NULL,
    [CorrelativoInicial] INT NOT NULL,
    [CorrelativoFinal] INT NOT NULL,
    [UltimoUtilizado] INT,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Talonario__Fecha__114A936A] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Talonario__Anula__123EB7A3] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Talonari__3214EC07469884E8] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Usuario] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT,
    [IdEntidad] INT,
    [IdRol] INT,
    [Nombre] VARCHAR(255) NOT NULL,
    [Correo] VARCHAR(255) NOT NULL,
    [Clave] VARCHAR(max) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Usuario__FechaRe__4D94879B] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Usuario__Anulado__4E88ABD4] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Usuario__3214EC075D50852E] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Vehiculo] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdUsuario] INT NOT NULL,
    [Placa] VARCHAR(50) NOT NULL,
    [Marca] VARCHAR(50) NOT NULL,
    [Modelo] VARCHAR(50) NOT NULL,
    [Color] VARCHAR(50),
    [Estado] VARCHAR(50) NOT NULL,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Vehiculo__FechaR__22751F6C] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Vehiculo__Anulad__236943A5] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Vehiculo__3214EC076253A2C5] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[Venta] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdCliente] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [IdRutaSesion] INT,
    [IdTalonario] INT,
    [NumeroVenta] INT NOT NULL,
    [NumeroProForma] INT,
    [TipoRegistro] VARCHAR(20) NOT NULL,
    [EstadoEntrega] VARCHAR(20) NOT NULL,
    [CondicionPago] VARCHAR(20) NOT NULL,
    [EstadoPago] VARCHAR(20) NOT NULL,
    [RequiereFactura] BIT NOT NULL CONSTRAINT [DF__Venta__RequiereF__151B244E] DEFAULT 0,
    [AutorizacionFel] VARCHAR(255),
    [NumeroFel] VARCHAR(255),
    [SerieFel] VARCHAR(255),
    [QrFel] VARCHAR(max),
    [RutaPdfFel] VARCHAR(255),
    [FechaEmisionFel] DATETIME,
    [NitFacturado] VARCHAR(255),
    [NombreClienteFacturado] VARCHAR(255),
    [DireccionClienteFacturado] VARCHAR(255),
    [LugarEntrega] VARCHAR(255),
    [FechaEntregaEsperada] DATE,
    [FechaRegistro] DATETIME CONSTRAINT [DF__Venta__FechaRegi__160F4887] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioModificador] INT,
    [FechaModificacion] DATETIME,
    [Anulado] BIT NOT NULL CONSTRAINT [DF__Venta__Anulado__17036CC0] DEFAULT 0,
    [IdUsuarioAnulador] INT,
    [FechaAnulacion] DATETIME,
    CONSTRAINT [PK__Venta__3214EC07613C492B] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Cliente_TipoCliente_Activo] ON [dbo].[Cliente]([IdTipoCliente], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_TipoCliente_Nombre_Activo] ON [dbo].[TipoCliente]([Nombre], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Empleado_UsuarioVinculado_Activo] ON [dbo].[Empleado]([IdUsuarioVinculado], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ModuloSistema_Clave_Activo] ON [dbo].[ModuloSistema]([Clave], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_AccionSistema_Clave_Activo] ON [dbo].[AccionSistema]([Clave], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RolPermiso_RolModuloAccion_Activo] ON [dbo].[RolPermiso]([IdRol], [IdModuloSistema], [IdAccionSistema], [Anulado], [Permitido]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_PlanillaMensual_Periodo_Activo] ON [dbo].[PlanillaMensual]([Mes], [Anio], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_PlanillaDetalleComision_Planilla_Activo] ON [dbo].[PlanillaDetalleComision]([IdPlanillaMensual], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_PlanillaDetalleAjuste_Planilla_Activo] ON [dbo].[PlanillaDetalleAjuste]([IdPlanillaMensual], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ReglaPrecioCliente_Resolucion] ON [dbo].[ReglaPrecioCliente]([IdTipoCliente], [IdInventarioItem], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_ReglaBonificacion_Aplicacion] ON [dbo].[ReglaBonificacion]([IdInventarioItemCompra], [Anulado], [Prioridad]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Rol_Anulado_Nombre] ON [dbo].[Rol]([Anulado], [Nombre]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Sesion_Usuario_Activo_Expira] ON [dbo].[Sesion]([IdUsuario], [Anulado], [FechaExpiracionToken]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Sesion_Token_Activo] ON [dbo].[Sesion]([TokenSesion], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Usuario_Correo_Activo] ON [dbo].[Usuario]([Correo], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Usuario_Rol_Activo] ON [dbo].[Usuario]([IdRol], [Anulado]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Usuario_Entidad_Activo] ON [dbo].[Usuario]([IdEntidad], [Anulado]);

-- AddForeignKey
ALTER TABLE [dbo].[AjusteInventario] ADD CONSTRAINT [FK_AjusteInventario_InventarioItem] FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AjusteInventario] ADD CONSTRAINT [FK_AjusteInventario_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BitacoraInventario] ADD CONSTRAINT [FK_BitacoraInventario_InventarioItem] FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BitacoraInventario] ADD CONSTRAINT [FK_BitacoraInventario_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Cliente] ADD CONSTRAINT [FK_Cliente_Entidad] FOREIGN KEY ([IdEntidad]) REFERENCES [dbo].[Entidad]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Cliente] ADD CONSTRAINT [FK_Cliente_TipoCliente] FOREIGN KEY ([IdTipoCliente]) REFERENCES [dbo].[TipoCliente]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Cliente] ADD CONSTRAINT [FK_Cliente_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TipoCliente] ADD CONSTRAINT [FK_TipoCliente_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Compra] ADD CONSTRAINT [FK_Compra_Proveedor] FOREIGN KEY ([IdProveedor]) REFERENCES [dbo].[Proveedor]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Compra] ADD CONSTRAINT [FK_Compra_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ConfiguracionComision] ADD CONSTRAINT [FK_ConfiguracionComision_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DetalleCompra] ADD CONSTRAINT [FK_DetalleCompra_Compra] FOREIGN KEY ([IdCompra]) REFERENCES [dbo].[Compra]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DetalleCompra] ADD CONSTRAINT [FK_DetalleCompra_InventarioItem] FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DetalleGasto] ADD CONSTRAINT [FK_DetalleGasto_Compra] FOREIGN KEY ([IdCompra]) REFERENCES [dbo].[Compra]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DetalleVenta] ADD CONSTRAINT [FK_DetalleVenta_InventarioItem] FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DetalleVenta] ADD CONSTRAINT [FK_DetalleVenta_Venta] FOREIGN KEY ([IdVenta]) REFERENCES [dbo].[Venta]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Empleado] ADD CONSTRAINT [FK_Empleado_ConfiguracionComision] FOREIGN KEY ([IdConfiguracionComision]) REFERENCES [dbo].[ConfiguracionComision]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Empleado] ADD CONSTRAINT [FK_Empleado_Entidad] FOREIGN KEY ([IdEntidad]) REFERENCES [dbo].[Entidad]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Empleado] ADD CONSTRAINT [FK_Empleado_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Empleado] ADD CONSTRAINT [FK_Empleado_UsuarioVinculado] FOREIGN KEY ([IdUsuarioVinculado]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Empresa] ADD CONSTRAINT [FK_Empresa_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Entidad] ADD CONSTRAINT [FK_Entidad_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EstructuraProducto] ADD CONSTRAINT [FK_EstructuraProducto_MateriaPrima] FOREIGN KEY ([IdMateriaPrima]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EstructuraProducto] ADD CONSTRAINT [FK_EstructuraProducto_ProductoTerminado] FOREIGN KEY ([IdProductoTerminado]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolPermiso] ADD CONSTRAINT [FK_RolPermiso_AccionSistema] FOREIGN KEY ([IdAccionSistema]) REFERENCES [dbo].[AccionSistema]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolPermiso] ADD CONSTRAINT [FK_RolPermiso_ModuloSistema] FOREIGN KEY ([IdModuloSistema]) REFERENCES [dbo].[ModuloSistema]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolPermiso] ADD CONSTRAINT [FK_RolPermiso_Rol] FOREIGN KEY ([IdRol]) REFERENCES [dbo].[Rol]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolPermiso] ADD CONSTRAINT [FK_RolPermiso_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GastoVehiculo] ADD CONSTRAINT [FK_GastoVehiculo_Proveedor] FOREIGN KEY ([IdProveedor]) REFERENCES [dbo].[Proveedor]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GastoVehiculo] ADD CONSTRAINT [FK_GastoVehiculo_RutaSesion] FOREIGN KEY ([IdRutaSesion]) REFERENCES [dbo].[RutaSesion]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[GastoVehiculo] ADD CONSTRAINT [FK_GastoVehiculo_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventarioItem] ADD CONSTRAINT [FK_InventarioItem_Proveedor] FOREIGN KEY ([IdProveedor]) REFERENCES [dbo].[Proveedor]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InventarioItem] ADD CONSTRAINT [FK_InventarioItem_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PagoVenta] ADD CONSTRAINT [FK_PagoVenta_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PagoVenta] ADD CONSTRAINT [FK_PagoVenta_Venta] FOREIGN KEY ([IdVenta]) REFERENCES [dbo].[Venta]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PlanillaMensual] ADD CONSTRAINT [FK_PlanillaMensual_Empleado] FOREIGN KEY ([IdEmpleado]) REFERENCES [dbo].[Empleado]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PlanillaDetalleComision] ADD CONSTRAINT [FK_PlanillaDetalleComision_InventarioItem] FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PlanillaDetalleComision] ADD CONSTRAINT [FK_PlanillaDetalleComision_PlanillaMensual] FOREIGN KEY ([IdPlanillaMensual]) REFERENCES [dbo].[PlanillaMensual]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[PlanillaDetalleAjuste] ADD CONSTRAINT [FK_PlanillaDetalleAjuste_PlanillaMensual] FOREIGN KEY ([IdPlanillaMensual]) REFERENCES [dbo].[PlanillaMensual]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Proveedor] ADD CONSTRAINT [FK_Proveedor_Entidad] FOREIGN KEY ([IdEntidad]) REFERENCES [dbo].[Entidad]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Proveedor] ADD CONSTRAINT [FK_Proveedor_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReglaComision] ADD CONSTRAINT [FK_ReglaComision_ConfiguracionComision] FOREIGN KEY ([IdConfiguracionComision]) REFERENCES [dbo].[ConfiguracionComision]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReglaComision] ADD CONSTRAINT [FK_ReglaComision_InventarioItem] FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReglaPrecioCliente] ADD CONSTRAINT [FK_ReglaPrecioCliente_InventarioItem] FOREIGN KEY ([IdInventarioItem]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReglaPrecioCliente] ADD CONSTRAINT [FK_ReglaPrecioCliente_TipoCliente] FOREIGN KEY ([IdTipoCliente]) REFERENCES [dbo].[TipoCliente]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReglaPrecioCliente] ADD CONSTRAINT [FK_ReglaPrecioCliente_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReglaBonificacion] ADD CONSTRAINT [FK_ReglaBonificacion_InventarioItemBonificado] FOREIGN KEY ([IdInventarioItemBonificado]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReglaBonificacion] ADD CONSTRAINT [FK_ReglaBonificacion_InventarioItemCompra] FOREIGN KEY ([IdInventarioItemCompra]) REFERENCES [dbo].[InventarioItem]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReglaBonificacion] ADD CONSTRAINT [FK_ReglaBonificacion_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Rol] ADD CONSTRAINT [FK_Rol_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RutaSesion] ADD CONSTRAINT [FK_RutaSesion_Chofer] FOREIGN KEY ([IdUsuarioChofer]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RutaSesion] ADD CONSTRAINT [FK_RutaSesion_Ruta] FOREIGN KEY ([IdRuta]) REFERENCES [dbo].[Ruta]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RutaSesion] ADD CONSTRAINT [FK_RutaSesion_Vehiculo] FOREIGN KEY ([IdVehiculo]) REFERENCES [dbo].[Vehiculo]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RutaSesion] ADD CONSTRAINT [FK_RutaSesion_Vendedor] FOREIGN KEY ([IdUsuarioVendedor]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Sesion] ADD CONSTRAINT [FK_Sesion_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Talonario] ADD CONSTRAINT [FK_Talonario_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [FK_Usuario_Entidad] FOREIGN KEY ([IdEntidad]) REFERENCES [dbo].[Entidad]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [FK_Usuario_Rol] FOREIGN KEY ([IdRol]) REFERENCES [dbo].[Rol]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Usuario] ADD CONSTRAINT [FK_Usuario_UsuarioPadre] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Vehiculo] ADD CONSTRAINT [FK_Vehiculo_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Venta] ADD CONSTRAINT [FK_Venta_Cliente] FOREIGN KEY ([IdCliente]) REFERENCES [dbo].[Cliente]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Venta] ADD CONSTRAINT [FK_Venta_RutaSesion] FOREIGN KEY ([IdRutaSesion]) REFERENCES [dbo].[RutaSesion]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Venta] ADD CONSTRAINT [FK_Venta_Talonario] FOREIGN KEY ([IdTalonario]) REFERENCES [dbo].[Talonario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Venta] ADD CONSTRAINT [FK_Venta_Usuario] FOREIGN KEY ([IdUsuario]) REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
