ALTER TABLE [dbo].[ConfiguracionComision]
ADD [EsGeneral] BIT NOT NULL
    CONSTRAINT [DF_ConfiguracionComision_EsGeneral] DEFAULT (0);

ALTER TABLE [dbo].[Empleado]
ADD [IdTipoTrabajador] INT NULL;

ALTER TABLE [dbo].[InventarioItem]
ADD [IdCategoriaComision] INT NULL;

CREATE INDEX [IX_ConfiguracionComision_General_Activo]
ON [dbo].[ConfiguracionComision]([EsGeneral], [Anulado]);

CREATE INDEX [IX_InventarioItem_CategoriaComision_Activo]
ON [dbo].[InventarioItem]([IdCategoriaComision], [Anulado]);

ALTER TABLE [dbo].[PlanillaDetalleComision]
ADD [IdCategoriaComision] INT NULL,
    [IdReglaComisionCategoria] INT NULL,
    [BaseCategoriaAplicada] DECIMAL(12,2) NULL,
    [CategoriaComisionSnapshot] VARCHAR(50) NULL,
    [NombreProductoSnapshot] VARCHAR(255) NULL;

CREATE TABLE [dbo].[TipoTrabajador] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [Clave] VARCHAR(30) NOT NULL,
    [Nombre] VARCHAR(100) NOT NULL,
    [Activo] BIT NOT NULL CONSTRAINT [DF_TipoTrabajador_Activo] DEFAULT (1),
    CONSTRAINT [PK_TipoTrabajador] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_TipoTrabajador_Clave] UNIQUE NONCLUSTERED ([Clave])
);

CREATE TABLE [dbo].[EmpleadoSueldoVigencia] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdEmpleado] INT NOT NULL,
    [SueldoBase] DECIMAL(10,2) NOT NULL,
    [FechaInicioVigencia] DATE NOT NULL,
    [FechaFinVigencia] DATE NULL,
    [IdUsuarioRegistro] INT NULL,
    [FechaRegistro] DATETIME NOT NULL CONSTRAINT [DF_EmpleadoSueldoVigencia_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_EmpleadoSueldoVigencia] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_EmpleadoSueldoVigencia_Empleado_Inicio] UNIQUE NONCLUSTERED ([IdEmpleado], [FechaInicioVigencia]),
    CONSTRAINT [CK_EmpleadoSueldoVigencia_SueldoNoNegativo] CHECK ([SueldoBase] >= 0),
    CONSTRAINT [CK_EmpleadoSueldoVigencia_Periodo] CHECK ([FechaFinVigencia] IS NULL OR [FechaFinVigencia] >= [FechaInicioVigencia]),
    CONSTRAINT [FK_EmpleadoSueldoVigencia_Empleado] FOREIGN KEY ([IdEmpleado])
        REFERENCES [dbo].[Empleado]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_EmpleadoSueldoVigencia_Usuario] FOREIGN KEY ([IdUsuarioRegistro])
        REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [IX_EmpleadoSueldoVigencia_Empleado_Periodo]
ON [dbo].[EmpleadoSueldoVigencia]([IdEmpleado], [FechaInicioVigencia], [FechaFinVigencia]);

CREATE TABLE [dbo].[CategoriaComision] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [Clave] VARCHAR(30) NOT NULL,
    [Nombre] VARCHAR(100) NOT NULL,
    [Activa] BIT NOT NULL CONSTRAINT [DF_CategoriaComision_Activa] DEFAULT (1),
    CONSTRAINT [PK_CategoriaComision] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [UQ_CategoriaComision_Clave] UNIQUE NONCLUSTERED ([Clave])
);

