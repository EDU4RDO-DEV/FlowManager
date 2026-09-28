-- Fase 6: integridad de inventario. Prisma no expresa CHECK constraints en schema.prisma
-- para SQL Server; se agrega como SQL manual, manteniendo Prisma Migrate como mecanismo oficial.
ALTER TABLE [dbo].[InventarioItem]
  ADD CONSTRAINT [CK_InventarioItem_Existencia_NoNegativa] CHECK ([Existencia] >= 0);
