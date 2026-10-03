-- Fase 13: CHECK constraints de cantidades y montos, homologando el mismo criterio
-- ya aplicado en Fase 6 (InventarioItem.Existencia). Prisma no expresa CHECK en
-- schema.prisma para SQL Server; se agrega como SQL manual sobre columnas ya
-- validadas como positivas/no-negativas en la capa Zod, como defensa en profundidad.

-- Ajustes de inventario
ALTER TABLE [dbo].[AjusteInventario]
  ADD CONSTRAINT [CK_AjusteInventario_CantidadAjustada_Positiva] CHECK ([CantidadAjustada] > 0);

-- Bitácora de inventario (libro único de movimientos). Cantidad puede ser 0 en el
-- registro de alta de producto (product.service.ts registra un movimiento PRD con
-- cantidad=0 como marca de auditoría de creación, sin cambio real de existencia).
ALTER TABLE [dbo].[BitacoraInventario]
  ADD CONSTRAINT [CK_BitacoraInventario_Cantidad_NoNegativa] CHECK ([Cantidad] >= 0);
ALTER TABLE [dbo].[BitacoraInventario]
  ADD CONSTRAINT [CK_BitacoraInventario_ExistenciaAnterior_NoNegativa] CHECK ([ExistenciaAnterior] >= 0);
ALTER TABLE [dbo].[BitacoraInventario]
  ADD CONSTRAINT [CK_BitacoraInventario_NuevaExistencia_NoNegativa] CHECK ([NuevaExistencia] >= 0);

-- Compras
ALTER TABLE [dbo].[DetalleCompra]
  ADD CONSTRAINT [CK_DetalleCompra_Cantidad_Positiva] CHECK ([Cantidad] > 0);
ALTER TABLE [dbo].[DetalleCompra]
  ADD CONSTRAINT [CK_DetalleCompra_CostoUnitario_NoNegativo] CHECK ([CostoUnitario] >= 0);
ALTER TABLE [dbo].[DetalleGasto]
  ADD CONSTRAINT [CK_DetalleGasto_Cantidad_Positiva] CHECK ([Cantidad] > 0);
ALTER TABLE [dbo].[DetalleGasto]
  ADD CONSTRAINT [CK_DetalleGasto_PrecioUnitario_NoNegativo] CHECK ([PrecioUnitario] >= 0);

-- Ventas
ALTER TABLE [dbo].[DetalleVenta]
  ADD CONSTRAINT [CK_DetalleVenta_Cantidad_Positiva] CHECK ([Cantidad] > 0);
ALTER TABLE [dbo].[DetalleVenta]
  ADD CONSTRAINT [CK_DetalleVenta_PrecioUnitario_NoNegativo] CHECK ([PrecioUnitario] >= 0);
ALTER TABLE [dbo].[PagoVenta]
  ADD CONSTRAINT [CK_PagoVenta_Monto_Positivo] CHECK ([Monto] > 0);
ALTER TABLE [dbo].[CuentaPorCobrar]
  ADD CONSTRAINT [CK_CuentaPorCobrar_TotalOriginal_Positivo] CHECK ([TotalOriginal] > 0);

-- Inventario (precios/costos, complementa el CHECK de Existencia de Fase 6)
ALTER TABLE [dbo].[InventarioItem]
  ADD CONSTRAINT [CK_InventarioItem_CostoPromedio_NoNegativo] CHECK ([CostoPromedio] >= 0);
ALTER TABLE [dbo].[InventarioItem]
  ADD CONSTRAINT [CK_InventarioItem_PrecioVenta_NoNegativo] CHECK ([PrecioVenta] >= 0);

-- Estructura de producto (BOM)
ALTER TABLE [dbo].[EstructuraProducto]
  ADD CONSTRAINT [CK_EstructuraProducto_CantidadRequerida_Positiva] CHECK ([CantidadRequerida] > 0);

-- Reglas comerciales
ALTER TABLE [dbo].[ReglaComision]
  ADD CONSTRAINT [CK_ReglaComision_CantidadMinima_NoNegativa] CHECK ([CantidadMinima] >= 0);
ALTER TABLE [dbo].[ReglaComision]
  ADD CONSTRAINT [CK_ReglaComision_CantidadMaxima_NoNegativa] CHECK ([CantidadMaxima] IS NULL OR [CantidadMaxima] >= 0);
ALTER TABLE [dbo].[ReglaComision]
  ADD CONSTRAINT [CK_ReglaComision_Porcentaje_Rango] CHECK ([Porcentaje] >= 0 AND [Porcentaje] <= 100);
ALTER TABLE [dbo].[ReglaComision]
  ADD CONSTRAINT [CK_ReglaComision_MontoPorUnidad_NoNegativo] CHECK ([MontoPorUnidad] IS NULL OR [MontoPorUnidad] >= 0);
ALTER TABLE [dbo].[ReglaPrecioCliente]
  ADD CONSTRAINT [CK_ReglaPrecioCliente_Precio_Positivo] CHECK ([Precio] > 0);
ALTER TABLE [dbo].[ReglaBonificacion]
  ADD CONSTRAINT [CK_ReglaBonificacion_CantidadMinima_Positiva] CHECK ([CantidadMinima] > 0);
ALTER TABLE [dbo].[ReglaBonificacion]
  ADD CONSTRAINT [CK_ReglaBonificacion_CantidadMaxima_NoNegativa] CHECK ([CantidadMaxima] IS NULL OR [CantidadMaxima] >= 0);