CREATE TABLE [dbo].[ReglaComisionCategoria] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdConfiguracionComision] INT NOT NULL,
    [IdCategoriaComision] INT NOT NULL,
    [MontoMinimoVenta] DECIMAL(12,2) NOT NULL,
    [Porcentaje] DECIMAL(5,2) NOT NULL,
    [FechaInicioVigencia] DATE NOT NULL,
    [FechaFinVigencia] DATE NULL,
    [FechaRegistro] DATETIME NOT NULL CONSTRAINT [DF_ReglaComisionCategoria_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [IdUsuarioRegistro] INT NOT NULL,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_ReglaComisionCategoria_Anulado] DEFAULT (0),
    CONSTRAINT [PK_ReglaComisionCategoria] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [CK_ReglaComisionCategoria_MontoNoNegativo] CHECK ([MontoMinimoVenta] >= 0),
    CONSTRAINT [CK_ReglaComisionCategoria_Porcentaje] CHECK ([Porcentaje] > 0 AND [Porcentaje] <= 100),
    CONSTRAINT [CK_ReglaComisionCategoria_Periodo] CHECK ([FechaFinVigencia] IS NULL OR [FechaFinVigencia] >= [FechaInicioVigencia]),
    CONSTRAINT [FK_ReglaComisionCategoria_Configuracion] FOREIGN KEY ([IdConfiguracionComision])
        REFERENCES [dbo].[ConfiguracionComision]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_ReglaComisionCategoria_Categoria] FOREIGN KEY ([IdCategoriaComision])
        REFERENCES [dbo].[CategoriaComision]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_ReglaComisionCategoria_Usuario] FOREIGN KEY ([IdUsuarioRegistro])
        REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [IX_ReglaComisionCategoria_Vigencia]
ON [dbo].[ReglaComisionCategoria]([IdConfiguracionComision], [IdCategoriaComision], [FechaInicioVigencia], [Anulado]);

CREATE TABLE [dbo].[AdelantoEmpleado] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdEmpleado] INT NOT NULL,
    [IdUsuarioRegistro] INT NOT NULL,
    [IdPlanillaMensual] INT NULL,
    [Fecha] DATE NOT NULL,
    [Monto] DECIMAL(10,2) NOT NULL,
    [Observacion] VARCHAR(255) NULL,
    [FechaRegistro] DATETIME NOT NULL CONSTRAINT [DF_AdelantoEmpleado_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_AdelantoEmpleado_Anulado] DEFAULT (0),
    CONSTRAINT [PK_AdelantoEmpleado] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [CK_AdelantoEmpleado_MontoPositivo] CHECK ([Monto] > 0),
    CONSTRAINT [FK_AdelantoEmpleado_Empleado] FOREIGN KEY ([IdEmpleado])
        REFERENCES [dbo].[Empleado]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_AdelantoEmpleado_Usuario] FOREIGN KEY ([IdUsuarioRegistro])
        REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_AdelantoEmpleado_Planilla] FOREIGN KEY ([IdPlanillaMensual])
        REFERENCES [dbo].[PlanillaMensual]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [IX_AdelantoEmpleado_Empleado_Fecha]
ON [dbo].[AdelantoEmpleado]([IdEmpleado], [Fecha], [Anulado]);
CREATE INDEX [IX_AdelantoEmpleado_Planilla]
ON [dbo].[AdelantoEmpleado]([IdPlanillaMensual]);

CREATE TABLE [dbo].[FaltanteEmpleado] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdEmpleado] INT NOT NULL,
    [IdUsuarioRegistro] INT NOT NULL,
    [IdUsuarioRevision] INT NULL,
    [IdPlanillaMensual] INT NULL,
    [Fecha] DATE NOT NULL,
    [Monto] DECIMAL(10,2) NOT NULL,
    [Observacion] VARCHAR(255) NULL,
    [Estado] VARCHAR(20) NOT NULL CONSTRAINT [DF_FaltanteEmpleado_Estado] DEFAULT ('PENDIENTE'),
    [MotivoRevision] VARCHAR(255) NULL,
    [FechaRevision] DATETIME NULL,
    [FechaRegistro] DATETIME NOT NULL CONSTRAINT [DF_FaltanteEmpleado_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    [Anulado] BIT NOT NULL CONSTRAINT [DF_FaltanteEmpleado_Anulado] DEFAULT (0),
    CONSTRAINT [PK_FaltanteEmpleado] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [CK_FaltanteEmpleado_MontoPositivo] CHECK ([Monto] > 0),
    CONSTRAINT [CK_FaltanteEmpleado_Estado] CHECK ([Estado] IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
    CONSTRAINT [FK_FaltanteEmpleado_Empleado] FOREIGN KEY ([IdEmpleado])
        REFERENCES [dbo].[Empleado]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_FaltanteEmpleado_UsuarioRegistro] FOREIGN KEY ([IdUsuarioRegistro])
        REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_FaltanteEmpleado_UsuarioRevision] FOREIGN KEY ([IdUsuarioRevision])
        REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_FaltanteEmpleado_Planilla] FOREIGN KEY ([IdPlanillaMensual])
        REFERENCES [dbo].[PlanillaMensual]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [IX_FaltanteEmpleado_Empleado_Fecha_Estado]
