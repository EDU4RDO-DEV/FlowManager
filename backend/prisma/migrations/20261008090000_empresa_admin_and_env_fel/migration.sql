BEGIN TRY

BEGIN TRAN;

IF COL_LENGTH('dbo.Empresa', 'UsuarioFel') IS NOT NULL
    ALTER TABLE [dbo].[Empresa] DROP COLUMN [UsuarioFel];

IF COL_LENGTH('dbo.Empresa', 'ContrasenaFel') IS NOT NULL
    ALTER TABLE [dbo].[Empresa] DROP COLUMN [ContrasenaFel];

IF COL_LENGTH('dbo.Empresa', 'ServidorFel') IS NOT NULL
    ALTER TABLE [dbo].[Empresa] DROP COLUMN [ServidorFel];

IF NOT EXISTS (SELECT 1 FROM [dbo].[ModuloSistema] WHERE [Clave] = 'empresa')
BEGIN
    INSERT INTO [dbo].[ModuloSistema] ([Clave], [Nombre], [Anulado])
    VALUES ('empresa', 'Empresa', 0);
END;

UPDATE [dbo].[ModuloSistema]
SET [Nombre] = 'Empresa',
    [Anulado] = 0,
    [IdUsuarioAnulador] = NULL,
    [FechaAnulacion] = NULL
WHERE [Clave] = 'empresa';

DECLARE @EmpresaModuloId INT;
DECLARE @ReportesModuloId INT;

SELECT @EmpresaModuloId = [Id]
FROM [dbo].[ModuloSistema]
WHERE [Clave] = 'empresa';

SELECT @ReportesModuloId = [Id]
FROM [dbo].[ModuloSistema]
WHERE [Clave] = 'reportes';

IF @EmpresaModuloId IS NOT NULL AND @ReportesModuloId IS NOT NULL
BEGIN
    INSERT INTO [dbo].[RolPermiso] (
        [IdRol],
        [IdModuloSistema],
        [IdAccionSistema],
        [Permitido],
        [IdUsuario],
        [IdUsuarioModificador],
        [FechaModificacion],
        [Anulado],
        [IdUsuarioAnulador],
        [FechaAnulacion]
    )
    SELECT
        [source].[IdRol],
        @EmpresaModuloId,
        [source].[IdAccionSistema],
        [source].[Permitido],
        [source].[IdUsuario],
        [source].[IdUsuarioModificador],
        [source].[FechaModificacion],
        0,
        NULL,
        NULL
    FROM [dbo].[RolPermiso] AS [source]
    WHERE [source].[IdModuloSistema] = @ReportesModuloId
      AND [source].[Anulado] = 0
      AND NOT EXISTS (
          SELECT 1
          FROM [dbo].[RolPermiso] AS [existing]
          WHERE [existing].[IdRol] = [source].[IdRol]
            AND [existing].[IdModuloSistema] = @EmpresaModuloId
            AND [existing].[IdAccionSistema] = [source].[IdAccionSistema]
      );
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
