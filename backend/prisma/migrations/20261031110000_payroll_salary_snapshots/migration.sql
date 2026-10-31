CREATE TABLE [PlanillaDetalleSalario] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [IdPlanillaMensual] INT NOT NULL,
    [IdEmpleadoSueldoVigencia] INT NULL,
    [FechaInicio] DATE NOT NULL,
    [FechaFin] DATE NOT NULL,
    [DiasCalendario] INT NOT NULL,
    [SueldoMensualSnapshot] DECIMAL(10,2) NOT NULL,
    [MontoDevengado] DECIMAL(10,2) NOT NULL,
    [FechaRegistro] DATETIME NOT NULL CONSTRAINT [DF_PlanillaDetalleSalario_FechaRegistro] DEFAULT GETDATE(),
    CONSTRAINT [PK_PlanillaDetalleSalario] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PlanillaDetalleSalario_Planilla]
        FOREIGN KEY ([IdPlanillaMensual]) REFERENCES [PlanillaMensual]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [FK_PlanillaDetalleSalario_Vigencia]
        FOREIGN KEY ([IdEmpleadoSueldoVigencia]) REFERENCES [EmpleadoSueldoVigencia]([Id])
        ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [CK_PlanillaDetalleSalario_DiasCalendario] CHECK ([DiasCalendario] > 0),
    CONSTRAINT [CK_PlanillaDetalleSalario_MontoDevengado] CHECK ([MontoDevengado] >= 0)
);

CREATE INDEX [IX_PlanillaDetalleSalario_Planilla]
ON [PlanillaDetalleSalario]([IdPlanillaMensual]);