ON [dbo].[FaltanteEmpleado]([IdEmpleado], [Fecha], [Estado], [Anulado]);
CREATE INDEX [IX_FaltanteEmpleado_Planilla]
ON [dbo].[FaltanteEmpleado]([IdPlanillaMensual]);

CREATE TABLE [dbo].[TarifaViatico] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [TarifaDiaria] DECIMAL(10,2) NOT NULL,
    [FechaInicioVigencia] DATE NOT NULL,
    [FechaFinVigencia] DATE NULL,
    [IdUsuarioRegistro] INT NULL,
    [FechaRegistro] DATETIME NOT NULL CONSTRAINT [DF_TarifaViatico_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_TarifaViatico] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [CK_TarifaViatico_TarifaPositiva] CHECK ([TarifaDiaria] > 0),
    CONSTRAINT [CK_TarifaViatico_Periodo] CHECK ([FechaFinVigencia] IS NULL OR [FechaFinVigencia] >= [FechaInicioVigencia]),
    CONSTRAINT [FK_TarifaViatico_Usuario] FOREIGN KEY ([IdUsuarioRegistro])
        REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [IX_TarifaViatico_Vigencia]
ON [dbo].[TarifaViatico]([FechaInicioVigencia], [FechaFinVigencia]);

CREATE TABLE [dbo].[PlanillaEvento] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [IdPlanillaMensual] INT NOT NULL,
    [IdUsuario] INT NOT NULL,
    [Accion] VARCHAR(30) NOT NULL,
    [Motivo] VARCHAR(255) NULL,
    [Detalle] VARCHAR(MAX) NULL,
    [FechaRegistro] DATETIME NOT NULL CONSTRAINT [DF_PlanillaEvento_FechaRegistro] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_PlanillaEvento] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PlanillaEvento_Planilla] FOREIGN KEY ([IdPlanillaMensual])
        REFERENCES [dbo].[PlanillaMensual]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_PlanillaEvento_Usuario] FOREIGN KEY ([IdUsuario])
        REFERENCES [dbo].[Usuario]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX [IX_PlanillaEvento_Planilla_Fecha]
ON [dbo].[PlanillaEvento]([IdPlanillaMensual], [FechaRegistro]);

ALTER TABLE [dbo].[Empleado]
ADD CONSTRAINT [FK_Empleado_TipoTrabajador] FOREIGN KEY ([IdTipoTrabajador])
    REFERENCES [dbo].[TipoTrabajador]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[InventarioItem]
ADD CONSTRAINT [FK_InventarioItem_CategoriaComision] FOREIGN KEY ([IdCategoriaComision])
    REFERENCES [dbo].[CategoriaComision]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[PlanillaDetalleComision]
ADD CONSTRAINT [FK_PlanillaDetalleComision_CategoriaComision] FOREIGN KEY ([IdCategoriaComision])
    REFERENCES [dbo].[CategoriaComision]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_PlanillaDetalleComision_ReglaCategoria] FOREIGN KEY ([IdReglaComisionCategoria])
    REFERENCES [dbo].[ReglaComisionCategoria]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

INSERT INTO [dbo].[TipoTrabajador] ([Clave], [Nombre])
VALUES ('RUTA', 'Personal de ruta'), ('PLANTA', 'Personal de planta');

INSERT INTO [dbo].[CategoriaComision] ([Clave], [Nombre])
VALUES ('GARRAFONES', 'Garrafones'), ('OTROS', 'Otros');

INSERT INTO [dbo].[TarifaViatico] ([TarifaDiaria], [FechaInicioVigencia])
SELECT 30.00, CONVERT(date, GETDATE())
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[TarifaViatico]
    WHERE [FechaInicioVigencia] = CONVERT(date, GETDATE())
);