ALTER TABLE [dbo].[ReglaBonificacion]
  ADD CONSTRAINT [CK_ReglaBonificacion_CantidadBonificada_Positiva] CHECK ([CantidadBonificada] > 0);

-- Empleados y planilla
ALTER TABLE [dbo].[Empleado]
  ADD CONSTRAINT [CK_Empleado_SueldoBase_Positivo] CHECK ([SueldoBase] > 0);
ALTER TABLE [dbo].[PlanillaMensual]
  ADD CONSTRAINT [CK_PlanillaMensual_SueldoBase_NoNegativo] CHECK ([SueldoBase] >= 0);
ALTER TABLE [dbo].[PlanillaMensual]
  ADD CONSTRAINT [CK_PlanillaMensual_TotalComisiones_NoNegativo] CHECK ([TotalComisiones] >= 0);
ALTER TABLE [dbo].[PlanillaMensual]
  ADD CONSTRAINT [CK_PlanillaMensual_TotalBonosMetas_NoNegativo] CHECK ([TotalBonosMetas] >= 0);
ALTER TABLE [dbo].[PlanillaMensual]
  ADD CONSTRAINT [CK_PlanillaMensual_TotalViaticos_NoNegativo] CHECK ([TotalViaticos] >= 0);
ALTER TABLE [dbo].[PlanillaMensual]
  ADD CONSTRAINT [CK_PlanillaMensual_TotalDescuentos_NoNegativo] CHECK ([TotalDescuentos] >= 0);
ALTER TABLE [dbo].[PlanillaMensual]
  ADD CONSTRAINT [CK_PlanillaMensual_SueldoLiquido_NoNegativo] CHECK ([SueldoLiquido] >= 0);
ALTER TABLE [dbo].[PlanillaDetalleComision]
  ADD CONSTRAINT [CK_PlanillaDetalleComision_Cantidad_NoNegativa] CHECK ([Cantidad] >= 0);
ALTER TABLE [dbo].[PlanillaDetalleComision]
  ADD CONSTRAINT [CK_PlanillaDetalleComision_BaseCalculo_NoNegativa] CHECK ([BaseCalculo] >= 0);
ALTER TABLE [dbo].[PlanillaDetalleComision]
  ADD CONSTRAINT [CK_PlanillaDetalleComision_ValorAplicado_NoNegativo] CHECK ([ValorAplicado] >= 0);
ALTER TABLE [dbo].[PlanillaDetalleComision]
  ADD CONSTRAINT [CK_PlanillaDetalleComision_MontoComision_NoNegativo] CHECK ([MontoComision] >= 0);
ALTER TABLE [dbo].[PlanillaDetalleAjuste]
  ADD CONSTRAINT [CK_PlanillaDetalleAjuste_Monto_NoNegativo] CHECK ([Monto] >= 0);

-- Logística
ALTER TABLE [dbo].[GastoVehiculo]
  ADD CONSTRAINT [CK_GastoVehiculo_Monto_Positivo] CHECK ([Monto] > 0);
ALTER TABLE [dbo].[MantenimientoVehiculo]
  ADD CONSTRAINT [CK_MantenimientoVehiculo_Costo_NoNegativo] CHECK ([Costo] IS NULL OR [Costo] >= 0);

-- Control de calidad de agua (rango homologado con quality.validators.ts)
ALTER TABLE [dbo].[ControlCalidadAgua]
  ADD CONSTRAINT [CK_ControlCalidadAgua_CloroAntes_NoNegativo] CHECK ([CloroAntesFiltrado] IS NULL OR [CloroAntesFiltrado] >= 0);
ALTER TABLE [dbo].[ControlCalidadAgua]
  ADD CONSTRAINT [CK_ControlCalidadAgua_CloroDespues_NoNegativo] CHECK ([CloroDespuesFiltrado] IS NULL OR [CloroDespuesFiltrado] >= 0);
ALTER TABLE [dbo].[ControlCalidadAgua]
  ADD CONSTRAINT [CK_ControlCalidadAgua_PhAntes_Rango] CHECK ([PhAntesFiltrado] IS NULL OR ([PhAntesFiltrado] >= 0 AND [PhAntesFiltrado] <= 14));
ALTER TABLE [dbo].[ControlCalidadAgua]
  ADD CONSTRAINT [CK_ControlCalidadAgua_PhDespues_Rango] CHECK ([PhDespuesFiltrado] IS NULL OR ([PhDespuesFiltrado] >= 0 AND [PhDespuesFiltrado] <= 14));

-- Envases retornables
ALTER TABLE [dbo].[MovimientoEnvase]
  ADD CONSTRAINT [CK_MovimientoEnvase_Cantidad_Positiva] CHECK ([Cantidad] > 0);
ALTER TABLE [dbo].[MovimientoEnvase]
  ADD CONSTRAINT [CK_MovimientoEnvase_SaldoAnterior_NoNegativo] CHECK ([SaldoAnterior] >= 0);
ALTER TABLE [dbo].[MovimientoEnvase]
  ADD CONSTRAINT [CK_MovimientoEnvase_SaldoNuevo_NoNegativo] CHECK ([SaldoNuevo] >= 0);
ALTER TABLE [dbo].[EnvaseClienteSaldo]
  ADD CONSTRAINT [CK_EnvaseClienteSaldo_CantidadPrestada_NoNegativa] CHECK ([CantidadPrestada] >= 0);
