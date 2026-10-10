-- Inserta una fila minima en Empresa si la tabla esta vacia.
-- Las credenciales FEL se configuran exclusivamente por variables de entorno
-- (FEL_BASE_URL, FEL_USUARIO y FEL_CLAVE) en el entorno del backend.
-- IMPORTANTE: reemplazar Nit/Nombre/NombreComercial/Direccion/Frase/RegimenIsr
-- con los datos reales de la empresa cuando esten disponibles.
IF NOT EXISTS (SELECT 1 FROM Empresa)
BEGIN
    INSERT INTO Empresa (
        IdUsuario,
        Nit,
        Nombre,
        NombreComercial,
        Direccion,
        Frase,
        RegimenIsr,
        Anulado
    )
    VALUES (
        1,
        'PENDIENTE',
        'Industrias Basan (pendiente de completar)',
        'Industrias Basan',
        'PENDIENTE',
        'PENDIENTE',
        'PENDIENTE',
        0
    );
END
